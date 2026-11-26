-- =====================================================================
-- InviteX – in-app Admin page: roles, admin-only functions, activity log
--
-- Run this file ONCE in Supabase Dashboard > SQL Editor, AFTER schema.sql.
-- It is safe to run again (for example after an update).
--
-- How it stays secure
--   * The browser still uses only the public anon key. No service key.
--   * Each account has a row in public.profiles with a role ('host' or
--     'admin') and a status ('active' or 'suspended'). Users can read only
--     their own row and cannot change it.
--   * Admin screens never read tables directly. They call the admin_*
--     functions below. Each one checks, inside the database, that the
--     caller is an active admin, and refuses everyone else.
--   * Hosts keep their normal rules (owner_id = auth.uid()). An admin's own
--     "My invitations" page still shows only their own invitations.
--   * Every admin change is written to public.admin_log (who, what, when).
--
-- Make yourself the first admin (replace the email, then run it once):
--   update public.profiles set role = 'admin'
--    where user_id = (select id from auth.users where email = 'you@example.com');
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profiles: one row per account (role + status)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  role             text not null default 'host'   check (role in ('host','admin','super_admin')),
  status           text not null default 'active' check (status in ('active','suspended')),
  suspended_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Super Admin (owner) role, added with paid sharing campaigns. Re-running is safe.
do $$ begin
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.profiles add constraint profiles_role_check check (role in ('host','admin','super_admin'));
end $$;
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated using (user_id = auth.uid());
-- no insert / update / delete policies: only the admin functions below change roles
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;

-- every new sign-up gets a host profile; existing accounts are filled in now
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.profiles(user_id) select id from auth.users on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- Role checks (used by the rules below and by every admin function)
-- ---------------------------------------------------------------------
-- a Super Admin is also an admin; only a Super Admin may change money settings
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role in ('admin','super_admin') and status = 'active');
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'super_admin' and status = 'active');
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where user_id = auth.uid() and status = 'suspended');
$$;

create or replace function public._require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an InviteX admin can do this.' using errcode = '42501';
  end if;
end $$;

create or replace function public._require_super_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Only the InviteX Super Admin can do this.' using errcode = '42501';
  end if;
end $$;

-- The first time this runs, the longest-standing admin becomes the Super Admin
-- (the owner). To choose someone else, see the user manual, Part 3.1.
do $$ begin
  if not exists (select 1 from public.profiles where role = 'super_admin') then
    update public.profiles set role = 'super_admin', updated_at = now()
     where user_id = (select p.user_id from public.profiles p join auth.users u on u.id = p.user_id
                       where p.role = 'admin' and p.status = 'active' order by u.created_at, p.created_at limit 1);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Suspended accounts are locked out of their data.
-- RESTRICTIVE policies are added on top of the owner rules in schema.sql,
-- so a suspended host can no longer read or change anything. Guests are
-- not affected (they use the guest functions, not these tables).
-- ---------------------------------------------------------------------
drop policy if exists inv_active_only on public.invitations;
create policy inv_active_only on public.invitations as restrictive for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));
drop policy if exists guests_active_only on public.guests;
create policy guests_active_only on public.guests as restrictive for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));
drop policy if exists rsvps_active_only on public.rsvps;
create policy rsvps_active_only on public.rsvps as restrictive for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));
drop policy if exists media_active_only on storage.objects;
create policy media_active_only on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'invite-media' or (select public.is_active_user()));

-- Admins may list and remove uploaded photos of any invitation (needed to
-- delete an invitation completely). Reading is public anyway.
drop policy if exists media_admin_select on storage.objects;
create policy media_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'invite-media' and (select public.is_admin()));
drop policy if exists media_admin_delete on storage.objects;
create policy media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'invite-media' and (select public.is_admin()));

-- A suspended account cannot use AI tries (refunds still work).
create or replace function public.ai_credits_block_suspended() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tries_used > old.tries_used
     and exists (select 1 from public.profiles where user_id = new.user_id and status = 'suspended') then
    return null;  -- skip the update, so ai_take_try reports "no tries left"
  end if;
  return new;
end $$;
drop trigger if exists t_ai_credits_suspended on public.ai_credits;
create trigger t_ai_credits_suspended before update on public.ai_credits
  for each row execute function public.ai_credits_block_suspended();

-- ---------------------------------------------------------------------
-- Activity log: every admin action. Nobody can write to it directly;
-- admins read it through admin_activity().
-- ---------------------------------------------------------------------
create table if not exists public.admin_log (
  id           bigint generated always as identity primary key,
  admin_id     uuid references auth.users(id) on delete set null,
  admin_email  text,
  action       text not null,
  target_type  text,
  target_id    text,
  target_label text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists admin_log_time_idx on public.admin_log(created_at desc);
alter table public.admin_log enable row level security;  -- no policies on purpose
revoke all on public.admin_log from anon, authenticated;
-- the log is append-only: no row can be changed or removed, even by a database function
create or replace function public.admin_log_append_only() returns trigger language plpgsql as $$
begin raise exception 'The activity log cannot be changed or deleted.' using errcode = '42501'; end $$;
drop trigger if exists t_admin_log_append_only on public.admin_log;
create trigger t_admin_log_append_only before update or delete on public.admin_log
  for each row execute function public.admin_log_append_only();

create or replace function public._admin_log(p_action text, p_type text, p_id text, p_label text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_log(admin_id, admin_email, action, target_type, target_id, target_label, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_action, p_type, p_id, left(p_label, 200), coalesce(p_details, '{}'::jsonb));
$$;

-- an invitation's display title (main language first, then English)
create or replace function public._inv_title(d jsonb) returns text language sql immutable as $$
  select coalesce(nullif(d #>> array['text', coalesce(d->>'defaultLang','en'), 'title'], ''), nullif(d #>> '{text,en,title}', ''), 'Untitled invitation');
$$;

-- ---------------------------------------------------------------------
-- For everyone: my own role and status (the app uses this to show the
-- Admin menu, or the "account suspended" screen)
-- ---------------------------------------------------------------------
create or replace function public.my_account() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then return jsonb_build_object('role', 'none', 'status', 'none'); end if;
  insert into public.profiles(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into p from public.profiles where user_id = auth.uid();
  return jsonb_build_object('role', p.role, 'status', p.status, 'reason', p.suspended_reason);
end $$;

-- ---------------------------------------------------------------------
-- Admin: Users
-- ---------------------------------------------------------------------
create or replace function public.admin_users(p_q text default '', p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_rows jsonb; q text := lower(trim(coalesce(p_q, '')));
begin
  perform public._require_admin();
  select count(*) into v_total from auth.users au where q = '' or strpos(lower(coalesce(au.email, '')), q) > 0;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) into v_rows from (
    select au.id, au.email::text as email, au.created_at, au.last_sign_in_at,
           coalesce(p.role, 'host') as role, coalesce(p.status, 'active') as status, p.suspended_reason,
           (select count(*) from invitations i where i.owner_id = au.id) as invitations,
           (select count(*) from invitations i where i.owner_id = au.id and i.status = 'published') as published,
           (select count(*) from rsvps r join invitations i on i.id = r.invitation_id where i.owner_id = au.id) as replies,
           (select max(i.updated_at) from invitations i where i.owner_id = au.id) as last_edit,
           coalesce(c.tries_used, 0) as ai_used, coalesce(c.tries_limit, 3) as ai_limit, coalesce(c.plan, 'free') as plan
      from auth.users au
      left join profiles p on p.user_id = au.id
      left join ai_credits c on c.user_id = au.id
     where q = '' or strpos(lower(coalesce(au.email, '')), q) > 0
     order by au.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)
  ) x;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status text, p_reason text default '', p_unpublish boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; v_n int := 0;
begin
  perform public._require_admin();
  if p_status not in ('active', 'suspended') then raise exception 'Unknown status.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot suspend or re-activate your own account.'; end if;
  if exists (select 1 from profiles where user_id = p_user and role = 'super_admin') then perform public._require_super_admin(); end if;
  select email into v_email from auth.users where id = p_user;
  if not found then raise exception 'That account no longer exists.'; end if;
  insert into profiles(user_id) values (p_user) on conflict (user_id) do nothing;
  update profiles set status = p_status, updated_at = now(),
         suspended_reason = case when p_status = 'suspended' then nullif(left(trim(coalesce(p_reason, '')), 300), '') else null end
   where user_id = p_user;
  if p_status = 'suspended' and p_unpublish then
    update invitations set status = 'draft', published = null where owner_id = p_user and status = 'published';
    get diagnostics v_n = row_count;
  end if;
  perform public._admin_log(case when p_status = 'suspended' then 'user.suspend' else 'user.activate' end, 'user', p_user::text, v_email,
    jsonb_strip_nulls(jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''), 'unpublished', case when v_n > 0 then v_n end)));
  return jsonb_build_object('ok', true, 'unpublished', v_n);
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; v_old text;
begin
  perform public._require_admin();
  if p_role not in ('host', 'admin', 'super_admin') then raise exception 'Unknown role.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role. Ask another admin.'; end if;
  select email into v_email from auth.users where id = p_user;
  if not found then raise exception 'That account no longer exists.'; end if;
  insert into profiles(user_id) values (p_user) on conflict (user_id) do nothing;
  select role into v_old from profiles where user_id = p_user;
  -- making or removing admins, and anything to do with Super Admins, is for the Super Admin only
  if not public.is_super_admin() and (p_role <> 'host' or v_old <> 'host') then
    perform public._require_super_admin();
  end if;
  if v_old = 'super_admin' and p_role <> 'super_admin'
     and (select count(*) from profiles where role = 'super_admin' and status = 'active') <= 1 then
    raise exception 'InviteX needs at least one Super Admin.';
  end if;
  update profiles set role = p_role, updated_at = now() where user_id = p_user;
  perform public._admin_log(case p_role when 'super_admin' then 'user.make_super_admin' when 'admin' then 'user.make_admin' else 'user.remove_admin' end,
    'user', p_user::text, v_email, jsonb_build_object('old_role', v_old, 'new_role', p_role));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_grant_ai_tries(p_user uuid, p_extra int, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; r public.ai_credits;
begin
  perform public._require_admin();
  if p_extra is null or p_extra < 1 or p_extra > 1000 then raise exception 'Give between 1 and 1000 tries.'; end if;
  select email into v_email from auth.users where id = p_user;
  if not found then raise exception 'That account no longer exists.'; end if;
  insert into ai_credits(user_id) values (p_user) on conflict (user_id) do nothing;
  update ai_credits set tries_limit = tries_limit + p_extra, updated_at = now() where user_id = p_user returning * into r;
  perform public._admin_log('user.ai_tries', 'user', p_user::text, v_email,
    jsonb_strip_nulls(jsonb_build_object('added', p_extra, 'new_limit', r.tries_limit, 'note', nullif(trim(coalesce(p_note, '')), ''))));
  return jsonb_build_object('ok', true, 'used', r.tries_used, 'limit', r.tries_limit);
end $$;

-- ---------------------------------------------------------------------
-- Admin: Invitations
-- ---------------------------------------------------------------------
create or replace function public.admin_invitations(p_q text default '', p_status text default 'all', p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_rows jsonb; q text := lower(trim(coalesce(p_q, '')));
begin
  perform public._require_admin();
  select count(*) into v_total
    from invitations i left join auth.users au on au.id = i.owner_id
   where (p_status = 'all' or i.status = p_status)
     and (q = '' or strpos(lower(public._inv_title(i.data)), q) > 0 or strpos(lower(coalesce(i.slug, '')), q) > 0 or strpos(lower(coalesce(au.email, '')), q) > 0);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc), '[]'::jsonb) into v_rows from (
    select i.id, i.slug, i.status, public._inv_title(i.data) as title, i.data->>'category' as category,
           i.owner_id, au.email::text as owner_email, i.created_at, i.updated_at, i.published_at, i.expires_at,
           (select count(*) from guests g where g.invitation_id = i.id) as guests,
           (select count(*) from rsvps r where r.invitation_id = i.id) as replies,
           (select coalesce(sum(r.adults + r.children), 0) from rsvps r where r.invitation_id = i.id and r.status = 'yes') as coming
      from invitations i left join auth.users au on au.id = i.owner_id
     where (p_status = 'all' or i.status = p_status)
       and (q = '' or strpos(lower(public._inv_title(i.data)), q) > 0 or strpos(lower(coalesce(i.slug, '')), q) > 0 or strpos(lower(coalesce(au.email, '')), q) > 0)
     order by i.updated_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)
  ) x;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

create or replace function public.admin_unpublish_invitation(p_id uuid, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv invitations; v_email text;
begin
  perform public._require_admin();
  select * into inv from invitations where id = p_id;
  if not found then raise exception 'That invitation no longer exists.'; end if;
  update invitations set status = 'draft', published = null where id = p_id;
  select email into v_email from auth.users where id = inv.owner_id;
  perform public._admin_log('invitation.unpublish', 'invitation', p_id::text, public._inv_title(inv.data),
    jsonb_strip_nulls(jsonb_build_object('owner', v_email, 'slug', inv.slug, 'reason', nullif(trim(coalesce(p_reason, '')), ''))));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_invitation(p_id uuid, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv invitations; v_email text; v_g int; v_r int;
begin
  perform public._require_admin();
  select * into inv from invitations where id = p_id;
  if not found then raise exception 'That invitation no longer exists.'; end if;
  select email into v_email from auth.users where id = inv.owner_id;
  select count(*) into v_g from guests where invitation_id = p_id;
  select count(*) into v_r from rsvps where invitation_id = p_id;
  delete from invitations where id = p_id;  -- guests and replies are deleted with it
  perform public._admin_log('invitation.delete', 'invitation', p_id::text, public._inv_title(inv.data),
    jsonb_strip_nulls(jsonb_build_object('owner', v_email, 'slug', inv.slug, 'guests', v_g, 'replies', v_r, 'reason', nullif(trim(coalesce(p_reason, '')), ''))));
  return jsonb_build_object('ok', true, 'owner_id', inv.owner_id);
end $$;

-- ---------------------------------------------------------------------
-- Admin: Usage (totals, weekly numbers, AI use)
-- ---------------------------------------------------------------------
create or replace function public.admin_usage(p_weeks int default 8)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare n int := least(greatest(coalesce(p_weeks, 8), 1), 26); v_start date;
begin
  perform public._require_admin();
  v_start := (date_trunc('week', now()) - make_interval(weeks => n - 1))::date;
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'users',       (select count(*) from auth.users),
      'admins',      (select count(*) from profiles where role in ('admin','super_admin')),
      'suspended',   (select count(*) from profiles where status = 'suspended'),
      'active30',    (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
      'invitations', (select count(*) from invitations),
      'published',   (select count(*) from invitations where status = 'published'),
      'guests',      (select count(*) from guests),
      'replies',     (select count(*) from rsvps),
      'coming',      (select coalesce(sum(adults + children), 0) from rsvps where status = 'yes'),
      'ai_requests', (select count(*) from ai_generations),
      'ai_failed',   (select count(*) from ai_generations where not ok),
      'ai_images',   (select coalesce(sum(images), 0) from ai_generations)
    ),
    'ai_by_provider', coalesce((select jsonb_object_agg(coalesce(provider, 'unknown'), imgs) from (
        select provider, sum(images) as imgs from ai_generations group by provider) s), '{}'::jsonb),
    'ai_top', coalesce((select jsonb_agg(to_jsonb(t) order by t.images desc) from (
        select g.user_id, au.email::text as email, count(*) as requests, coalesce(sum(g.images), 0) as images
          from ai_generations g left join auth.users au on au.id = g.user_id
         group by g.user_id, au.email order by images desc limit 5) t), '[]'::jsonb),
    'weeks', (select jsonb_agg(jsonb_build_object(
        'week', w::date,
        'signups',   (select count(*) from auth.users where created_at >= w and created_at < w + interval '7 days'),
        'created',   (select count(*) from invitations where created_at >= w and created_at < w + interval '7 days'),
        'published', (select count(*) from invitations where published_at >= w and published_at < w + interval '7 days'),
        'replies',   (select count(*) from rsvps where created_at >= w and created_at < w + interval '7 days'),
        'ai_images', (select coalesce(sum(images), 0) from ai_generations where created_at >= w and created_at < w + interval '7 days')
      ) order by w)
      from generate_series(v_start::timestamptz, date_trunc('week', now()), interval '7 days') w)
  );
end $$;

-- ---------------------------------------------------------------------
-- Admin: Activity log
-- ---------------------------------------------------------------------
create or replace function public.admin_activity(p_limit int default 50, p_offset int default 0, p_action text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_rows jsonb; a text := trim(coalesce(p_action, ''));
begin
  perform public._require_admin();
  select count(*) into v_total from admin_log where a = '' or action like a || '%';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb) into v_rows from (
    select id, admin_email, action, target_type, target_id, target_label, details, created_at
      from admin_log where a = '' or action like a || '%'
     order by created_at desc, id desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)
  ) x;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

-- ---------------------------------------------------------------------
-- Who may call what. Signed-in users may call these; each admin_*
-- function refuses anyone who is not an active admin.
-- ---------------------------------------------------------------------
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.ai_credits_block_suspended() from public, anon, authenticated;
revoke all on function public._require_admin() from public, anon, authenticated;
revoke all on function public._require_super_admin() from public, anon, authenticated;
revoke all on function public.admin_log_append_only() from public, anon, authenticated;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;
revoke all on function public._admin_log(text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.my_account() from public, anon;
revoke all on function public.admin_users(text,int,int) from public, anon;
revoke all on function public.admin_set_user_status(uuid,text,text,boolean) from public, anon;
revoke all on function public.admin_set_role(uuid,text) from public, anon;
revoke all on function public.admin_grant_ai_tries(uuid,int,text) from public, anon;
revoke all on function public.admin_invitations(text,text,int,int) from public, anon;
revoke all on function public.admin_unpublish_invitation(uuid,text) from public, anon;
revoke all on function public.admin_delete_invitation(uuid,text) from public, anon;
revoke all on function public.admin_usage(int) from public, anon;
revoke all on function public.admin_activity(int,int,text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.my_account() to authenticated;
grant execute on function public.admin_users(text,int,int) to authenticated;
grant execute on function public.admin_set_user_status(uuid,text,text,boolean) to authenticated;
grant execute on function public.admin_set_role(uuid,text) to authenticated;
grant execute on function public.admin_grant_ai_tries(uuid,int,text) to authenticated;
grant execute on function public.admin_invitations(text,text,int,int) to authenticated;
grant execute on function public.admin_unpublish_invitation(uuid,text) to authenticated;
grant execute on function public.admin_delete_invitation(uuid,text) to authenticated;
grant execute on function public.admin_usage(int) to authenticated;
grant execute on function public.admin_activity(int,int,text) to authenticated;
