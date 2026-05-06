import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const svc = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

function getIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = getIp(req);
  const sb = svc();

  // Ad-hoc per-IP throttle: max 5 signup attempts per IP in 15 minutes.
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count: attemptCount } = await sb
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if ((attemptCount ?? 0) >= 5) {
    await sb.from("signup_attempts").insert({ ip, email: null, success: false, kind: "throttled", reason: "ip_rate_limit" });
    return json({ error: "Too many signup attempts from this network. Please try again later." }, 429);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const full_name = String(body?.full_name ?? "").trim();
  const referral_code = body?.referral_code ? String(body.referral_code).trim().toUpperCase() : null;
  const captchaId = String(body?.captcha_id ?? "");
  const captchaAnswer = Number(body?.captcha_answer);

  // Basic validation
  if (!EMAIL_RE.test(email) || email.length > 254) return logAndReturn(sb, ip, email, "Invalid email", 400, "validation", "invalid_email");
  if (typeof password !== "string" || password.length < 8 || password.length > 72)
    return logAndReturn(sb, ip, email, "Password must be 8–72 characters", 400, "validation", "weak_password");
  if (!full_name || full_name.length > 100) return logAndReturn(sb, ip, email, "Full name is required", 400, "validation", "missing_name");
  if (!captchaId || !Number.isFinite(captchaAnswer))
    return logAndReturn(sb, ip, email, "Captcha is required", 400, "validation", "missing_captcha");

  const { data: ch } = await sb
    .from("captcha_challenges")
    .select("id, answer, attempts, consumed, expires_at")
    .eq("id", captchaId)
    .maybeSingle();

  if (!ch) return logAndReturn(sb, ip, email, "Captcha expired — please refresh.", 400, "captcha_failed", "not_found");
  if (ch.consumed) return logAndReturn(sb, ip, email, "Captcha already used — please refresh.", 400, "captcha_failed", "already_used");
  if (new Date(ch.expires_at).getTime() < Date.now())
    return logAndReturn(sb, ip, email, "Captcha expired — please refresh.", 400, "captcha_failed", "expired");
  if ((ch.attempts ?? 0) >= 3) {
    await sb.from("captcha_challenges").update({ consumed: true }).eq("id", ch.id);
    return logAndReturn(sb, ip, email, "Too many wrong attempts — please refresh the captcha.", 400, "captcha_failed", "max_attempts");
  }

  if (ch.answer !== captchaAnswer) {
    await sb.from("captcha_challenges").update({ attempts: (ch.attempts ?? 0) + 1 }).eq("id", ch.id);
    return logAndReturn(sb, ip, email, "Captcha is incorrect.", 400, "captcha_failed", "wrong_answer");
  }

  await sb.from("captcha_challenges").update({ consumed: true }).eq("id", ch.id);

  const { error: createErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, referral_code },
  });
  if (createErr) return logAndReturn(sb, ip, email, createErr.message, 400, "auth_error", createErr.message);

  await sb.from("signup_attempts").insert({ ip, email, success: true, kind: "success", reason: null });
  return json({ ok: true });
});

async function logAndReturn(sb: ReturnType<typeof svc>, ip: string, email: string, error: string, status: number, kind = "error", reason: string | null = null) {
  await sb.from("signup_attempts").insert({ ip, email, success: false, kind, reason });
  return json({ error }, status);
}
