-- ============== ENUMS ==============
create type public.app_role as enum ('admin', 'moderator', 'user');
create type public.txn_type as enum ('reward', 'upgrade', 'withdrawal', 'referral', 'checkin');
create type public.txn_status as enum ('pending', 'approved', 'rejected', 'completed');
create type public.task_type as enum ('checkin', 'watch', 'spin');

-- ============== PROFILES ==============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  balance numeric(12,2) not null default 0,
  locked_balance numeric(12,2) not null default 0,
  total_earnings numeric(12,2) not null default 0,
  level int not null default 0,
  referral_code text unique not null,
  referred_by uuid references public.profiles(id),
  last_checkin timestamptz,
  daily_earned numeric(12,2) not null default 0,
  daily_earned_date date,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ============== USER ROLES ==============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin')
$$;

-- ============== TRANSACTIONS ==============
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type txn_type not null,
  amount numeric(12,2) not null,
  status txn_status not null default 'pending',
  proof_url text,
  payment_method text,
  target_level int,
  notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;

-- ============== TASKS LOG ==============
create table public.tasks_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_type task_type not null,
  reward numeric(12,2) not null,
  completed_at timestamptz not null default now()
);
alter table public.tasks_log enable row level security;
create index tasks_log_user_time on public.tasks_log(user_id, completed_at desc);

-- ============== WITHDRAWALS ==============
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  status txn_status not null default 'pending',
  payout_method text not null,
  payout_details text not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  notes text
);
alter table public.withdrawals enable row level security;

-- ============== REFERRALS ==============
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  parent_user uuid not null references auth.users(id) on delete cascade,
  child_user uuid not null references auth.users(id) on delete cascade,
  depth int not null check (depth in (1,2)),
  created_at timestamptz not null default now(),
  unique (parent_user, child_user)
);
alter table public.referrals enable row level security;

-- ============== APP SETTINGS ==============
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

insert into public.app_settings (key, value) values
('level_prices', '{"1": 25, "2": 50, "3": 100}'::jsonb),
('checkin_rewards', '{"0": 0.10, "1": 0.50, "2": 1.20, "3": 3.00}'::jsonb),
('task_rewards', '{"watch": {"0": 0, "1": 0.20, "2": 0.50, "3": 1.00}, "spin": {"0": 0, "1": 0.30, "2": 0.75, "3": 1.50}}'::jsonb),
('daily_task_limits', '{"watch": 10, "spin": 5}'::jsonb),
('daily_earning_caps', '{"0": 0.10, "1": 5, "2": 15, "3": 40}'::jsonb),
('daily_withdrawal_caps', '{"0": 0, "1": 50, "2": 200, "3": 500}'::jsonb),
('min_withdrawal', '50'::jsonb),
('referral_commission', '{"l1": 0.10, "l2": 0.03}'::jsonb),
('payment_instructions', '{"bank": "Bank: Monetra Holdings\nAcct: 0123456789\nRouting: 011000015", "crypto": "USDT (TRC20): TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", "mobile_money": "MoMo: +1 555 010 2024"}'::jsonb);

-- ============== POLICIES ==============
-- profiles
create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "admins read all profiles" on public.profiles for select using (public.is_admin(auth.uid()));
create policy "admins update all profiles" on public.profiles for update using (public.is_admin(auth.uid()));

-- user_roles
create policy "users read own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "admins manage roles" on public.user_roles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- transactions
create policy "users read own txns" on public.transactions for select using (auth.uid() = user_id);
create policy "users insert own upgrade txns" on public.transactions for insert with check (auth.uid() = user_id and type = 'upgrade');
create policy "admins read all txns" on public.transactions for select using (public.is_admin(auth.uid()));
create policy "admins update txns" on public.transactions for update using (public.is_admin(auth.uid()));
create policy "admins insert txns" on public.transactions for insert with check (public.is_admin(auth.uid()));

-- tasks_log
create policy "users read own task logs" on public.tasks_log for select using (auth.uid() = user_id);
create policy "admins read all task logs" on public.tasks_log for select using (public.is_admin(auth.uid()));

-- withdrawals
create policy "users read own withdrawals" on public.withdrawals for select using (auth.uid() = user_id);
create policy "admins read all withdrawals" on public.withdrawals for select using (public.is_admin(auth.uid()));
create policy "admins update withdrawals" on public.withdrawals for update using (public.is_admin(auth.uid()));

-- referrals
create policy "users read own referrals" on public.referrals for select using (auth.uid() = parent_user or auth.uid() = child_user);
create policy "admins read all referrals" on public.referrals for select using (public.is_admin(auth.uid()));

-- app_settings
create policy "anyone read settings" on public.app_settings for select using (true);
create policy "admins update settings" on public.app_settings for update using (public.is_admin(auth.uid()));
create policy "admins insert settings" on public.app_settings for insert with check (public.is_admin(auth.uid()));

-- ============== TRIGGERS ==============
create or replace function public.gen_referral_code()
returns text language plpgsql as $$
declare code text; exists_count int;
begin
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    select count(*) into exists_count from public.profiles where referral_code = code;
    exit when exists_count = 0;
  end loop;
  return code;
end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref_code text := public.gen_referral_code();
  v_referrer_id uuid;
  v_input_ref text;
  v_grandparent uuid;
begin
  v_input_ref := nullif(upper(coalesce(new.raw_user_meta_data->>'referral_code', '')), '');

  if v_input_ref is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_input_ref limit 1;
  end if;

  insert into public.profiles (id, email, full_name, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_ref_code,
    v_referrer_id
  );

  insert into public.user_roles (user_id, role) values (new.id, 'user');

  if v_referrer_id is not null then
    insert into public.referrals (parent_user, child_user, depth) values (v_referrer_id, new.id, 1);
    select referred_by into v_grandparent from public.profiles where id = v_referrer_id;
    if v_grandparent is not null then
      insert into public.referrals (parent_user, child_user, depth) values (v_grandparent, new.id, 2);
    end if;
  end if;

  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============== STORAGE: proofs bucket (private) ==============
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "users upload own proofs" on storage.objects for insert
  with check (bucket_id = 'proofs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users read own proofs" on storage.objects for select
  using (bucket_id = 'proofs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "admins read all proofs" on storage.objects for select
  using (bucket_id = 'proofs' and public.is_admin(auth.uid()));