-- Tile/section unlocks (per-user, paid from balance)
CREATE TABLE IF NOT EXISTS public.tile_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tile_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  fee_paid numeric NOT NULL DEFAULT 0,
  UNIQUE (user_id, tile_id)
);

ALTER TABLE public.tile_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own unlocks" ON public.tile_unlocks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins read all unlocks" ON public.tile_unlocks
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage unlocks" ON public.tile_unlocks
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Admin-managed task catalog (auto-rotates to next when completed)
CREATE TABLE IF NOT EXISTS public.task_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'watch',
  reward numeric NOT NULL DEFAULT 0,
  min_level int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read active tasks" ON public.task_catalog
  FOR SELECT USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage catalog" ON public.task_catalog
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Per-user completion log for catalog tasks (so the "next" task auto-rotates)
CREATE TABLE IF NOT EXISTS public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  catalog_id uuid NOT NULL REFERENCES public.task_catalog(id) ON DELETE CASCADE,
  reward numeric NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, catalog_id)
);

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own completions" ON public.task_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins read all completions" ON public.task_completions
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Default tile unlock fees (settings)
INSERT INTO public.app_settings (key, value)
VALUES (
  'tile_unlock_fees',
  '{"hookup": 2.50, "vip": 5.00, "creator": 5.00}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Tier auto-unlock policy: which tiles are unlocked for free at each level
-- Silver (1) unlocks all premium tiles except "vip"; Gold (2) unlocks all; Platinum (3) unlocks all.
INSERT INTO public.app_settings (key, value)
VALUES (
  'tier_tile_unlocks',
  '{"1": ["hookup", "creator"], "2": ["hookup", "vip", "creator"], "3": ["hookup", "vip", "creator"]}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Seed a couple of admin tasks so the catalog isn't empty
INSERT INTO public.task_catalog (title, description, task_type, reward, min_level, sort_order)
SELECT * FROM (VALUES
  ('Watch sponsor video #1', 'Watch a 30s sponsor clip and get rewarded.', 'watch', 0.10, 1, 1),
  ('Spin the daily wheel', 'Take a free spin to win a small bonus.', 'spin', 0.15, 1, 2),
  ('Watch sponsor video #2', 'Another quick clip — keep the streak going.', 'watch', 0.12, 1, 3)
) AS t(title, description, task_type, reward, min_level, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.task_catalog);
