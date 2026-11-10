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
  last_rewarded_at timestamptz,
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
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
do $
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


-- Bot configuration is deliberately disabled until the reward asset, rate and
-- independently reconciled trading proceeds are configured by the operator.
create table if not exists public.mining_bot_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  reward_asset_symbol text,
  base_coins_per_hour numeric(28,12) not null default 0 check (base_coins_per_hour >= 0),
  reward_coin_price_usd numeric(18,8) not null default 0 check (reward_coin_price_usd >= 0),
  updated_at timestamptz not null default now(),
  check (not enabled or (
    reward_asset_symbol is not null
    and length(trim(reward_asset_symbol)) between 1 and 16
    and base_coins_per_hour > 0
    and reward_coin_price_usd > 0
  ))
);
insert into public.mining_bot_config(singleton, enabled)
values (true, false)
on conflict (singleton) do nothing;
alter table public.mining_bot_config enable row level security;
create policy "admins read mining bot config" on public.mining_bot_config
  for select to authenticated using (public.is_admin(auth.uid()));

-- Atomic server-side reward worker. It can only credit coins against confirmed
-- realized trading proceeds and is a no-op until a valid bot configuration exists.
create or replace function app_private.process_mining_reward_cycle()
returns integer
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_config public.mining_bot_config%rowtype;
  v_activity record;
  v_work record;
  v_funding record;
  v_referrals integer;
  v_multiplier numeric(8,2);
  v_start timestamptz;
  v_end timestamptz;
  v_seconds integer;
  v_requested_coins numeric(28,12);
  v_requested_usd numeric(28,8);
  v_total_requested_usd numeric(28,8);
  v_total_available_usd numeric(28,8);
  v_scale numeric(28,12);
  v_remaining_usd numeric(28,8);
  v_take_usd numeric(28,8);
  v_coins numeric(28,12);
  v_processed integer := 0;
  v_now timestamptz := now();
begin
  select * into v_config
    from public.mining_bot_config
   where singleton = true;
  if not found or not v_config.enabled
     or v_config.base_coins_per_hour <= 0
     or v_config.reward_coin_price_usd <= 0
     or v_config.reward_asset_symbol is null then
    return 0;
  end if;

  create temporary table if not exists mining_cycle_work (
    user_id uuid,
    start_at timestamptz,
    end_at timestamptz,
    eligible_seconds integer,
    applied_multiplier numeric(8,2),
    requested_usd numeric(28,8)
  ) on commit drop;
  truncate table pg_temp.mining_cycle_work;

  -- Lock all eligible accounts first, then calculate their share of this cycle.
  for v_activity in
    select ma.user_id, ma.last_sign_in_at, ma.eligible_until, ma.last_rewarded_at
      from public.mining_activity ma
     where ma.last_sign_in_at is not null
       and ma.eligible_until is not null
       and (ma.last_rewarded_at is null or ma.last_rewarded_at < ma.eligible_until)
       and exists (
         select 1 from public.mining_activations a
          where a.user_id = ma.user_id and a.status = 'confirmed'
       )
     order by ma.last_rewarded_at nulls first, ma.user_id
     for update of ma skip locked
  loop
    v_start := greatest(
      coalesce(v_activity.last_rewarded_at, v_activity.last_sign_in_at),
      v_activity.last_sign_in_at
    );
    v_end := least(v_now, v_activity.eligible_until);
    v_seconds := greatest(0, floor(extract(epoch from (v_end - v_start)))::integer);

    if v_seconds <= 0 then
      continue;
    end if;

    select count(*)::integer into v_referrals
      from public.referral_qualifications
     where referrer_id = v_activity.user_id;
    v_multiplier := greatest(1, floor(v_referrals::numeric / 10) + 1);

    v_requested_coins :=
      v_config.base_coins_per_hour * (v_seconds::numeric / 3600) * v_multiplier;
    v_requested_usd := v_requested_coins * v_config.reward_coin_price_usd;

    insert into pg_temp.mining_cycle_work (
      user_id, start_at, end_at, eligible_seconds, applied_multiplier, requested_usd
    ) values (
      v_activity.user_id, v_start, v_end, v_seconds, v_multiplier, v_requested_usd
    );
  end loop;

  select coalesce(sum(requested_usd), 0)
    into v_total_requested_usd
    from pg_temp.mining_cycle_work;
  select coalesce(sum(available_usd), 0)
    into v_total_available_usd
    from public.mining_reward_funding
   where status = 'confirmed' and available_usd > 0;

  if v_total_requested_usd <= 0 or v_total_available_usd <= 0 then
    return 0;
  end if;

  -- Share limited proceeds proportionally across all eligible users; no
  -- account gets priority merely because its UUID sorts first.
  v_scale := least(1, v_total_available_usd / v_total_requested_usd);

  for v_work in
    select * from pg_temp.mining_cycle_work order by user_id
  loop
    v_remaining_usd := round(v_work.requested_usd * v_scale, 8);

    for v_funding in
      select id, available_usd
        from public.mining_reward_funding
       where status = 'confirmed' and available_usd > 0
       order by realized_at, id
       for update skip locked
    loop
      exit when v_remaining_usd <= 0;
      v_take_usd := least(v_funding.available_usd, v_remaining_usd);
      if v_take_usd <= 0 then continue; end if;
      v_coins := v_take_usd / v_config.reward_coin_price_usd;

      update public.mining_reward_funding
         set available_usd = available_usd - v_take_usd,
             status = case when available_usd - v_take_usd <= 0 then 'exhausted' else 'confirmed' end
       where id = v_funding.id;

      insert into public.mining_rewards (
        user_id, asset_symbol, amount, funding_id, idempotency_key,
        eligible_seconds, applied_multiplier, base_rate
      ) values (
        v_work.user_id,
        v_config.reward_asset_symbol,
        v_coins,
        v_funding.id,
        concat(v_work.user_id, ':', v_work.start_at, ':', v_work.end_at, ':', v_funding.id),
        v_work.eligible_seconds,
        v_work.applied_multiplier,
        v_config.base_coins_per_hour
      )
      on conflict (idempotency_key) do nothing;

      v_remaining_usd := v_remaining_usd - v_take_usd;
    end loop;

    update public.mining_activity
       set last_rewarded_at = v_work.end_at,
           status = case when eligible_until <= v_now then 'paused' else 'active' end,
           paused_at = case when eligible_until <= v_now then coalesce(paused_at, eligible_until) else null end,
           updated_at = v_now
     where user_id = v_work.user_id;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;
revoke all on function app_private.process_mining_reward_cycle() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('process-automated-mining-rewards');
    exception when others then
      null;
    end;
    perform cron.schedule(
      'process-automated-mining-rewards',
      '*/5 * * * *',
      'select app_private.process_mining_reward_cycle();'
    );
  end if;
end;
$$;
