-- Add new settings
insert into public.app_settings (key, value) values
  ('daily_referral_cap', '{"0": 0, "1": 10, "2": 30, "3": 80}'::jsonb),
  ('admin_invite_code', to_jsonb(upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12))))
on conflict (key) do nothing;

-- Bootstrap: first signed-in user can claim admin if no admin exists
create or replace function public.bootstrap_first_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into admin_count from public.user_roles where role = 'admin';
  if admin_count > 0 then
    return false;
  end if;

  insert into public.user_roles (user_id, role) values (uid, 'admin')
  on conflict (user_id, role) do nothing;
  return true;
end;
$$;

-- Claim admin with invite code
create or replace function public.claim_admin_with_code(_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stored text;
  new_code text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if _code is null or length(trim(_code)) = 0 then
    return false;
  end if;

  select trim(both '"' from value::text) into stored
    from public.app_settings where key = 'admin_invite_code';

  if stored is null or stored <> upper(trim(_code)) then
    return false;
  end if;

  insert into public.user_roles (user_id, role) values (uid, 'admin')
  on conflict (user_id, role) do nothing;

  -- rotate code so it's single-use
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
  update public.app_settings
    set value = to_jsonb(new_code), updated_at = now()
    where key = 'admin_invite_code';

  return true;
end;
$$;

grant execute on function public.bootstrap_first_admin() to authenticated;
grant execute on function public.claim_admin_with_code(text) to authenticated;