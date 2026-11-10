import { corsHeaders, json, getServiceClient, getUser, isAdmin } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc = getServiceClient();
    if (!(await isAdmin(svc, user.id))) return json({ error: "forbidden" }, 403);

    const { transaction_id, action, notes } = await req.json();
    if (!transaction_id || !["approve", "reject"].includes(action)) {
      return json({ error: "invalid_input" }, 400);
    }

    const { data: txn, error: txnError } = await svc
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .maybeSingle();
    if (txnError) throw txnError;
    if (!txn || txn.type !== "upgrade") return json({ error: "not_found" }, 404);
    if (txn.status !== "pending") return json({ error: "already_reviewed" }, 409);

    if (action === "reject") {
      const { error } = await svc.from("transactions").update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        notes: notes ?? txn.notes,
      }).eq("id", transaction_id);
      if (error) throw error;
      return json({ ok: true });
    }

    const { data: profile, error: profileError } = await svc
      .from("profiles")
      .select("id,level")
      .eq("id", txn.user_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: "user_profile_missing" }, 404);

    if ((txn.target_level ?? 0) > (profile.level ?? 0)) {
      const { error } = await svc.from("profiles").update({
        level: txn.target_level,
        updated_at: new Date().toISOString(),
      }).eq("id", txn.user_id);
      if (error) throw error;
    }

    const { error: reviewError } = await svc.from("transactions").update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", transaction_id);
    if (reviewError) throw reviewError;

    // Referrals now affect mining speed only. This review path never credits
    // referral transactions, balances, or trading capital.
    return json({ ok: true, referral_commission_paid: false });
  } catch (error) {
    console.error("[admin-review-upgrade]", error);
    return json({ error: "review_failed" }, 500);
  }
});
