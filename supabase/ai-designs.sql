-- ---------------------------------------------------------------------
-- AI card designs: a per-user allowance of AI "tries" (one try = one
-- batch of up to 4 painted backgrounds). New users get 3 free tries.
-- To give someone more (for example after they buy a plan), raise
-- tries_limit for their row, or change the default below.
-- Only the generate-card-art Edge Function (service role) can take or
-- refund a try. Users can only read their own allowance.
-- ---------------------------------------------------------------------
create table if not exists public.ai_credits (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  plan        text not null default 'free',
  tries_limit int  not null default 3 check (tries_limit >= 0),
  tries_used  int  not null default 0 check (tries_used >= 0),
  updated_at  timestamptz not null default now()
);
alter table public.ai_credits enable row level security;
drop policy if exists ai_credits_own_read on public.ai_credits;
create policy ai_credits_own_read on public.ai_credits for select to authenticated using (user_id = auth.uid());

-- every AI request, for keeping an eye on cost
create table if not exists public.ai_generations (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  style      text,
  provider   text,
  images     int not null default 0,
  ok         boolean not null default true,
  prompt     text,
  created_at timestamptz not null default now()
);
create index if not exists ai_generations_user_idx on public.ai_generations(user_id, created_at desc);
alter table public.ai_generations enable row level security;  -- no policies: dashboard / service role only

-- what the signed-in user has left (creates their free row on first look)
create or replace function public.my_ai_credits() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.ai_credits;
begin
  if auth.uid() is null then return jsonb_build_object('used', 0, 'limit', 0, 'left', 0, 'plan', 'none'); end if;
  insert into public.ai_credits(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into r from public.ai_credits where user_id = auth.uid();
  return jsonb_build_object('used', r.tries_used, 'limit', r.tries_limit, 'left', greatest(0, r.tries_limit - r.tries_used), 'plan', r.plan);
end $$;

-- atomically take one try; ok=false when the allowance is used up
create or replace function public.ai_take_try(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.ai_credits;
begin
  insert into public.ai_credits(user_id) values (p_user) on conflict (user_id) do nothing;
  update public.ai_credits set tries_used = tries_used + 1, updated_at = now()
    where user_id = p_user and tries_used < tries_limit returning * into r;
  if not found then
    select * into r from public.ai_credits where user_id = p_user;
    return jsonb_build_object('ok', false, 'used', r.tries_used, 'limit', r.tries_limit);
  end if;
  return jsonb_build_object('ok', true, 'used', r.tries_used, 'limit', r.tries_limit);
end $$;

create or replace function public.ai_refund_try(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.ai_credits set tries_used = greatest(0, tries_used - 1), updated_at = now() where user_id = p_user;
$$;

create or replace function public.ai_log(p_user uuid, p_style text, p_provider text, p_images int, p_ok boolean, p_prompt text) returns void
language sql security definer set search_path = public as $$
  insert into public.ai_generations(user_id, style, provider, images, ok, prompt) values (p_user, p_style, p_provider, p_images, p_ok, left(p_prompt, 2000));
$$;

revoke all on function public.ai_take_try(uuid) from public, anon, authenticated;
revoke all on function public.ai_refund_try(uuid) from public, anon, authenticated;
revoke all on function public.ai_log(uuid,text,text,int,boolean,text) from public, anon, authenticated;
revoke all on function public.my_ai_credits() from public, anon;
grant execute on function public.my_ai_credits() to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ai_take_try(uuid) to service_role;
    grant execute on function public.ai_refund_try(uuid) to service_role;
    grant execute on function public.ai_log(uuid,text,text,int,boolean,text) to service_role;
  end if;
end $$;
