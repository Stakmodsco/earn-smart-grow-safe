
-- Captcha challenges (server-validated)
CREATE TABLE public.captcha_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a smallint NOT NULL,
  b smallint NOT NULL,
  answer smallint NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  consumed boolean NOT NULL DEFAULT false,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);
CREATE INDEX idx_captcha_challenges_ip_created ON public.captcha_challenges(ip, created_at);
ALTER TABLE public.captcha_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read captcha" ON public.captcha_challenges
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Ad-hoc per-IP signup throttle
CREATE TABLE public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  email text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_signup_attempts_ip_created ON public.signup_attempts(ip, created_at DESC);
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read signup_attempts" ON public.signup_attempts
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Payment config version key (used by client caches as cache-buster)
INSERT INTO public.app_settings (key, value)
VALUES ('payment_config_version', to_jsonb('1'::text))
ON CONFLICT (key) DO NOTHING;
