create or replace function public.gen_referral_code()
returns text
language plpgsql
security definer
set search_path = public
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