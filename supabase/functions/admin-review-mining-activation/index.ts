import { corsHeaders, json, getServiceClient, getUser, isAdmin } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc = getServiceClient();
    if (!(await isAdmin(svc, user.id))) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const activationId = String(body.activation_id ?? "").trim();
    const action = String(body.action ?? "");
    const paymentReference = String(body.payment_reference ?? "").trim();

    if (!activationId || !["confirm", "reject"].includes(action)) {
      return json({ error: "invalid_input" }, 400);
    }
    if (action === "confirm" && (paymentReference.length < 4 || paymentReference.length > 128)) {
      return json({ error: "independently_verified_payment_reference_required" }, 400);
    }

    const { data: activation, error: readError } = await svc
      .from("mining_activations")
      .select("id,status,user_id")
      .eq("id", activationId)
      .maybeSingle();
    if (readError) throw readError;
    if (!activation) return json({ error: "activation_not_found" }, 404);
    if (activation.status !== "pending") return json({ error: "activation_already_reviewed" }, 409);

    const update = action === "confirm"
      ? {
          status: "confirmed",
          payment_reference: paymentReference,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : {
          status: "rejected",
          payment_reference: null,
          verified_at: null,
          updated_at: new Date().toISOString(),
        };

    const { data: updated, error: updateError } = await svc
      .from("mining_activations")
      .update(update)
      .eq("id", activationId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json({ error: "activation_already_reviewed" }, 409);

    return json({ ok: true, status: update.status, user_id: activation.user_id });
  } catch (error) {
    console.error("[admin-review-mining-activation]", error);
    return json({ error: "activation_review_failed" }, 500);
  }
});
