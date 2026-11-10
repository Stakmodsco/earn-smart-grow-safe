-- Automated mining activity, activation and reward ledger foundation.
-- Existing financial history is intentionally preserved; no legacy balance is converted.

create table if not exists public.mining_activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  amount_usd numeric(12,2) not null default 5 check (amount_usd = 5),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  payment_reference text unique,
  proof_path text,
  payment_method text,
  payment_country text,
  payment_notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'confirmed') or (payment_reference is not null and verified_at is not null))
);
alter table public.mining_activations enable row level security;
create policy "users read own mining activation" on public.mining_activations
  for select to authenticated using (auth.uid() = user_id);
create policy "admins read mining activations" on public.mining_activations
  for select to authenticated using (public.is_admin(auth.uid()));

create table if not exists public.mining_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_sign_in_at timestamptz,
  eligible_until timestamptz,
  status text not null default 'paused' check (status in ('active','paused')),
  paused_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status <> 'active') or (eligible_until is not null))
);
alter table public.mining_activity enable row level security;
create policy "users read own mining activity" on public.mining_activity
  for select to authenticated using (auth.uid() = user_id);
create policy "admins read mining activity" on public.mining_activity
  for select to authenticated using (public.is_admin(auth.uid()));

create table if not exists public.referral_qualifications (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  activation_id uuid not null unique references public.mining_activations(id) on delete cascade,
  qualified_at timestamptz not null default now(),
  check (referrer_id <> referred_user_id)
);
create index if not exists referral_qualifications_referrer_idx
  on public.referral_qualifications(referrer_id, qualified_at desc);
alter table public.referral_qualifications enable row level security;
create policy "users read own qualified referrals" on public.referral_qualifications
  for select to authenticated using (auth.uid() = referrer_id);
create policy "admins read qualified referrals" on public.referral_qualifications
  for select to authenticated using (public.is_admin(auth.uid()));

create table if not exists public.mining_speed_tiers (
  minimum_qualified_referrals integer primary key check (minimum_qualified_referrals >= 0),
  multiplier numeric(8,2) not null check (multiplier >= 1),
  created_at timestamptz not null default now()
);
insert into public.mining_speed_tiers (minimum_qualified_referrals, multiplier)
values (0,1),(10,2),(20,3),(30,4),(40,5),(50,6),(60,7),(70,8),(80,9),(90,10)
on conflict (minimum_qualified_referrals) do update set multiplier = excluded.multiplier;
alter table public.mining_speed_tiers enable row level security;
create policy "authenticated users read mining speed tiers" on public.mining_speed_tiers
  for select to authenticated using (true);

create table if not exists public.mining_reward_funding (
  id uuid primary key default gen_random_uuid(),
  realized_trade_reference text not null unique,
  realized_net_proceeds_usd numeric(18,8) not null check (realized_net_proceeds_usd > 0),
  available_usd numeric(18,8) not null check (available_usd >= 0 and available_usd <= realized_net_proceeds_usd),
  status text not null default 'confirmed' check (status in ('confirmed','exhausted','reversed')),
  realized_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.mining_reward_funding enable row level security;
create policy "admins read mining reward funding" on public.mining_reward_funding
  for select to authenticated using (public.is_admin(auth.uid()));

create table if not exists public.mining_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_symbol text not null,
  amount numeric(28,12) not null check (amount > 0),
  funding_id uuid not null references public.mining_reward_funding(id),
  idempotency_key text not null unique,
  eligible_seconds integer not null check (eligible_seconds > 0),
  applied_multiplier numeric(8,2) not null check (applied_multiplier >= 1),
  base_rate numeric(28,12) not null check (base_rate > 0),
  created_at timestamptz not null default now()
);
create index if not exists mining_rewards_user_created_idx
  on public.mining_rewards(user_id, created_at desc);
alter table public.mining_rewards enable row level security;
create policy "users read own mining rewards" on public.mining_rewards
  for select to authenticated using (auth.uid() = user_id);
create policy "admins read mining rewards" on public.mining_rewards
  for select to authenticated using (public.is_admin(auth.uid()));

create or replace view public.mining_reward_balances
with (security_invoker = true) as
select user_id, asset_symbol, sum(amount)::numeric(28,12) as balance
from public.mining_rewards
group by user_id, asset_symbol;
grant select on public.mining_reward_balances to authenticated;

create or replace function app_private.qualify_referral_after_activation()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare v_referrer uuid;
begin
  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select referred_by into v_referrer from public.profiles where id = new.user_id;
    if v_referrer is not null and v_referrer <> new.user_id then
      insert into public.referral_qualifications(referrer_id, referred_user_id, activation_id)
      values (v_referrer, new.user_id, new.id)
      on conflict (referred_user_id) do nothing;
    end if;

    update public.mining_activity
       set status = case
             when eligible_until > now() then 'active'
             else 'paused'
           end,
           paused_at = case when eligible_until > now() then null else coalesce(paused_at, now()) end,
           updated_at = now()
     where user_id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_qualify_referral_after_activation on public.mining_activations;
create trigger trg_qualify_referral_after_activation
after insert or update of status on public.mining_activations
for each row execute function app_private.qualify_referral_after_activation();

create or replace function app_private.pause_expired_mining()
returns integer
language plpgsql
security definer
set search_path = public, app_private
as $$
declare affected integer;
begin
  update public.mining_activity
     set status = 'paused',
         paused_at = coalesce(paused_at, eligible_until, now()),
         updated_at = now()
   where status = 'active'
     and eligible_until <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function app_private.qualify_referral_after_activation() from public, anon, authenticated;
revoke all on function app_private.pause_expired_mining() from public, anon, authenticated;

-- The signup trigger no longer credits the retired $20 welcome bonus.
-- Referral attribution and the existing user-role/profile creation are retained.
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_ref_code text := app_private.gen_referral_code();
  v_referrer_id uuid;
  v_input_ref text;
  v_grandparent uuid;
begin
  v_input_ref := nullif(upper(coalesce(new.raw_user_meta_data->>'referral_code', '')), '');
  if v_input_ref is not null then
    select id into v_referrer_id
      from public.profiles
     where referral_code = v_input_ref
     limit 1;
  end if;

  insert into public.profiles (
    id, email, full_name, referral_code, referred_by,
    balance, locked_balance, total_earnings, signup_bonus_credited
  ) values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_ref_code, v_referrer_id, 0, 0, 0, false
  );

  insert into public.user_roles (user_id, role) values (new.id, 'user');

  if v_referrer_id is not null then
    insert into public.referrals (parent_user, child_user, depth)
    values (v_referrer_id, new.id, 1);
    select referred_by into v_grandparent
      from public.profiles where id = v_referrer_id;
    if v_grandparent is not null then
      insert into public.referrals (parent_user, child_user, depth)
      values (v_grandparent, new.id, 2);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.handle_new_user() from public, anon, authenticated;

-- Install a database-side expiry worker. It does not depend on a browser being open.
create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('pause-expired-mining');
    exception when others then
      null;
    end;
    perform cron.schedule(
      'pause-expired-mining',
      '*/5 * * * *',
      'select app_private.pause_expired_mining();'
    );
  end if;
end;
$$;
