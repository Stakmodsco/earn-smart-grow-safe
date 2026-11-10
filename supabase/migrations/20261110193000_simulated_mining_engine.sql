-- Switch the reward engine to the requested in-app simulated mining model.
-- Credits are simulation units; no blockchain mining or market-price claim is made.

alter table public.mining_rewards
  alter column funding_id drop not null;

alter table public.mining_rewards
  add column if not exists reward_mode text not null default 'simulated'
  check (reward_mode in ('simulated', 'legacy_funded'));

update public.mining_rewards
   set reward_mode = 'legacy_funded'
 where funding_id is not null
   and reward_mode = 'simulated';

-- A modest, deterministic base rate: 0.05 MINE units/hour (1.2/day at 1x).
-- Referral tiers multiply this rate: +1x per 10 verified, activated referrals.
insert into public.mining_bot_config (
  singleton,
  enabled,
  reward_asset_symbol,
  base_coins_per_hour,
  reward_coin_price_usd,
  updated_at
) values (
  true,
  true,
  'MINE',
  0.05,
  0.01,
  now()
)
on conflict (singleton) do update
  set enabled = true,
      reward_asset_symbol = 'MINE',
      base_coins_per_hour = 0.05,
      reward_coin_price_usd = 0.01,
      updated_at = now();

create or replace function app_private.process_mining_reward_cycle()
returns integer
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_activity record;
  v_referrals integer;
  v_multiplier numeric(8,2);
  v_boundary record;
  v_segment_start timestamptz;
  v_segment_seconds integer;
  v_weighted_seconds numeric(28,8);
  v_effective_multiplier numeric(8,4);
  v_start timestamptz;
  v_end timestamptz;
  v_seconds integer;
  v_coins numeric(28,12);
  v_processed integer := 0;
  v_now timestamptz := now();
  v_config public.mining_bot_config%rowtype;
begin
  -- One worker at a time prevents duplicate credits from overlapping cron runs.
  if not pg_try_advisory_xact_lock(hashtextextended('process_mining_reward_cycle', 0)) then
    return 0;
  end if;

  select * into v_config
    from public.mining_bot_config
   where singleton = true;

  if not found or not v_config.enabled
     or v_config.base_coins_per_hour <= 0
     or coalesce(v_config.reward_asset_symbol, '') = '' then
    return 0;
  end if;

  for v_activity in
    select
      ma.user_id,
      ma.last_sign_in_at,
      ma.eligible_until,
      ma.last_rewarded_at,
      a.verified_at
    from public.mining_activity ma
    join public.mining_activations a
      on a.user_id = ma.user_id
     and a.status = 'confirmed'
     and a.verified_at is not null
    where ma.last_sign_in_at is not null
      and ma.eligible_until is not null
      and ma.eligible_until > ma.last_sign_in_at
      and (ma.last_rewarded_at is null or ma.last_rewarded_at < ma.eligible_until)
    order by ma.last_rewarded_at nulls first, ma.user_id
    for update of ma
  loop
    -- Never accrue before both verified activation and the user's latest sign-in.
    v_start := greatest(
      v_activity.last_sign_in_at,
      v_activity.verified_at,
      coalesce(v_activity.last_rewarded_at, v_activity.verified_at)
    );
    v_end := least(v_now, v_activity.eligible_until);
    v_seconds := greatest(0, floor(extract(epoch from (v_end - v_start)))::integer);

    if v_seconds <= 0 then
      if v_activity.eligible_until <= v_now then
        update public.mining_activity
           set status = 'paused',
               paused_at = coalesce(paused_at, eligible_until),
               updated_at = v_now
         where user_id = v_activity.user_id;
      end if;
      continue;
    end if;

    -- Apply each referral milestone only from the moment it qualified.
    -- This prevents a newly qualified referral from increasing earlier accrual.
    select count(*)::integer
      into v_referrals
      from public.referral_qualifications
     where referrer_id = v_activity.user_id
       and qualified_at <= v_start;

    v_multiplier := greatest(1, floor(v_referrals::numeric / 10) + 1);
    v_segment_start := v_start;
    v_weighted_seconds := 0;

    for v_boundary in
      with ranked_milestones as (
        select
          qualified_at,
          row_number() over (order by qualified_at, id) as milestone_number
        from public.referral_qualifications
        where referrer_id = v_activity.user_id
      )
      select qualified_at, count(*)::integer as multiplier_increments
        from ranked_milestones
       where milestone_number % 10 = 0
         and qualified_at > v_start
         and qualified_at <= v_end
       group by qualified_at
       order by qualified_at
    loop
      v_segment_seconds := greatest(
        0,
        floor(extract(epoch from (v_boundary.qualified_at - v_segment_start)))::integer
      );
      v_weighted_seconds := v_weighted_seconds
        + (v_segment_seconds::numeric * v_multiplier);
      v_segment_start := v_boundary.qualified_at;
      v_multiplier := v_multiplier + v_boundary.multiplier_increments;
    end loop;

    v_segment_seconds := greatest(
      0,
      floor(extract(epoch from (v_end - v_segment_start)))::integer
    );
    v_weighted_seconds := v_weighted_seconds
      + (v_segment_seconds::numeric * v_multiplier);
    v_effective_multiplier := v_weighted_seconds / greatest(v_seconds, 1);

    v_coins := round(
      v_config.base_coins_per_hour
      * (v_weighted_seconds / 3600),
      12
    );

    if v_coins > 0 then
      insert into public.mining_rewards (
        user_id,
        asset_symbol,
        amount,
        funding_id,
        idempotency_key,
        eligible_seconds,
        applied_multiplier,
        base_rate,
        reward_mode
      ) values (
        v_activity.user_id,
        v_config.reward_asset_symbol,
        v_coins,
        null,
        concat(
          'sim:',
          v_activity.user_id,
          ':',
          extract(epoch from v_start)::bigint,
          ':',
          extract(epoch from v_end)::bigint
        ),
        v_seconds,
        v_effective_multiplier,
        v_config.base_coins_per_hour,
        'simulated'
      )
      on conflict (idempotency_key) do nothing;
    end if;

    update public.mining_activity
       set last_rewarded_at = v_end,
           status = case when eligible_until <= v_now then 'paused' else 'active' end,
           paused_at = case
             when eligible_until <= v_now then coalesce(paused_at, eligible_until)
             else null
           end,
           updated_at = v_now
     where user_id = v_activity.user_id;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

revoke all on function app_private.process_mining_reward_cycle()
  from public, anon, authenticated;

do $cron$
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
$cron$;
