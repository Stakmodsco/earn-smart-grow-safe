import { corsHeaders, json, getServiceClient, getUser, getSetting } from "../_shared/utils.ts";

// Mirror of the country/method catalog used on the client. Keeping this list here
// means the server can reject any method that doesn't belong to the declared country.
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
const ALL_METHODS = new Set(Object.values(COUNTRY_METHODS).flat());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const targetLevel = Number(body.target_level);
    const paymentMethod = String(body.payment_method || "").trim();
    const country = String(body.country || "").trim();
    const proofUrl = String(body.proof_url || "").trim();
    const notes = String(body.notes || "").slice(0, 2000);

    if (![1, 2, 3].includes(targetLevel)) return json({ error: "invalid level" }, 400);
    if (!paymentMethod) return json({ error: "payment method required" }, 400);
    if (!ALL_METHODS.has(paymentMethod)) return json({ error: "unknown payment method" }, 400);
    if (!proofUrl) return json({ error: "proof required" }, 400);

    // Country / method must match. If country missing, derive it from the method.
    let resolvedCountry = country;
    if (!resolvedCountry) {
      resolvedCountry = Object.entries(COUNTRY_METHODS).find(([, list]) =>
        list.includes(paymentMethod),
      )?.[0] ?? "";
    }
    const allowed = COUNTRY_METHODS[resolvedCountry];
    if (!allowed || !allowed.includes(paymentMethod)) {
      return json({ error: "payment method does not match the selected country" }, 400);
    }

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
