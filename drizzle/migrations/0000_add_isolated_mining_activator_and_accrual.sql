CREATE TABLE public.mining_activator_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proof_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text
);
GRANT SELECT ON public.mining_activator_requests TO authenticated;
GRANT ALL ON public.mining_activator_requests TO service_role;
ALTER TABLE public.mining_activator_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own mining activator requests" ON public.mining_activator_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read mining activator requests" ON public.mining_activator_requests FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE UNIQUE INDEX mining_activator_one_open_or_approved_per_user ON public.mining_activator_requests (user_id) WHERE status IN ('pending', 'approved');
CREATE INDEX mining_activator_admin_review_queue ON public.mining_activator_requests (status, submitted_at DESC);

CREATE TABLE public.mine_accounts (
  user_id uuid PRIMARY KEY,
  mine_balance numeric(24, 8) NOT NULL DEFAULT 0,
  eligible_seconds numeric(22, 6) NOT NULL DEFAULT 0,
  last_accrued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mine_accounts TO authenticated;
GRANT ALL ON public.mine_accounts TO service_role;
ALTER TABLE public.mine_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own mine account" ON public.mine_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read mine accounts" ON public.mine_accounts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.mine_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_run_id uuid,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  eligible_seconds numeric(22, 6) NOT NULL,
  qualified_referrals integer NOT NULL,
  speed_multiplier integer NOT NULL,
  mine_amount numeric(24, 8) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start, period_end),
  CHECK (period_end > period_start),
  CHECK (eligible_seconds > 0),
  CHECK (mine_amount > 0)
);
GRANT SELECT ON public.mine_accruals TO authenticated;
GRANT ALL ON public.mine_accruals TO service_role;
ALTER TABLE public.mine_accruals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own mine accruals" ON public.mine_accruals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read mine accruals" ON public.mine_accruals FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX mine_accruals_user_created ON public.mine_accruals (user_id, created_at DESC);

CREATE TABLE public.mine_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  processed_users integer NOT NULL DEFAULT 0,
  accrued_users integer NOT NULL DEFAULT 0,
  total_eligible_seconds numeric(24, 6) NOT NULL DEFAULT 0,
  error_message text
);
GRANT SELECT ON public.mine_job_runs TO authenticated;
GRANT ALL ON public.mine_job_runs TO service_role;
ALTER TABLE public.mine_job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read mining job runs" ON public.mine_job_runs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX mine_job_runs_started ON public.mine_job_runs (started_at DESC);

CREATE OR REPLACE FUNCTION public.process_mining_accrual(_job_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_user record;
  v_account public.mine_accounts%ROWTYPE;
  v_from timestamptz;
  v_to timestamptz;
  v_seconds numeric(22, 6);
  v_referrals integer;
  v_multiplier integer;
  v_rate numeric(12, 4);
  v_reward numeric(24, 8);
  v_processed integer := 0;
  v_accrued integer := 0;
  v_total_seconds numeric(24, 6) := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(20261111, 500) THEN
    RETURN jsonb_build_object('status', 'busy', 'processed_users', 0, 'accrued_users', 0, 'eligible_seconds', 0);
  END IF;

  FOR v_user IN
    SELECT r.user_id, r.reviewed_at AS activated_at, u.last_sign_in_at
      FROM public.mining_activator_requests r
      JOIN auth.users u ON u.id = r.user_id
     WHERE r.status = 'approved'
       AND r.reviewed_at IS NOT NULL
       AND u.last_sign_in_at IS NOT NULL
       AND u.last_sign_in_at >= v_now - interval '24 hours'
  LOOP
    v_processed := v_processed + 1;
    INSERT INTO public.mine_accounts (user_id) VALUES (v_user.user_id)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_account FROM public.mine_accounts WHERE user_id = v_user.user_id FOR UPDATE;

    v_from := GREATEST(COALESCE(v_account.last_accrued_at, v_user.last_sign_in_at), v_user.last_sign_in_at, v_user.activated_at);
    v_to := LEAST(v_now, v_user.last_sign_in_at + interval '24 hours');
    v_seconds := GREATEST(EXTRACT(epoch FROM (v_to - v_from)), 0)::numeric(22, 6);
    IF v_seconds > 0 THEN
      SELECT count(*)::integer INTO v_referrals
        FROM public.referrals ref
        JOIN public.mining_activator_requests qualified
          ON qualified.user_id = ref.child_user AND qualified.status = 'approved'
       WHERE ref.parent_user = v_user.user_id AND ref.depth = 1;
      v_multiplier := 1 + floor(v_referrals / 10.0)::integer;
      v_rate := 1.78 * v_multiplier;
      v_reward := round(v_rate * v_seconds / 3600.0, 8);

      IF v_reward > 0 THEN
        INSERT INTO public.mine_accruals (
          user_id, job_run_id, period_start, period_end, eligible_seconds,
          qualified_referrals, speed_multiplier, mine_amount
        ) VALUES (
          v_user.user_id, _job_run_id, v_from, v_to, v_seconds,
          v_referrals, v_multiplier, v_reward
        );
        UPDATE public.mine_accounts
           SET mine_balance = mine_balance + v_reward,
               eligible_seconds = eligible_seconds + v_seconds,
               last_accrued_at = v_to,
               updated_at = v_now
         WHERE user_id = v_user.user_id;
        v_accrued := v_accrued + 1;
        v_total_seconds := v_total_seconds + v_seconds;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'succeeded',
    'processed_users', v_processed,
    'accrued_users', v_accrued,
    'eligible_seconds', v_total_seconds
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.process_mining_accrual(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_mining_accrual(uuid) TO service_role;