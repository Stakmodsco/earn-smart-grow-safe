import { corsHeaders, json, getServiceClient, getUser, getSetting } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const payoutMethod = String(body.payout_method || "").trim();
    const payoutDetails = String(body.payout_details || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "invalid amount" }, 400);
    if (!payoutMethod || !payoutDetails) return json({ error: "payout details required" }, 400);
    if (payoutDetails.length > 500) return json({ error: "details too long" }, 400);

    const svc = getServiceClient();
    const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!profile) return json({ error: "profile not found" }, 404);
    if (profile.flagged) return json({ error: "account flagged" }, 403);

    const minW = Number(await getSetting(svc, "min_withdrawal"));
    const caps = (await getSetting(svc, "daily_withdrawal_caps")) as Record<string, number>;
    const lvl = String(profile.level ?? 0);
    const dailyCap = Number(caps[lvl] ?? 0);

    if (amount < minW) return json({ error: `minimum withdrawal is $${minW}` }, 400);
    if (dailyCap <= 0) return json({ error: "withdrawals not available at your level" }, 403);
    if (amount > dailyCap) return json({ error: `daily withdrawal cap is $${dailyCap}` }, 400);
    if (amount > Number(profile.balance)) return json({ error: "insufficient balance" }, 400);

    // One per 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await svc.from("withdrawals").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).gte("requested_at", since);
    if ((count ?? 0) > 0) return json({ error: "one withdrawal per 24h" }, 429);

    // Move to locked balance
    const newBalance = Number(profile.balance) - amount;
    const newLocked = Number(profile.locked_balance) + amount;
    const { error: uErr } = await svc.from("profiles").update({
      balance: newBalance, locked_balance: newLocked, updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (uErr) return json({ error: uErr.message }, 500);

    const { data: w, error: wErr } = await svc.from("withdrawals").insert({
      user_id: user.id, amount, payout_method: payoutMethod, payout_details: payoutDetails,
    }).select().single();
    if (wErr) return json({ error: wErr.message }, 500);

    await svc.from("transactions").insert({ user_id: user.id, type: "withdrawal", amount, status: "pending", notes: w.id });

    return json({ ok: true, withdrawal: w });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
