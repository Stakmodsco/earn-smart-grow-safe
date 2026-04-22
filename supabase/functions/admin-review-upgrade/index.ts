import { corsHeaders, json, getServiceClient, getUser, isAdmin, getSetting } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const svc = getServiceClient();
    if (!(await isAdmin(svc, user.id))) return json({ error: "forbidden" }, 403);

    const { transaction_id, action, notes } = await req.json();
    if (!transaction_id || !["approve", "reject"].includes(action)) return json({ error: "invalid input" }, 400);

    const { data: txn } = await svc.from("transactions").select("*").eq("id", transaction_id).maybeSingle();
    if (!txn || txn.type !== "upgrade") return json({ error: "not found" }, 404);
    if (txn.status !== "pending") return json({ error: "already reviewed" }, 409);

    if (action === "reject") {
      await svc.from("transactions").update({
        status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString(), notes: notes ?? txn.notes,
      }).eq("id", transaction_id);
      return json({ ok: true });
    }

    // Approve: bump level, pay referrers
    const { data: profile } = await svc.from("profiles").select("*").eq("id", txn.user_id).maybeSingle();
    if (!profile) return json({ error: "user profile missing" }, 404);

    if ((txn.target_level ?? 0) > (profile.level ?? 0)) {
      await svc.from("profiles").update({
        level: txn.target_level, updated_at: new Date().toISOString(),
      }).eq("id", txn.user_id);
    }
    await svc.from("transactions").update({
      status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    }).eq("id", transaction_id);

    // Referral commissions with daily cap
    const commission = (await getSetting(svc, "referral_commission")) as { l1: number; l2: number };
    const refCaps = (await getSetting(svc, "daily_referral_cap")) as Record<string, number>;
    const { data: refs } = await svc.from("referrals").select("parent_user, depth").eq("child_user", txn.user_id);

    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);

    for (const r of refs ?? []) {
      const rate = r.depth === 1 ? commission.l1 : commission.l2;
      const reward = Number(txn.amount) * rate;
      if (reward <= 0) continue;

      const { data: parent } = await svc.from("profiles")
        .select("balance,total_earnings,level").eq("id", r.parent_user).maybeSingle();
      if (!parent) continue;

      const cap = Number(refCaps[String(parent.level ?? 0)] ?? 0);
      if (cap <= 0) continue;

      // Sum today's referral earnings for this parent
      const { data: todayRef } = await svc.from("transactions")
        .select("amount").eq("user_id", r.parent_user).eq("type", "referral")
        .gte("created_at", startOfDay.toISOString());
      const earnedToday = (todayRef ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0);
      const allowed = Math.max(0, cap - earnedToday);
      const credit = Math.min(reward, allowed);
      if (credit <= 0) {
        // Log a capped/rejected referral so the user can see why it didn't pay
        await svc.from("transactions").insert({
          user_id: r.parent_user, type: "referral", amount: reward, status: "rejected",
          notes: `L${r.depth} referral capped (daily limit reached)`,
        });
        continue;
      }

      await svc.from("profiles").update({
        balance: Number(parent.balance) + credit,
        total_earnings: Number(parent.total_earnings) + credit,
        updated_at: new Date().toISOString(),
      }).eq("id", r.parent_user);
      await svc.from("transactions").insert({
        user_id: r.parent_user, type: "referral", amount: credit, status: "completed",
        notes: `L${r.depth} referral from upgrade ${txn.id.slice(0, 8)}`,
      });
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
