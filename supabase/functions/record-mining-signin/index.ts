import { corsHeaders, json, getServiceClient, getUser } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc = getServiceClient();
    const { data: authRecord, error: authError } = await svc.auth.admin.getUserById(user.id);
    if (authError || !authRecord.user) {
      return json({ error: "could_not_verify_sign_in" }, 401);
    }

    // Use Supabase Auth's server-maintained sign-in timestamp. A still-valid
    // access token or a silent token refresh cannot extend the 24-hour window.
    const authenticatedAt = authRecord.user.last_sign_in_at;
    if (!authenticatedAt) return json({ error: "sign_in_timestamp_unavailable" }, 409);

    const signInTime = new Date(authenticatedAt);
    if (!Number.isFinite(signInTime.getTime())) {
      return json({ error: "invalid_sign_in_timestamp" }, 409);
    }

    const { data: current, error: currentError } = await svc
      .from("mining_activity")
      .select("last_sign_in_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (currentError) throw currentError;

    // Idempotent: only a newer Auth sign-in can refresh mining eligibility.
    if (current?.last_sign_in_at &&
        new Date(current.last_sign_in_at).getTime() >= signInTime.getTime()) {
      return json({ ok: true, unchanged: true });
    }

    const { data: activation, error: activationError } = await svc
      .from("mining_activations")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (activationError) throw activationError;

    const activated = activation?.status === "confirmed";
    const eligibleUntil = new Date(signInTime.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const active = activated && eligibleUntil.getTime() > now.getTime();

    const { error: writeError } = await svc.from("mining_activity").upsert({
      user_id: user.id,
      last_sign_in_at: signInTime.toISOString(),
      eligible_until: eligibleUntil.toISOString(),
      status: active ? "active" : "paused",
      paused_at: active ? null : now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });
    if (writeError) throw writeError;

    return json({
      ok: true,
      status: active ? "active" : "paused",
      eligible_until: eligibleUntil.toISOString(),
      activation_required: !activated,
    });
  } catch (error) {
    console.error("[record-mining-signin]", error);
    return json({ error: "could_not_update_mining_activity" }, 500);
  }
});
