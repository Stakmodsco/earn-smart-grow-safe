import { corsHeaders, json, getServiceClient, getUser, getSetting } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const targetLevel = Number(body.target_level);
    const paymentMethod = String(body.payment_method || "").trim();
    const proofUrl = String(body.proof_url || "").trim();
    const notes = String(body.notes || "").slice(0, 500);

    if (![1, 2, 3].includes(targetLevel)) return json({ error: "invalid level" }, 400);
    if (!paymentMethod) return json({ error: "payment method required" }, 400);
    if (!proofUrl) return json({ error: "proof required" }, 400);

    const svc = getServiceClient();
    const { data: profile } = await svc.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!profile) return json({ error: "profile not found" }, 404);
    if (profile.flagged) return json({ error: "account flagged" }, 403);
    if (targetLevel <= (profile.level ?? 0)) return json({ error: "target level must be higher" }, 400);

    const prices = (await getSetting(svc, "level_prices")) as Record<string, number>;
    const amount = Number(prices[String(targetLevel)] ?? 0);
    if (amount <= 0) return json({ error: "price not configured" }, 500);

    // Block duplicate pending upgrade
    const { count } = await svc.from("transactions").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("type", "upgrade").eq("status", "pending");
    if ((count ?? 0) > 0) return json({ error: "you already have a pending upgrade" }, 409);

    const { data: txn, error } = await svc.from("transactions").insert({
      user_id: user.id, type: "upgrade", amount, status: "pending",
      proof_url: proofUrl, payment_method: paymentMethod, target_level: targetLevel, notes,
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, transaction: txn });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
