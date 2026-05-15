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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: {
        persistSession: false,
      },
    }
  );

function getIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";

  return (
    xff.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashRecoveryKey(key: string) {
  const normalizedKey = key.replace(/\s/g, "").toUpperCase();
  const data = new TextEncoder().encode(normalizedKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function logAndReturn(
  sb: ReturnType<typeof svc>,
  ip: string,
  email: string | null,
  error: string,
  status: number,
  kind = "error",
  reason: string | null = null
) {
  await sb.from("signup_attempts").insert({
    ip,
    email,
    success: false,
    kind,
    reason,
  });

  return json({ error }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const ip = getIp(req);
  const sb = svc();

  const since = new Date(Date.now() - 15 * 60_000).toISOString();

  const { count: attemptCount } = await sb
    .from("signup_attempts")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("ip", ip)
    .gte("created_at", since);

  if ((attemptCount ?? 0) >= 5) {
    await sb.from("signup_attempts").insert({
      ip,
      email: null,
      success: false,
      kind: "throttled",
      reason: "ip_rate_limit",
    });

    return json(
      {
        error:
          "Too many signup attempts from this network. Please try again later.",
      },
      429
    );
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const fullName = String(body?.full_name ?? "").trim();

  const referralCode = body?.referral_code
    ? String(body.referral_code).trim().toUpperCase()
    : null;

  const captchaId = String(body?.captcha_id ?? "");
  const captchaAnswer = Number(body?.captcha_answer);

  const recoveryKeys = Array.isArray(body?.recovery_keys)
    ? body.recovery_keys.map((key: unknown) =>
        String(key).replace(/\s/g, "").toUpperCase()
      )
    : [];

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return logAndReturn(
      sb,
      ip,
      email,
      "Invalid email",
      400,
      "validation",
      "invalid_email"
    );
  }

  if (password.length < 8 || password.length > 72) {
    return logAndReturn(
      sb,
      ip,
      email,
      "Password must be 8–72 characters",
      400,
      "validation",
      "weak_password"
    );
  }

  if (!fullName || fullName.length > 100) {
    return logAndReturn(
      sb,
      ip,
      email,
      "Full name is required",
      400,
      "validation",
      "missing_name"
    );
  }

  if (
    recoveryKeys.length !== 10 ||
    recoveryKeys.some((key: string) => key.length !== 12)
  ) {
    return logAndReturn(
      sb,
      ip,
      email,
      "Recovery keys were not generated. Please try signing up again.",
      400,
      "recovery_keys_error",
      "invalid_recovery_keys"
    );
  }

  if (!captchaId || !Number.isFinite(captchaAnswer)) {
    return logAndReturn(
      sb,
      ip,
      email,
      "Captcha is required",
      400,
      "validation",
      "missing_captcha"
    );
  }

  const { data: challenge } = await sb
    .from("captcha_challenges")
    .select("id, answer, attempts, consumed, expires_at")
    .eq("id", captchaId)
    .maybeSingle();

  if (!challenge) {
    return logAndReturn(
      sb,
      ip,
      email,
      "Captcha expired — please refresh.",
      400,
      "captcha_failed",
      "not_found"
    );
  }

  if (challenge.consumed) {
    return logAndReturn(
      sb,
      ip,
      email,
      "Captcha already used — please refresh.",
      400,
      "captcha_failed",
      "already_used"
    );
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return logAndReturn(
      sb,
      ip,
      email,
      "Captcha expired — please refresh.",
      400,
      "captcha_failed",
      "expired"
    );
  }

  if ((challenge.attempts ?? 0) >= 3) {
    await sb
      .from("captcha_challenges")
      .update({
        consumed: true,
      })
      .eq("id", challenge.id);

    return logAndReturn(
      sb,
      ip,
      email,
      "Too many wrong attempts — please refresh the captcha.",
      400,
      "captcha_failed",
      "max_attempts"
    );
  }

  if (challenge.answer !== captchaAnswer) {
    await sb
      .from("captcha_challenges")
      .update({
        attempts: (challenge.attempts ?? 0) + 1,
      })
      .eq("id", challenge.id);

    return logAndReturn(
      sb,
      ip,
      email,
      "Captcha is incorrect.",
      400,
      "captcha_failed",
      "wrong_answer"
    );
  }

  await sb
    .from("captcha_challenges")
    .update({
      consumed: true,
    })
    .eq("id", challenge.id);

  const { data: createdUserData, error: createErr } =
    await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        referral_code: referralCode,
      },
    });

  if (createErr || !createdUserData?.user) {
    return logAndReturn(
      sb,
      ip,
      email,
      createErr?.message ?? "Could not create account",
      400,
      "auth_error",
      createErr?.message ?? "create_user_failed"
    );
  }

  const user = createdUserData.user;

  const hashedKeys = await Promise.all(
    recoveryKeys.map((key: string) => hashRecoveryKey(key))
  );

  const { error: keysErr } = await sb.from("user_recovery_keys").insert(
    hashedKeys.map((hash) => ({
      user_id: user.id,
      recovery_key_hash: hash,
      used: false,
    }))
  );

  if (keysErr) {
    await sb.auth.admin.deleteUser(user.id);

    return logAndReturn(
      sb,
      ip,
      email,
      "Account could not be created. Please try again.",
      500,
      "recovery_keys_error",
      keysErr.message
    );
  }

  await sb.from("signup_attempts").insert({
    ip,
    email,
    success: true,
    kind: "success",
    reason: null,
  });

  return json({
    ok: true,
  });
});
