import { corsHeaders, json, getServiceClient, getUser } from "../_shared/utils.ts";

const COUNTRY_METHODS: Record<string, string[]> = {
  INT: ["usdt_trc20"],
  ZA: ["za_voucher", "usdt_trc20"],
  GH: ["gh_vodafone_cash", "usdt_trc20"],
  UG: ["ug_airtel_money", "usdt_trc20"],
  BW: ["bw_jazz_cash", "usdt_trc20"],
  PK: ["pk_jazz_cash", "usdt_trc20"],
  BD: ["bd_bkash", "usdt_trc20"],
  COMING_SOON: ["usdt_trc20"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const paymentMethod = String(body.payment_method ?? "").trim();
    const country = String(body.country ?? "").trim();
    const proofPath = String(body.proof_path ?? "").trim();
    const notes = String(body.notes ?? "").slice(0, 2000);

    if (!paymentMethod || !country || !COUNTRY_METHODS[country]?.includes(paymentMethod)) {
      return json({ error: "invalid_payment_method_or_country" }, 400);
    }
    if (!proofPath.startsWith(user.id + "/") || proofPath.length > 512) {
      return json({ error: "invalid_payment_proof" }, 400);
    }

    const svc = getServiceClient();
    const fileName = proofPath.slice(user.id.length + 1);
    const { data: proofFiles, error: proofError } = await svc.storage
      .from("proofs")
      .list(user.id, { search: fileName, limit: 100 });
    if (proofError) throw proofError;
    if (!(proofFiles ?? []).some((file) => file.name === fileName)) {
      return json({ error: "payment_proof_not_found" }, 400);
    }

    const { data: existing, error: existingError } = await svc
      .from("mining_activations")
      .select("id,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "confirmed") return json({ error: "mining_already_activated" }, 409);
    if (existing?.status === "pending") return json({ error: "activation_payment_already_pending" }, 409);

    const values = {
      user_id: user.id,
      amount_usd: 5,
      status: "pending",
      payment_reference: null,
      proof_path: proofPath,
      payment_method: paymentMethod,
      payment_country: country,
      payment_notes: notes,
      verified_at: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = existing
      ? await svc.from("mining_activations").update(values).eq("id", existing.id).select("id,status").single()
      : await svc.from("mining_activations").insert(values).select("id,status").single();
    if (error) throw error;

    return json({ ok: true, activation: data });
  } catch (error) {
    console.error("[submit-mining-activation]", error);
    return json({ error: "could_not_submit_activation" }, 500);
  }
});
