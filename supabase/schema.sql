-- =====================================================================
-- InviteX – Supabase / PostgreSQL schema, Row Level Security and API
-- Run this whole file once in Supabase Dashboard > SQL Editor.
-- The frontend only ever uses the public ANON key. Hosts are protected
-- by RLS (owner_id = auth.uid()); guests never touch tables directly –
-- they call the SECURITY DEFINER functions at the bottom, which expose
-- only what a guest is allowed to see or do.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  slug           text unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$'),
  status         text not null default 'draft' check (status in ('draft','published')),
  data           jsonb not null default '{}'::jsonb,   -- host's working copy (draft)
  published      jsonb,                                 -- snapshot guests see
  published_at   timestamptz,
  rsvp_enabled   boolean not null default true,
  rsvp_deadline  date,
  expires_at     date,
  max_total      int not null default 0 check (max_total >= 0),
  max_per_invite int not null default 0 check (max_per_invite >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists invitations_owner_idx on public.invitations(owner_id);

-- Password hashes live in their own table with RLS enabled and NO policies,
-- so no client (not even the owner) can ever read them. Only the
-- SECURITY DEFINER functions below touch this table.
create table if not exists public.invitation_secrets (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  password_hash text not null
);
alter table public.invitation_secrets enable row level security;

create table if not exists public.guests (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  phone         text check (phone is null or char_length(phone) <= 20),
  email         text check (email is null or char_length(email) <= 160),
  group_name    text default '',
  allowed       int not null default 0 check (allowed between 0 and 50),
  token         text not null unique default encode(gen_random_bytes(12), 'hex'),
  notes         text default '',
  sent_at       timestamptz,
  reminded_at   timestamptz,
  opened_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists guests_inv_idx on public.guests(invitation_id);

create table if not exists public.rsvps (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid not null references public.invitations(id) on delete cascade,
  guest_id        uuid references public.guests(id) on delete set null,
  ref             text not null unique,
  name            text not null check (char_length(name) between 2 and 120),
  phone           text not null check (char_length(phone) <= 20),
  phone_norm      text not null default '',
  email           text check (email is null or char_length(email) <= 160),
  status          text not null check (status in ('yes','no','maybe')),
  adults          int not null default 0 check (adults between 0 and 50),
  children        int not null default 0 check (children between 0 and 50),
  extra_names     text default '' check (char_length(extra_names) <= 500),
  food            text default '' check (food in ('','veg','nonveg','jain','vegan','other')),
  requirements    text default '' check (char_length(requirements) <= 500),
  message         text default '' check (char_length(message) <= 1000),
  event_ids       text[] not null default '{}',
  lang            text default 'en',
  consent         boolean not null default false,
  edit_token_hash text,
  source          text not null default 'guest',
  checked_in_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists rsvps_inv_idx on public.rsvps(invitation_id);
-- one RSVP per personal invite, and one per mobile number per invitation (duplicate prevention)
create unique index if not exists rsvps_one_per_guest on public.rsvps(invitation_id, guest_id) where guest_id is not null;
create unique index if not exists rsvps_one_per_phone on public.rsvps(invitation_id, phone_norm) where phone_norm <> '';

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists t_inv_touch on public.invitations;
create trigger t_inv_touch before update on public.invitations for each row execute function public.touch_updated_at();
drop trigger if exists t_rsvp_touch on public.rsvps;
create trigger t_rsvp_touch before update on public.rsvps for each row execute function public.touch_updated_at();

-- normalise phone numbers (default country code 91 for 10-digit numbers)
create or replace function public.norm_phone(p text) returns text language sql immutable as $$
  select case
    when length(d) = 10 then '91' || d
    when length(d) = 11 and left(d,1) = '0' then '91' || substr(d,2)
    else d end
  from (select regexp_replace(coalesce(p,''), '\D', '', 'g') as d) x
$$;
create or replace function public.rsvp_norm() returns trigger language plpgsql as $$
begin new.phone_norm := public.norm_phone(new.phone); return new; end $$;
drop trigger if exists t_rsvp_norm on public.rsvps;
create trigger t_rsvp_norm before insert or update of phone on public.rsvps for each row execute function public.rsvp_norm();

-- ---------------------------------------------------------------------
-- Row Level Security: hosts see and change only their own data.
-- Anonymous users get NO table access at all.
-- ---------------------------------------------------------------------
alter table public.invitations enable row level security;
alter table public.guests      enable row level security;
alter table public.rsvps       enable row level security;

drop policy if exists inv_owner_all on public.invitations;
create policy inv_owner_all on public.invitations for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists guests_owner_all on public.guests;
create policy guests_owner_all on public.guests for all to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

drop policy if exists rsvps_owner_all on public.rsvps;
create policy rsvps_owner_all on public.rsvps for all to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = auth.uid()));


-- ---------------------------------------------------------------------
-- Guest-facing API (SECURITY DEFINER = runs with table owner rights,
-- but each function validates everything and returns only safe fields)
-- ---------------------------------------------------------------------

create or replace function public.slug_available(p_slug text, p_except uuid default null)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (select 1 from invitations where slug = lower(p_slug) and (p_except is null or id <> p_except));
$$;

create or replace function public.set_invitation_password(p_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from invitations where id = p_id and owner_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  if p_password is null or p_password = '' then
    delete from invitation_secrets where invitation_id = p_id;
  else
    insert into invitation_secrets(invitation_id, password_hash) values (p_id, crypt(p_password, gen_salt('bf')))
    on conflict (invitation_id) do update set password_hash = excluded.password_hash;
  end if;
end $$;

create or replace function public.get_public_invitation(p_slug text, p_password text default null, p_guest_token text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare inv invitations; g guests; v_hash text;
begin
  select * into inv from invitations where slug = lower(p_slug) and status = 'published' and published is not null;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if inv.expires_at is not null and inv.expires_at < current_date then
    return jsonb_build_object('status','expired','title', inv.published #>> '{text,en,title}');
  end if;
  select password_hash into v_hash from invitation_secrets where invitation_id = inv.id;
  if v_hash is not null then
    if p_password is null then return jsonb_build_object('status','password_required'); end if;
    if crypt(p_password, v_hash) <> v_hash then return jsonb_build_object('status','wrong_password'); end if;
  end if;
  if p_guest_token is not null then
    select * into g from guests where token = p_guest_token and invitation_id = inv.id;
    if found and g.opened_at is null then update guests set opened_at = now() where id = g.id; end if;
  end if;
  return jsonb_build_object(
    'status','ok',
    'invitation', inv.published || jsonb_build_object('id', inv.id, 'slug', inv.slug),
    'guest', case when g.id is null then null else jsonb_build_object('name', g.name, 'phone', g.phone, 'email', g.email, 'allowed', g.allowed) end
  );
end $$;

create or replace function public.get_rsvp_by_edit_token(p_slug text, p_edit_token text)
returns jsonb language sql security definer set search_path = public, extensions stable as $$
  select to_jsonb(x) from (
    select r.ref, r.name, r.phone, r.email, r.status, r.adults, r.children, r.extra_names as "extraNames",
           r.food, r.requirements, r.message, r.event_ids as "eventIds", r.consent, r.lang
      from rsvps r join invitations i on i.id = r.invitation_id
     where i.slug = lower(p_slug) and r.edit_token_hash = encode(digest(p_edit_token, 'sha256'), 'hex')
  ) x;
$$;

create or replace function public.submit_rsvp(p_slug text, p_payload jsonb, p_password text default null,
                                             p_guest_token text default null, p_edit_token text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  inv invitations; g guests; existing rsvps;
  v_status text := p_payload->>'status';
  v_adults int := least(greatest(coalesce((p_payload->>'adults')::int, 0), 0), 50);
  v_children int := least(greatest(coalesce((p_payload->>'children')::int, 0), 0), 50);
  v_heads int; v_limit int; v_used int; v_ref text; v_token text; v_phone text; v_hash text;
begin
  select * into inv from invitations where slug = lower(p_slug) and status = 'published';
  if not found then return jsonb_build_object('status','error','code','notFound'); end if;
  select password_hash into v_hash from invitation_secrets where invitation_id = inv.id;
  if v_hash is not null and (p_password is null or crypt(p_password, v_hash) <> v_hash) then
    return jsonb_build_object('status','error','code','wrongPassword'); end if;
  if not inv.rsvp_enabled or (inv.rsvp_deadline is not null and inv.rsvp_deadline < current_date)
     or (inv.expires_at is not null and inv.expires_at < current_date) then
    return jsonb_build_object('status','error','code','rsvpClosed'); end if;

  -- validation (mirrors the client)
  if v_status not in ('yes','no','maybe') then return jsonb_build_object('status','error','code','required'); end if;
  if char_length(trim(coalesce(p_payload->>'name',''))) < 2 then return jsonb_build_object('status','error','code','required'); end if;
  v_phone := norm_phone(p_payload->>'phone');
  if length(v_phone) < 10 or length(v_phone) > 15 then return jsonb_build_object('status','error','code','invalidPhone'); end if;
  if coalesce((p_payload->>'consent')::boolean, false) is not true then return jsonb_build_object('status','error','code','needConsent'); end if;
  if v_status = 'no' then v_adults := 0; v_children := 0; end if;
  v_heads := v_adults + v_children;
  if v_status = 'yes' and v_heads < 1 then return jsonb_build_object('status','error','code','needPeople'); end if;

  if p_guest_token is not null then select * into g from guests where token = p_guest_token and invitation_id = inv.id; end if;

  if p_edit_token is not null then
    select * into existing from rsvps where invitation_id = inv.id and edit_token_hash = encode(digest(p_edit_token, 'sha256'), 'hex');
    if not found then return jsonb_build_object('status','error','code','notFound'); end if;
  elsif exists (select 1 from rsvps where invitation_id = inv.id and ((g.id is not null and guest_id = g.id) or phone_norm = v_phone)) then
    return jsonb_build_object('status','error','code','duplicate');
  end if;

  v_limit := coalesce(nullif(g.allowed, 0), inv.max_per_invite);
  if v_status <> 'no' and v_limit > 0 and v_heads > v_limit then
    return jsonb_build_object('status','error','code','maxParty','n', v_limit); end if;
  if v_status = 'yes' and inv.max_total > 0 then
    select coalesce(sum(adults + children), 0) into v_used from rsvps
     where invitation_id = inv.id and status = 'yes' and (existing.id is null or id <> existing.id);
    if v_used + v_heads > inv.max_total then
      return jsonb_build_object('status','error','code','capacity','n', greatest(inv.max_total - v_used, 0)); end if;
  end if;

  if existing.id is not null then
    update rsvps set name = left(trim(p_payload->>'name'),120), phone = left(p_payload->>'phone',20), email = nullif(left(p_payload->>'email',160),''),
      status = v_status, adults = v_adults, children = v_children, extra_names = left(coalesce(p_payload->>'extraNames',''),500),
      food = coalesce(p_payload->>'food',''), requirements = left(coalesce(p_payload->>'requirements',''),500),
      message = left(coalesce(p_payload->>'message',''),1000), lang = coalesce(p_payload->>'lang','en'),
      event_ids = coalesce((select array_agg(x) from jsonb_array_elements_text(p_payload->'eventIds') x), '{}')
     where id = existing.id;
    return jsonb_build_object('status','ok','ref', existing.ref, 'editToken', p_edit_token, 'updated', true);
  end if;

  v_ref := 'IVX-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
  v_token := encode(gen_random_bytes(18), 'hex');
  insert into rsvps(invitation_id, guest_id, ref, name, phone, email, status, adults, children, extra_names, food,
                    requirements, message, event_ids, lang, consent, edit_token_hash)
  values (inv.id, g.id, v_ref, left(trim(p_payload->>'name'),120), left(p_payload->>'phone',20), nullif(left(p_payload->>'email',160),''),
          v_status, v_adults, v_children, left(coalesce(p_payload->>'extraNames',''),500), coalesce(p_payload->>'food',''),
          left(coalesce(p_payload->>'requirements',''),500), left(coalesce(p_payload->>'message',''),1000),
          coalesce((select array_agg(x) from jsonb_array_elements_text(p_payload->'eventIds') x), '{}'),
          coalesce(p_payload->>'lang','en'), true, encode(digest(v_token, 'sha256'), 'hex'));
  return jsonb_build_object('status','ok','ref', v_ref, 'editToken', v_token, 'updated', false);
exception when unique_violation then
  return jsonb_build_object('status','error','code','duplicate');
end $$;

-- only these functions are callable by anonymous guests
revoke all on function public.submit_rsvp(text,jsonb,text,text,text) from public;
revoke all on function public.get_public_invitation(text,text,text) from public;
revoke all on function public.get_rsvp_by_edit_token(text,text) from public;
revoke all on function public.set_invitation_password(uuid,text) from public;
revoke all on function public.slug_available(text,uuid) from public;
grant execute on function public.submit_rsvp(text,jsonb,text,text,text) to anon, authenticated;
grant execute on function public.get_public_invitation(text,text,text) to anon, authenticated;
grant execute on function public.get_rsvp_by_edit_token(text,text) to anon, authenticated;
grant execute on function public.set_invitation_password(uuid,text) to authenticated;
grant execute on function public.slug_available(text,uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: public-read bucket for invitation media; hosts may only
-- write inside a folder named after their own user id.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invite-media', 'invite-media', true, 41943040,
        array['image/jpeg','image/png','image/webp','audio/mpeg','video/mp4'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_owner_insert on storage.objects;
create policy media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'invite-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists media_owner_update on storage.objects;
create policy media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'invite-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists media_owner_delete on storage.objects;
create policy media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'invite-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists media_owner_select on storage.objects;
create policy media_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'invite-media' and (storage.foldername(name))[1] = auth.uid()::text);

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
