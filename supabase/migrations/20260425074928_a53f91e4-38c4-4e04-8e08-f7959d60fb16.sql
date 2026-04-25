
-- 1. Default lock setting (admins can edit later from app_settings)
INSERT INTO public.app_settings (key, value)
VALUES ('withdrawal_lock_days', to_jsonb(5))
ON CONFLICT (key) DO NOTHING;

-- 2. Track the last deposit (approved upgrade) per profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_deposit_at timestamptz;

-- 3. Trigger fn: when an upgrade transaction flips to approved/completed, stamp profile.
CREATE OR REPLACE FUNCTION public.stamp_last_deposit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'upgrade'
     AND NEW.status IN ('approved', 'completed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    UPDATE public.profiles
       SET last_deposit_at = now(),
           updated_at = now()
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_last_deposit_ins ON public.transactions;
DROP TRIGGER IF EXISTS trg_stamp_last_deposit_upd ON public.transactions;

CREATE TRIGGER trg_stamp_last_deposit_ins
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.stamp_last_deposit();

CREATE TRIGGER trg_stamp_last_deposit_upd
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.stamp_last_deposit();

-- 4. Backfill last_deposit_at from existing approved upgrades
UPDATE public.profiles p
   SET last_deposit_at = sub.t
  FROM (
    SELECT user_id, MAX(reviewed_at) AS t
      FROM public.transactions
     WHERE type = 'upgrade' AND status IN ('approved','completed')
  GROUP BY user_id
  ) sub
 WHERE sub.user_id = p.id
   AND p.last_deposit_at IS NULL;
