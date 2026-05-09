create schema if not exists app_private;

create or replace function app_private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function app_private.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select app_private.has_role(_user_id, 'admin') $$;

create or replace function app_private.gen_referral_code()
returns text language plpgsql security definer set search_path = public
as $$
declare code text; exists_count int;
begin
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    select count(*) into exists_count from public.profiles where referral_code = code;
    exit when exists_count = 0;
  end loop;
  return code;
end; $$;

create or replace function app_private.bootstrap_first_admin()
returns boolean language plpgsql security definer set search_path = public
as $$
declare admin_count int; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select count(*) into admin_count from public.user_roles where role = 'admin';
  if admin_count > 0 then return false; end if;
  insert into public.user_roles (user_id, role) values (uid, 'admin')
  on conflict (user_id, role) do nothing;
  return true;
end; $$;

create or replace function app_private.claim_admin_with_code(_code text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); stored text; new_code text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if _code is null or length(trim(_code)) = 0 then return false; end if;
  select trim(both '"' from value::text) into stored from public.app_settings where key = 'admin_invite_code';
  if stored is null or stored <> upper(trim(_code)) then return false; end if;
  insert into public.user_roles (user_id, role) values (uid, 'admin')
  on conflict (user_id, role) do nothing;
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
  update public.app_settings set value = to_jsonb(new_code), updated_at = now() where key = 'admin_invite_code';
  return true;
end; $$;

create or replace function app_private.stamp_last_deposit()
returns trigger language plpgsql security definer set search_path = public
as $$
BEGIN
  IF NEW.type = 'upgrade' AND NEW.status IN ('approved','completed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    UPDATE public.profiles SET last_deposit_at = now(), updated_at = now() WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END; $$;

create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_ref_code text := app_private.gen_referral_code();
  v_referrer_id uuid; v_input_ref text; v_grandparent uuid; v_bonus numeric := 20;
begin
  v_input_ref := nullif(upper(coalesce(new.raw_user_meta_data->>'referral_code', '')), '');
  if v_input_ref is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_input_ref limit 1;
  end if;
  insert into public.profiles (id, email, full_name, referral_code, referred_by, balance, locked_balance, total_earnings, signup_bonus_credited)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), v_ref_code, v_referrer_id, v_bonus, v_bonus, v_bonus, true);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.transactions (user_id, type, amount, status, notes)
  values (new.id, 'reward', v_bonus, 'completed', 'signup_bonus');
  if v_referrer_id is not null then
    insert into public.referrals (parent_user, child_user, depth) values (v_referrer_id, new.id, 1);
    select referred_by into v_grandparent from public.profiles where id = v_referrer_id;
    if v_grandparent is not null then
      insert into public.referrals (parent_user, child_user, depth) values (v_grandparent, new.id, 2);
    end if;
  end if;
  return new;
end; $$;

drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.is_admin(uuid) cascade;
drop function if exists public.bootstrap_first_admin() cascade;
drop function if exists public.claim_admin_with_code(text) cascade;
drop function if exists public.gen_referral_code() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.stamp_last_deposit() cascade;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security invoker set search_path = public, app_private
as $$ select app_private.has_role(_user_id, _role) $$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security invoker set search_path = public, app_private
as $$ select app_private.is_admin(_user_id) $$;

create or replace function public.bootstrap_first_admin()
returns boolean language sql security invoker set search_path = public, app_private
as $$ select app_private.bootstrap_first_admin() $$;

create or replace function public.claim_admin_with_code(_code text)
returns boolean language sql security invoker set search_path = public, app_private
as $$ select app_private.claim_admin_with_code(_code) $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_private.handle_new_user();

drop trigger if exists trg_stamp_last_deposit on public.transactions;
create trigger trg_stamp_last_deposit after insert or update on public.transactions
  for each row execute function app_private.stamp_last_deposit();

revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated;
revoke all on all functions in schema app_private from public;
grant execute on function app_private.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function app_private.is_admin(uuid) to anon, authenticated;
grant execute on function app_private.bootstrap_first_admin() to authenticated;
grant execute on function app_private.claim_admin_with_code(text) to authenticated;

-- Idempotently recreate every RLS policy that referenced public.is_admin/has_role
do $mig$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname in ('public','storage')
  loop
    null;
  end loop;
end $mig$;

-- app_settings
drop policy if exists "admins insert settings" on public.app_settings;
drop policy if exists "admins update settings" on public.app_settings;
drop policy if exists "anyone read settings" on public.app_settings;
create policy "admins insert settings" on public.app_settings for insert with check (public.is_admin(auth.uid()));
create policy "admins update settings" on public.app_settings for update using (public.is_admin(auth.uid()));
create policy "anyone read settings" on public.app_settings for select using (true);

-- captcha_challenges
drop policy if exists "admins read captcha" on public.captcha_challenges;
create policy "admins read captcha" on public.captcha_challenges for select using (public.is_admin(auth.uid()));

-- profiles
drop policy if exists "admins read all profiles" on public.profiles;
drop policy if exists "admins update all profiles" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
create policy "admins read all profiles" on public.profiles for select using (public.is_admin(auth.uid()));
create policy "admins update all profiles" on public.profiles for update using (public.is_admin(auth.uid()));
create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

-- referrals
drop policy if exists "admins read all referrals" on public.referrals;
drop policy if exists "users read own referrals" on public.referrals;
create policy "admins read all referrals" on public.referrals for select using (public.is_admin(auth.uid()));
create policy "users read own referrals" on public.referrals for select using ((auth.uid() = parent_user) or (auth.uid() = child_user));

-- signup_attempts
drop policy if exists "admins read signup_attempts" on public.signup_attempts;
create policy "admins read signup_attempts" on public.signup_attempts for select using (public.is_admin(auth.uid()));

-- support_tickets
drop policy if exists "Anyone can submit a ticket" on public.support_tickets;
drop policy if exists "Users view own tickets" on public.support_tickets;
drop policy if exists "Admins view all tickets" on public.support_tickets;
drop policy if exists "Admins update tickets" on public.support_tickets;
create policy "Users view own tickets" on public.support_tickets for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all tickets" on public.support_tickets for select to authenticated using (public.is_admin(auth.uid()));
create policy "Admins update tickets" on public.support_tickets for update to authenticated using (public.is_admin(auth.uid()));
create policy "Anyone can submit a ticket" on public.support_tickets for insert to anon, authenticated
  with check (
    length(message) between 1 and 5000
    and (subject is null or length(subject) <= 200)
    and (email is null or length(email) <= 320)
    and (array_length(attachments, 1) is null or array_length(attachments, 1) <= 10)
  );

-- task_catalog
drop policy if exists "admins manage catalog" on public.task_catalog;
drop policy if exists "anyone read active tasks" on public.task_catalog;
create policy "admins manage catalog" on public.task_catalog for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "anyone read active tasks" on public.task_catalog for select using ((active = true) or public.is_admin(auth.uid()));

-- task_completions
drop policy if exists "admins read all completions" on public.task_completions;
drop policy if exists "users read own completions" on public.task_completions;
create policy "admins read all completions" on public.task_completions for select using (public.is_admin(auth.uid()));
create policy "users read own completions" on public.task_completions for select using (auth.uid() = user_id);

-- tasks_log
drop policy if exists "admins read all task logs" on public.tasks_log;
drop policy if exists "users read own task logs" on public.tasks_log;
create policy "admins read all task logs" on public.tasks_log for select using (public.is_admin(auth.uid()));
create policy "users read own task logs" on public.tasks_log for select using (auth.uid() = user_id);

-- tile_unlocks
drop policy if exists "admins manage unlocks" on public.tile_unlocks;
drop policy if exists "admins read all unlocks" on public.tile_unlocks;
drop policy if exists "users read own unlocks" on public.tile_unlocks;
create policy "admins manage unlocks" on public.tile_unlocks for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admins read all unlocks" on public.tile_unlocks for select using (public.is_admin(auth.uid()));
create policy "users read own unlocks" on public.tile_unlocks for select using (auth.uid() = user_id);

-- transactions
drop policy if exists "admins insert txns" on public.transactions;
drop policy if exists "admins read all txns" on public.transactions;
drop policy if exists "admins update txns" on public.transactions;
drop policy if exists "users insert own upgrade txns" on public.transactions;
drop policy if exists "users read own txns" on public.transactions;
create policy "admins insert txns" on public.transactions for insert with check (public.is_admin(auth.uid()));
create policy "admins read all txns" on public.transactions for select using (public.is_admin(auth.uid()));
create policy "admins update txns" on public.transactions for update using (public.is_admin(auth.uid()));
create policy "users insert own upgrade txns" on public.transactions for insert with check ((auth.uid() = user_id) and (type = 'upgrade'::txn_type));
create policy "users read own txns" on public.transactions for select using (auth.uid() = user_id);

-- user_roles
drop policy if exists "admins manage roles" on public.user_roles;
drop policy if exists "users read own roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "users read own roles" on public.user_roles for select using (auth.uid() = user_id);

-- withdrawals
drop policy if exists "admins read all withdrawals" on public.withdrawals;
drop policy if exists "admins update withdrawals" on public.withdrawals;
drop policy if exists "users read own withdrawals" on public.withdrawals;
create policy "admins read all withdrawals" on public.withdrawals for select using (public.is_admin(auth.uid()));
create policy "admins update withdrawals" on public.withdrawals for update using (public.is_admin(auth.uid()));
create policy "users read own withdrawals" on public.withdrawals for select using (auth.uid() = user_id);

-- Storage: make support-attachments private, scope reads to owner+admin
update storage.buckets set public = false where id = 'support-attachments';
drop policy if exists "Anyone can read support attachments" on storage.objects;
drop policy if exists "Owner or admin reads support attachments" on storage.objects;
create policy "Owner or admin reads support attachments"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'support-attachments' and (
      public.is_admin(auth.uid())
      or (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );