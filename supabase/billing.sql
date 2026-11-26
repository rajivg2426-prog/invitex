-- =====================================================================
-- InviteX – paid sharing campaigns (pay once per sharing campaign, UPI via Razorpay)
--
-- Run AFTER supabase/schema.sql and supabase/admin.sql (SQL Editor → paste → Run).
-- Re-running it is safe. Re-run it whenever you re-run schema.sql or admin.sql.
--
-- How it works, in short:
--   * Creating, editing, previewing, publishing, adding guests and writing
--     messages are free. Payment is asked only when a host starts sharing
--     the invitation with guests (a "sharing campaign").
--   * Every money decision is made here or in the Edge Functions
--     (supabase/functions/sharing-campaign, razorpay-webhook). The browser
--     never decides whether someone has paid or gets free access.
--   * One unlock (campaign_entitlements row) per campaign, ever. A paid unlock
--     needs a payment that Razorpay reported as captured for the exact amount.
--   * Guests can open an invitation only after it has at least one unlocked
--     campaign (see _guest_access). The owner can always preview it.
--   * Money is stored in paise (₹1 = 100 paise). Times are timestamptz (UTC)
--     and shown in India time (Asia/Kolkata).
--   * Payments start in TEST mode, where only admin accounts are asked to pay
--     (with Razorpay test money). Everyone else shares free until the Super
--     Admin switches to live mode, which also needs the PAYMENTS_LIVE_ALLOWED
--     secret on the server. See docs/PAYMENTS_SETUP.md.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Price rules. Never edited: every change adds a new row, the newest row is in force.
create table if not exists public.pricing_settings (
  id                      bigint generated always as identity primary key,
  payment_required        boolean not null default true,
  price_paise             int  not null default 2000 check (price_paise between 1000 and 10000 and price_paise % 100 = 0),
  currency                text not null default 'INR' check (currency = 'INR'),
  charging_model          text not null default 'per_campaign' check (charging_model = 'per_campaign'),
  provider                text not null default 'razorpay' check (provider in ('razorpay')),
  mode                    text not null default 'test' check (mode in ('test','live')),
  emergency_free          boolean not null default false,
  new_user_free_days      int  not null default 0 check (new_user_free_days between 0 and 365),
  free_campaigns_per_user int  not null default 0 check (free_campaigns_per_user between 0 and 100),
  guest_cap               int  not null default 0 check (guest_cap between 0 and 100000),   -- 0 = no limit
  campaign_grace_days     int  not null default 7 check (campaign_grace_days between 0 and 90),
  note                    text check (char_length(note) <= 300),
  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now()
);

create table if not exists public.promotional_access (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 120),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  audience       text not null default 'everyone' check (audience in ('everyone','new_users','selected')),
  total_quota    int  not null default 0 check (total_quota >= 0),      -- free campaigns in total, 0 = no limit
  per_user_quota int  not null default 0 check (per_user_quota >= 0),   -- free campaigns per person, 0 = no limit
  used_count     int  not null default 0 check (used_count >= 0),
  active         boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists promotional_access_window_idx on public.promotional_access(starts_at, ends_at) where active;

create table if not exists public.promotion_users (
  promotion_id uuid not null references public.promotional_access(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  primary key (promotion_id, user_id)
);

create table if not exists public.user_access_exemptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  reason         text not null check (char_length(reason) between 1 and 300),
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz,
  campaign_quota int not null default 0 check (campaign_quota >= 0),     -- 0 = no limit
  used_count     int not null default 0 check (used_count >= 0),
  granted_by     uuid references auth.users(id) on delete set null,
  revoked_at     timestamptz,
  revoked_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists user_access_exemptions_user_idx on public.user_access_exemptions(user_id) where revoked_at is null;

create table if not exists public.sharing_campaigns (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  invitation_id          uuid not null references public.invitations(id) on delete cascade,
  event_id               text check (char_length(event_id) <= 64),            -- an event inside the invitation's data (optional)
  campaign_name          text not null check (char_length(campaign_name) between 1 and 160),
  campaign_status        text not null default 'draft' check (campaign_status in
                           ('draft','awaiting_payment','payment_pending','payment_failed','ready','sharing','completed','cancelled')),
  guest_count            int  not null default 0 check (guest_count >= 0),
  general_shares         int  not null default 0 check (general_shares >= 0),
  pricing_policy_id      bigint references public.pricing_settings(id),
  amount_paise           int  not null default 0 check (amount_paise >= 0),
  currency               text not null default 'INR',
  payment_status         text not null default 'not_required' check (payment_status in ('not_required','unpaid','pending','paid','failed','refunded')),
  payment_transaction_id uuid,
  entitlement_status     text not null default 'none' check (entitlement_status in ('none','active','refunded','revoked')),
  client_request_id      text check (char_length(client_request_id) <= 80),
  closes_at              timestamptz,
  created_at             timestamptz not null default now(),
  paid_at                timestamptz,
  activated_at           timestamptz,
  last_shared_at         timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  updated_at             timestamptz not null default now()
);
-- at most one unfinished campaign per invitation (stops accidental duplicates)
create unique index if not exists sharing_campaigns_one_open on public.sharing_campaigns(invitation_id)
  where campaign_status not in ('completed','cancelled');
create unique index if not exists sharing_campaigns_request on public.sharing_campaigns(user_id, client_request_id) where client_request_id is not null;
create index if not exists sharing_campaigns_user_idx on public.sharing_campaigns(user_id, created_at desc);
create index if not exists sharing_campaigns_status_idx on public.sharing_campaigns(campaign_status, created_at desc);

-- what happened per guest. There is no "delivered" column: nothing can confirm WhatsApp delivery.
create table if not exists public.campaign_guests (
  campaign_id       uuid not null references public.sharing_campaigns(id) on delete cascade,
  guest_id          uuid not null references public.guests(id) on delete cascade,
  link_generated_at timestamptz,
  shared_at         timestamptz,
  share_count       int not null default 0,
  last_channel      text check (last_channel in ('whatsapp','email','copy','qr','native','other')),
  primary key (campaign_id, guest_id)
);

create table if not exists public.payment_orders (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.sharing_campaigns(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider          text not null check (provider in ('razorpay','simulated')),
  provider_order_id text,
  amount_paise      int  not null check (amount_paise between 1000 and 10000),
  currency          text not null default 'INR',
  pricing_policy_id bigint references public.pricing_settings(id),
  policy_snapshot   jsonb not null,
  status            text not null default 'creating' check (status in ('creating','created','attempted','paid','failed','expired')),
  is_test           boolean not null,
  error             text,
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  updated_at        timestamptz not null default now(),
  unique (provider, provider_order_id)
);
-- one open order per campaign: a retry reuses it instead of creating a second charge
create unique index if not exists payment_orders_one_open on public.payment_orders(campaign_id) where status in ('creating','created','attempted');
create index if not exists payment_orders_user_idx on public.payment_orders(user_id, created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders(status, created_at desc);

create table if not exists public.payment_transactions (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.payment_orders(id) on delete cascade,
  campaign_id           uuid not null references public.sharing_campaigns(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  provider              text not null,
  provider_payment_id   text not null,
  status                text not null check (status in ('created','authorized','captured','failed','refunded','partially_refunded')),
  amount_paise          int  not null,
  currency              text not null,
  amount_refunded_paise int  not null default 0,
  method                text,
  error_code            text,
  error_description     text,
  verified_via          text[] not null default '{}',
  flag                  text check (flag in ('amount_mismatch','duplicate_refund_due')),
  is_test               boolean not null,
  created_at            timestamptz not null default now(),
  captured_at           timestamptz,
  updated_at            timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index if not exists payment_transactions_time_idx on public.payment_transactions(created_at desc);
create index if not exists payment_transactions_user_idx on public.payment_transactions(user_id, created_at desc);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sharing_campaigns_tx_fk') then
    alter table public.sharing_campaigns add constraint sharing_campaigns_tx_fk
      foreign key (payment_transaction_id) references public.payment_transactions(id) on delete set null;
  end if;
end $$;

create table if not exists public.payment_refunds (
  id                 uuid primary key default gen_random_uuid(),
  transaction_id     uuid not null references public.payment_transactions(id) on delete cascade,
  provider           text not null,
  provider_refund_id text not null,
  amount_paise       int  not null check (amount_paise > 0),
  status             text not null check (status in ('pending','processed','failed')),
  is_test            boolean not null,
  created_at         timestamptz not null default now(),
  processed_at       timestamptz,
  unique (provider, provider_refund_id)
);

create table if not exists public.payment_webhook_events (
  id                bigint generated always as identity primary key,
  provider          text not null,
  provider_event_id text not null,
  event_type        text not null,
  signature_valid   boolean not null,
  result            text,
  payload           jsonb,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.campaign_entitlements (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null unique references public.sharing_campaigns(id) on delete cascade,  -- one unlock per campaign, ever
  user_id        uuid not null references auth.users(id) on delete cascade,
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  grant_type     text not null check (grant_type in ('paid','complimentary')),
  source         text not null check (source in ('payment','payments_off','test_mode','emergency','exemption','promotion','new_user','free_quota','existing')),
  source_ref     text,
  transaction_id uuid references public.payment_transactions(id) on delete restrict,
  amount_paise   int  not null default 0,
  currency       text not null default 'INR',
  status         text not null default 'active' check (status in ('active','refunded','revoked','expired')),
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- a paid unlock always points at a payment; a free one is never recorded as a payment
  check ((grant_type = 'paid' and transaction_id is not null and amount_paise > 0 and source = 'payment')
      or (grant_type = 'complimentary' and transaction_id is null and amount_paise = 0 and source <> 'payment'))
);
create index if not exists campaign_entitlements_inv_idx on public.campaign_entitlements(invitation_id);
create index if not exists campaign_entitlements_user_idx on public.campaign_entitlements(user_id, created_at desc);

create table if not exists public.billing_flags (key text primary key, value jsonb, at timestamptz not null default now());

-- the first price rule: ₹20 per campaign, charging on, TEST mode
insert into public.pricing_settings(payment_required, price_paise, mode, note)
select true, 2000, 'test', 'Initial setting'
where not exists (select 1 from public.pricing_settings);

-- ---------------------------------------------------------------------
-- Row Level Security: hosts may READ their own rows; nobody writes directly.
-- All changes go through the functions below.
-- ---------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['pricing_settings','promotional_access','promotion_users','user_access_exemptions','sharing_campaigns',
    'campaign_guests','payment_orders','payment_transactions','payment_refunds','payment_webhook_events','campaign_entitlements','billing_flags'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
revoke all on public.pricing_settings, public.promotional_access, public.promotion_users, public.user_access_exemptions,
  public.payment_refunds, public.payment_webhook_events, public.billing_flags from authenticated;
grant select on public.sharing_campaigns, public.campaign_guests, public.payment_orders, public.payment_transactions, public.campaign_entitlements to authenticated;
drop policy if exists campaigns_own_read on public.sharing_campaigns;
create policy campaigns_own_read on public.sharing_campaigns for select to authenticated using (user_id = auth.uid());
drop policy if exists campaign_guests_own_read on public.campaign_guests;
create policy campaign_guests_own_read on public.campaign_guests for select to authenticated
  using (exists (select 1 from public.sharing_campaigns c where c.id = campaign_id and c.user_id = auth.uid()));
drop policy if exists orders_own_read on public.payment_orders;
create policy orders_own_read on public.payment_orders for select to authenticated using (user_id = auth.uid());
drop policy if exists tx_own_read on public.payment_transactions;
create policy tx_own_read on public.payment_transactions for select to authenticated using (user_id = auth.uid());
drop policy if exists ent_own_read on public.campaign_entitlements;
create policy ent_own_read on public.campaign_entitlements for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public._billing_policy() returns public.pricing_settings
language sql stable security definer set search_path = public as $$
  select * from public.pricing_settings order by id desc limit 1;
$$;

-- When a campaign closes on its own: the day after the last event date + grace days, midnight India time.
create or replace function public._campaign_closes_at(p_invitation uuid, p_grace int) returns timestamptz
language sql stable security definer set search_path = public as $$
  select (max((e->>'date')::date) + p_grace + 1)::timestamp at time zone 'Asia/Kolkata'
    from public.invitations i, jsonb_array_elements(coalesce(i.published->'events', i.data->'events', '[]'::jsonb)) e
   where i.id = p_invitation and coalesce(e->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$';
$$;

-- Is this person's next campaign free, and if not, what does it cost? Server time only.
create or replace function public._access_decision(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pol public.pricing_settings; v_role text; v_joined timestamptz; v_ref text; v_n int;
begin
  pol := public._billing_policy();
  select coalesce(p.role, 'host') into v_role from auth.users u left join public.profiles p on p.user_id = u.id where u.id = p_user;
  select created_at into v_joined from auth.users where id = p_user;
  if pol.emergency_free then
    return jsonb_build_object('free', true, 'source', 'emergency', 'policy_id', pol.id, 'amount_paise', 0, 'currency', pol.currency, 'mode', pol.mode);
  end if;
  if not pol.payment_required then
    return jsonb_build_object('free', true, 'source', 'payments_off', 'policy_id', pol.id, 'amount_paise', 0, 'currency', pol.currency, 'mode', pol.mode);
  end if;
  -- test mode: only admin accounts are asked to pay (with test money); real hosts are never charged
  if pol.mode = 'test' and coalesce(v_role, 'host') not in ('admin', 'super_admin') then
    return jsonb_build_object('free', true, 'source', 'test_mode', 'policy_id', pol.id, 'amount_paise', 0, 'currency', pol.currency, 'mode', pol.mode);
  end if;
  select x.id::text into v_ref from public.user_access_exemptions x
   where x.user_id = p_user and x.revoked_at is null and x.starts_at <= now() and (x.ends_at is null or x.ends_at > now())
     and (x.campaign_quota = 0 or x.used_count < x.campaign_quota)
   order by x.created_at limit 1;
  if v_ref is not null then
    return jsonb_build_object('free', true, 'source', 'exemption', 'source_ref', v_ref, 'policy_id', pol.id, 'amount_paise', 0, 'currency', pol.currency, 'mode', pol.mode);
  end if;
  select pr.id::text into v_ref from public.promotional_access pr
   where pr.active and pr.starts_at <= now() and pr.ends_at > now()
     and (pr.total_quota = 0 or pr.used_count < pr.total_quota)
     and (pr.audience = 'everyone'
          or (pr.audience = 'new_users' and v_joined >= pr.starts_at)
          or (pr.audience = 'selected' and exists (select 1 from public.promotion_users pu where pu.promotion_id = pr.id and pu.user_id = p_user)))
     and (pr.per_user_quota = 0 or (select count(*) from public.campaign_entitlements e
           where e.user_id = p_user and e.source = 'promotion' and e.source_ref = pr.id::text) < pr.per_user_quota)
   order by pr.ends_at limit 1;
  if v_ref is not null then
    return jsonb_build_object('free', true, 'source', 'promotion', 'source_ref', v_ref, 'policy_id', pol.id, 'amount_paise', 0, 'currency', pol.currency, 'mode', pol.mode);
  end if;
  if pol.new_user_free_days > 0 and v_joined > now() - make_interval(days => pol.new_user_free_days) then
    return jsonb_build_object('free', true, 'source', 'new_user', 'policy_id', pol.id, 'amount_paise', 0, 'currency', pol.currency, 'mode', pol.mode);
  end if;
  if pol.free_campaigns_per_user > 0 then
    select count(*) into v_n from public.campaign_entitlements e where e.user_id = p_user and e.source <> 'existing';
    if v_n < pol.free_campaigns_per_user then
      return jsonb_build_object('free', true, 'source', 'free_quota', 'policy_id', pol.id, 'amount_paise', 0, 'currency', pol.currency, 'mode', pol.mode);
    end if;
  end if;
  return jsonb_build_object('free', false, 'source', null, 'policy_id', pol.id, 'amount_paise', pol.price_paise, 'currency', pol.currency, 'mode', pol.mode);
end $$;

-- Close campaigns whose time is up (called before reading or starting).
create or replace function public._campaign_autoclose(p_invitation uuid) returns void
language sql security definer set search_path = public as $$
  update public.sharing_campaigns set campaign_status = 'completed', completed_at = now(), updated_at = now()
   where invitation_id = p_invitation and campaign_status in ('ready','sharing') and closes_at is not null and closes_at < now();
$$;

-- Grant a free unlock (idempotent: a campaign has at most one unlock).
create or replace function public._grant_complimentary(p_campaign uuid, d jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare c public.sharing_campaigns; v_id uuid; pol public.pricing_settings;
begin
  select * into c from public.sharing_campaigns where id = p_campaign for update;
  pol := public._billing_policy();
  insert into public.campaign_entitlements(campaign_id, user_id, invitation_id, grant_type, source, source_ref, amount_paise, currency)
  values (c.id, c.user_id, c.invitation_id, 'complimentary', d->>'source', d->>'source_ref', 0, coalesce(d->>'currency', 'INR'))
  on conflict (campaign_id) do nothing returning id into v_id;
  if v_id is null then return false; end if;
  if d->>'source' = 'exemption' then update public.user_access_exemptions set used_count = used_count + 1 where id = (d->>'source_ref')::uuid; end if;
  if d->>'source' = 'promotion' then update public.promotional_access set used_count = used_count + 1, updated_at = now() where id = (d->>'source_ref')::uuid; end if;
  update public.payment_orders set status = 'expired', updated_at = now() where campaign_id = c.id and status in ('creating','created');
  update public.sharing_campaigns set campaign_status = 'ready', payment_status = 'not_required', entitlement_status = 'active',
         amount_paise = 0, pricing_policy_id = (d->>'policy_id')::bigint, activated_at = now(), updated_at = now(),
         closes_at = public._campaign_closes_at(c.invitation_id, pol.campaign_grace_days)
   where id = c.id;
  return true;
end $$;

create or replace function public._campaign_json(p_campaign uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'invitation_id', c.invitation_id, 'event_id', c.event_id, 'name', c.campaign_name, 'status', c.campaign_status,
    'payment_status', c.payment_status, 'entitlement_status', c.entitlement_status,
    'amount_paise', c.amount_paise, 'currency', c.currency,
    'guest_count', (select count(*) from public.guests g where g.invitation_id = c.invitation_id),
    'can_share', c.entitlement_status = 'active' and c.campaign_status in ('ready','sharing'),
    'stats', jsonb_build_object(
      'links', (select count(*) from public.campaign_guests cg where cg.campaign_id = c.id and cg.link_generated_at is not null),
      'shared', (select count(*) from public.campaign_guests cg where cg.campaign_id = c.id and cg.shared_at is not null),
      'general_shares', c.general_shares,
      'opened', (select count(*) from public.campaign_guests cg join public.guests g on g.id = cg.guest_id where cg.campaign_id = c.id and g.opened_at is not null),
      'replies', (select count(*) from public.rsvps r where r.invitation_id = c.invitation_id and r.created_at >= c.created_at)),
    'entitlement', (select jsonb_build_object('grant_type', e.grant_type, 'source', e.source, 'status', e.status, 'amount_paise', e.amount_paise, 'created_at', e.created_at)
                      from public.campaign_entitlements e where e.campaign_id = c.id),
    'order', (select jsonb_build_object('id', o.id, 'amount_paise', o.amount_paise, 'status', o.status, 'is_test', o.is_test, 'created_at', o.created_at)
                from public.payment_orders o where o.campaign_id = c.id order by o.created_at desc limit 1),
    'created_at', c.created_at, 'paid_at', c.paid_at, 'activated_at', c.activated_at, 'last_shared_at', c.last_shared_at,
    'completed_at', c.completed_at, 'closes_at', c.closes_at)
  from public.sharing_campaigns c where c.id = p_campaign;
$$;

-- ---------------------------------------------------------------------
-- Guest-side lock (replaces the open hook from schema.sql).
-- Guests can open an invitation once any of its campaigns was unlocked.
-- Links keep working after a campaign completes or is refunded.
-- If the owner's sharing would be free right now (charging off, test mode,
-- a promotion…), the first guest visit records a free campaign so that a link
-- shared during a free period keeps working when charging is switched on.
-- ---------------------------------------------------------------------
create or replace function public._guest_access(p_invitation uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare inv public.invitations; d jsonb; v_c uuid;
begin
  if exists (select 1 from public.campaign_entitlements e where e.invitation_id = p_invitation and e.status in ('active','refunded','expired')) then
    return true;
  end if;
  select * into inv from public.invitations where id = p_invitation;
  if not found then return false; end if;
  if auth.uid() is not null and inv.owner_id = auth.uid() then return true; end if;   -- the host's own preview
  if exists (select 1 from public.profiles where user_id = inv.owner_id and status = 'suspended') then return false; end if;
  d := public._access_decision(inv.owner_id);
  if not (d->>'free')::boolean then return false; end if;
  select id into v_c from public.sharing_campaigns where invitation_id = p_invitation and campaign_status not in ('completed','cancelled');
  if v_c is null then
    insert into public.sharing_campaigns(user_id, invitation_id, campaign_name)
    values (inv.owner_id, p_invitation, left(public._inv_title(coalesce(inv.published, inv.data)), 140) || ' – sharing')
    on conflict do nothing returning id into v_c;
    if v_c is null then select id into v_c from public.sharing_campaigns where invitation_id = p_invitation and campaign_status not in ('completed','cancelled'); end if;
  end if;
  perform public._grant_complimentary(v_c, d);
  return true;
end $$;

-- Invitations that were already published before billing existed keep working:
-- each gets a free "existing invitation" campaign, once, on the first install.
do $$ begin
  if not exists (select 1 from public.billing_flags where key = 'grandfathered') then
    with ins as (
      insert into public.sharing_campaigns(user_id, invitation_id, campaign_name, campaign_status, payment_status, entitlement_status, activated_at, closes_at)
      select i.owner_id, i.id, left(public._inv_title(coalesce(i.published, i.data)), 140) || ' – existing invitation', 'sharing', 'not_required', 'active', now(),
             public._campaign_closes_at(i.id, 7)
        from public.invitations i
       where i.status = 'published'
         and not exists (select 1 from public.sharing_campaigns c where c.invitation_id = i.id)
      returning id, user_id, invitation_id)
    insert into public.campaign_entitlements(campaign_id, user_id, invitation_id, grant_type, source, amount_paise)
    select id, user_id, invitation_id, 'complimentary', 'existing', 0 from ins;
    insert into public.billing_flags(key, value) values ('grandfathered', jsonb_build_object('at', now()));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Host functions
-- ---------------------------------------------------------------------
create or replace function public._require_host() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'Your account is paused.' using errcode = '42501'; end if;
  return auth.uid();
end $$;

-- What would my next sharing campaign cost?
create or replace function public.my_sharing_quote() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb;
begin
  perform public._require_host();
  d := public._access_decision(auth.uid());
  return jsonb_build_object('payment_required', not (d->>'free')::boolean, 'free_reason', d->>'source',
    'amount_paise', (public._billing_policy()).price_paise, 'charge_paise', (d->>'amount_paise')::int,
    'currency', d->>'currency', 'mode', d->>'mode', 'provider', (public._billing_policy()).provider, 'method', 'upi');
end $$;

-- The current (or latest) campaign of an invitation, plus what a new one would cost.
create or replace function public.campaign_state(p_invitation uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_host(); v_c uuid;
begin
  if not exists (select 1 from public.invitations where id = p_invitation and owner_id = v_uid) then
    raise exception 'Invitation not found.' using errcode = '42501';
  end if;
  perform public._campaign_autoclose(p_invitation);
  select id into v_c from public.sharing_campaigns where invitation_id = p_invitation and campaign_status not in ('completed','cancelled');
  if v_c is null then select id into v_c from public.sharing_campaigns where invitation_id = p_invitation order by created_at desc limit 1; end if;
  return jsonb_build_object('campaign', case when v_c is null then null else public._campaign_json(v_c) end,
    'quote', public.my_sharing_quote(),
    'campaigns', (select count(*) from public.sharing_campaigns where invitation_id = p_invitation));
end $$;

-- "Start sharing": create or reuse the campaign, then decide free or pay.
create or replace function public.campaign_start(p_invitation uuid, p_name text default null, p_event_id text default null, p_request_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_host(); inv public.invitations; c public.sharing_campaigns; d jsonb; v_n int;
begin
  select * into inv from public.invitations where id = p_invitation and owner_id = v_uid for update;
  if not found then raise exception 'Invitation not found.' using errcode = '42501'; end if;
  if inv.status <> 'published' then raise exception 'Publish the invitation first. Then you can start sharing it.'; end if;
  if p_request_id is not null then
    select * into c from public.sharing_campaigns where user_id = v_uid and client_request_id = p_request_id;
    if found then return public._campaign_json(c.id); end if;
  end if;
  perform public._campaign_autoclose(p_invitation);
  select * into c from public.sharing_campaigns where invitation_id = p_invitation and campaign_status not in ('completed','cancelled') for update;
  if not found then
    select count(*) + 1 into v_n from public.sharing_campaigns where invitation_id = p_invitation;
    insert into public.sharing_campaigns(user_id, invitation_id, event_id, campaign_name, client_request_id, guest_count)
    values (v_uid, p_invitation, nullif(left(trim(coalesce(p_event_id, '')), 64), ''),
            coalesce(nullif(left(trim(coalesce(p_name, '')), 160), ''), left(public._inv_title(coalesce(inv.published, inv.data)), 130) || ' – sharing ' || v_n),
            p_request_id, (select count(*) from public.guests where invitation_id = p_invitation))
    returning * into c;
  end if;
  if c.entitlement_status <> 'none' or c.campaign_status = 'payment_pending' then
    return public._campaign_json(c.id);   -- already unlocked, or a payment is in flight: never charge twice
  end if;
  d := public._access_decision(v_uid);
  if (d->>'free')::boolean then
    perform public._grant_complimentary(c.id, d);
  elsif not exists (select 1 from public.payment_orders o where o.campaign_id = c.id and o.status in ('creating','created','attempted') and o.expires_at > now()) then
    update public.sharing_campaigns set campaign_status = case when campaign_status = 'payment_failed' then 'payment_failed' else 'awaiting_payment' end,
           payment_status = case when payment_status = 'failed' then 'failed' else 'unpaid' end,
           amount_paise = (d->>'amount_paise')::int, currency = d->>'currency', pricing_policy_id = (d->>'policy_id')::bigint, updated_at = now()
     where id = c.id;
  end if;
  return public._campaign_json(c.id);
end $$;

-- The host opened WhatsApp/email, copied a link, showed the QR… Sharing is free within the campaign.
create or replace function public.campaign_mark_shared(p_campaign uuid, p_guest uuid default null, p_channel text default 'whatsapp', p_action text default 'share')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_host(); c public.sharing_campaigns; v_ch text;
begin
  select * into c from public.sharing_campaigns where id = p_campaign and user_id = v_uid for update;
  if not found then raise exception 'Campaign not found.' using errcode = '42501'; end if;
  if not (c.entitlement_status = 'active' and c.campaign_status in ('ready','sharing')) then
    raise exception 'This sharing campaign is not unlocked.' using errcode = '42501';
  end if;
  v_ch := case when p_channel in ('whatsapp','email','copy','qr','native') then p_channel else 'other' end;
  if p_guest is not null then
    if not exists (select 1 from public.guests where id = p_guest and invitation_id = c.invitation_id) then raise exception 'Guest not found.'; end if;
    insert into public.campaign_guests(campaign_id, guest_id, link_generated_at, shared_at, share_count, last_channel)
    values (c.id, p_guest, now(), case when p_action = 'share' then now() end, case when p_action = 'share' then 1 else 0 end, v_ch)
    on conflict (campaign_id, guest_id) do update set
      link_generated_at = coalesce(campaign_guests.link_generated_at, now()),
      shared_at = case when p_action = 'share' then now() else campaign_guests.shared_at end,
      share_count = campaign_guests.share_count + case when p_action = 'share' then 1 else 0 end,
      last_channel = v_ch;
  elsif p_action = 'share' then
    update public.sharing_campaigns set general_shares = general_shares + 1 where id = c.id;
  end if;
  update public.sharing_campaigns set campaign_status = 'sharing', last_shared_at = case when p_action = 'share' then now() else last_shared_at end,
         guest_count = (select count(*) from public.guests where invitation_id = c.invitation_id), updated_at = now()
   where id = c.id;
  return public._campaign_json(c.id);
end $$;

create or replace function public.campaign_complete(p_campaign uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_host();
begin
  update public.sharing_campaigns set campaign_status = 'completed', completed_at = now(), updated_at = now()
   where id = p_campaign and user_id = v_uid and campaign_status in ('ready','sharing');
  if not found then raise exception 'Only an unlocked campaign can be marked done.'; end if;
  return public._campaign_json(p_campaign);
end $$;

-- Reopen a finished campaign: same unlock, no new payment.
create or replace function public.campaign_reopen(p_campaign uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_host(); c public.sharing_campaigns; pol public.pricing_settings := public._billing_policy();
begin
  select * into c from public.sharing_campaigns where id = p_campaign and user_id = v_uid for update;
  if not found then raise exception 'Campaign not found.' using errcode = '42501'; end if;
  if c.campaign_status <> 'completed' or c.entitlement_status <> 'active' then raise exception 'Only a finished, unlocked campaign can be reopened.'; end if;
  if exists (select 1 from public.sharing_campaigns where invitation_id = c.invitation_id and id <> c.id and campaign_status not in ('completed','cancelled')) then
    raise exception 'This invitation already has an open sharing campaign.';
  end if;
  update public.sharing_campaigns set campaign_status = 'sharing', completed_at = null, updated_at = now(),
         closes_at = greatest(coalesce(public._campaign_closes_at(invitation_id, pol.campaign_grace_days), now()), now() + make_interval(days => greatest(pol.campaign_grace_days, 1)))
   where id = c.id;
  return public._campaign_json(c.id);
end $$;

create or replace function public.campaign_cancel(p_campaign uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_host(); c public.sharing_campaigns;
begin
  select * into c from public.sharing_campaigns where id = p_campaign and user_id = v_uid for update;
  if not found then raise exception 'Campaign not found.' using errcode = '42501'; end if;
  if c.entitlement_status <> 'none' then raise exception 'An unlocked campaign cannot be cancelled. Mark it done instead.'; end if;
  if c.campaign_status = 'payment_pending' then raise exception 'A payment is still being processed. Please wait a few minutes.'; end if;
  if c.campaign_status in ('completed','cancelled') then return public._campaign_json(c.id); end if;
  update public.payment_orders set status = 'expired', updated_at = now() where campaign_id = c.id and status in ('creating','created');
  update public.sharing_campaigns set campaign_status = 'cancelled', cancelled_at = now(), updated_at = now() where id = c.id;
  return public._campaign_json(c.id);
end $$;

create or replace function public.my_campaigns(p_invitation uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._require_host();
begin
  return coalesce((select jsonb_agg(public._campaign_json(c.id) || jsonb_build_object('invitation_title', public._inv_title(i.data)) order by c.created_at desc)
    from public.sharing_campaigns c join public.invitations i on i.id = c.invitation_id
   where c.user_id = v_uid and (p_invitation is null or c.invitation_id = p_invitation)), '[]'::jsonb);
end $$;

-- Receipts for the Plan tab.
create or replace function public.my_payments() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._require_host();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'order_id', o.id, 'campaign', c.campaign_name, 'amount_paise', o.amount_paise, 'currency', o.currency, 'status', o.status, 'is_test', o.is_test,
      'created_at', o.created_at, 'paid_at', o.paid_at,
      'payment_id', t.provider_payment_id, 'method', t.method, 'refunded_paise', coalesce(t.amount_refunded_paise, 0))
      order by o.created_at desc)
    from public.payment_orders o join public.sharing_campaigns c on c.id = o.campaign_id
    left join lateral (select * from public.payment_transactions t where t.order_id = o.id
                        order by (t.id = c.payment_transaction_id) desc, (t.status = 'captured') desc, t.created_at desc limit 1) t on true
   where o.user_id = v_uid and o.status <> 'creating'), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- Server-only functions (Edge Functions, service role). Never callable from the browser.
-- ---------------------------------------------------------------------

-- Before creating a Razorpay order: re-check everything and reserve the order row.
create or replace function public._svc_order_prepare(p_user uuid, p_campaign uuid, p_provider text default 'razorpay') returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.sharing_campaigns; o public.payment_orders; d jsonb; pol public.pricing_settings := public._billing_policy();
begin
  select * into c from public.sharing_campaigns where id = p_campaign and user_id = p_user for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if exists (select 1 from public.profiles where user_id = p_user and status = 'suspended') then return jsonb_build_object('status', 'suspended'); end if;
  if c.entitlement_status <> 'none' then return jsonb_build_object('status', 'unlocked', 'campaign', public._campaign_json(c.id)); end if;
  if c.campaign_status in ('completed','cancelled') then return jsonb_build_object('status', 'closed', 'campaign', public._campaign_json(c.id)); end if;
  update public.payment_orders set status = 'expired', updated_at = now()
   where campaign_id = c.id and status in ('created','attempted') and expires_at < now();
  update public.payment_orders set status = 'failed', error = coalesce(error, 'order creation timed out'), updated_at = now()
   where campaign_id = c.id and status = 'creating' and created_at < now() - interval '2 minutes';
  select * into o from public.payment_orders where campaign_id = c.id and status in ('creating','created','attempted');
  if found then
    if o.status = 'creating' then return jsonb_build_object('status', 'busy'); end if;
    -- reuse: same order, same amount, even if the price changed since
    return jsonb_build_object('status', 'reuse', 'order_id', o.id, 'provider_order_id', o.provider_order_id, 'amount_paise', o.amount_paise,
      'currency', o.currency, 'is_test', o.is_test, 'campaign', public._campaign_json(c.id));
  end if;
  d := public._access_decision(p_user);
  if (d->>'free')::boolean then
    perform public._grant_complimentary(c.id, d);
    return jsonb_build_object('status', 'free', 'campaign', public._campaign_json(c.id));
  end if;
  insert into public.payment_orders(campaign_id, user_id, provider, amount_paise, currency, pricing_policy_id, policy_snapshot, is_test, expires_at)
  values (c.id, p_user, p_provider, (d->>'amount_paise')::int, d->>'currency', pol.id, to_jsonb(pol), pol.mode = 'test', now() + interval '12 hours')
  returning * into o;
  update public.sharing_campaigns set campaign_status = case when campaign_status = 'payment_failed' then 'payment_failed' else 'awaiting_payment' end,
         payment_status = case when payment_status = 'failed' then 'failed' else 'unpaid' end,
         amount_paise = o.amount_paise, currency = o.currency, pricing_policy_id = pol.id, updated_at = now()
   where id = c.id;
  return jsonb_build_object('status', 'create', 'order_id', o.id, 'amount_paise', o.amount_paise, 'currency', o.currency,
    'is_test', o.is_test, 'mode', pol.mode, 'receipt', c.id, 'campaign_name', c.campaign_name);
end $$;

create or replace function public._svc_order_created(p_order uuid, p_provider_order_id text) returns void
language sql security definer set search_path = public as $$
  update public.payment_orders set status = 'created', provider_order_id = p_provider_order_id, updated_at = now() where id = p_order and status = 'creating';
$$;

create or replace function public._svc_order_create_failed(p_order uuid, p_error text) returns void
language sql security definer set search_path = public as $$
  update public.payment_orders set status = 'failed', error = left(p_error, 300), updated_at = now() where id = p_order and status = 'creating';
$$;

-- The open order of a campaign (for the "check payment" button and the reconcile job).
create or replace function public._svc_campaign_order(p_user uuid, p_campaign uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('order_id', o.id, 'provider', o.provider, 'provider_order_id', o.provider_order_id, 'status', o.status, 'amount_paise', o.amount_paise)
    from public.payment_orders o join public.sharing_campaigns c on c.id = o.campaign_id
   where o.campaign_id = p_campaign and c.user_id = p_user and o.provider_order_id is not null
   order by (o.status in ('created','attempted','paid')) desc, o.created_at desc limit 1;
$$;

create or replace function public._svc_orders_to_reconcile(p_min_age_minutes int default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('order_id', o.id, 'provider', o.provider, 'provider_order_id', o.provider_order_id)), '[]'::jsonb)
    from public.payment_orders o
   where o.status in ('created','attempted') and o.provider_order_id is not null
     and o.created_at < now() - make_interval(mins => p_min_age_minutes) and o.created_at > now() - interval '3 days';
$$;

-- Apply what Razorpay says about one payment. Idempotent: call it from the checkout
-- callback, the webhook and the reconcile job; the result is the same.
-- p_payment: { id, status, amount, currency, method, error_code, error_description }
create or replace function public._svc_payment_apply(p_provider text, p_provider_order_id text, p_payment jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.payment_orders; c public.sharing_campaigns; t public.payment_transactions; v_status text; v_flag text; v_ent uuid;
begin
  select * into o from public.payment_orders where provider = p_provider and provider_order_id = p_provider_order_id for update;
  if not found then return jsonb_build_object('result', 'unknown_order'); end if;
  select * into c from public.sharing_campaigns where id = o.campaign_id for update;
  v_status := case p_payment->>'status' when 'captured' then 'captured' when 'authorized' then 'authorized' when 'failed' then 'failed'
                   when 'refunded' then 'refunded' else 'created' end;
  insert into public.payment_transactions(order_id, campaign_id, user_id, provider, provider_payment_id, status, amount_paise, currency, method,
                                          error_code, error_description, verified_via, is_test, captured_at)
  values (o.id, o.campaign_id, o.user_id, p_provider, p_payment->>'id', v_status, coalesce((p_payment->>'amount')::int, 0), coalesce(p_payment->>'currency', ''),
          left(p_payment->>'method', 30), left(p_payment->>'error_code', 80), left(p_payment->>'error_description', 300), array[p_via], o.is_test,
          case when v_status = 'captured' then now() end)
  on conflict (provider, provider_payment_id) do update set
    status = case when payment_transactions.status in ('captured','refunded','partially_refunded') and excluded.status in ('created','authorized','failed')
                  then payment_transactions.status else excluded.status end,
    method = coalesce(excluded.method, payment_transactions.method),
    error_code = coalesce(excluded.error_code, payment_transactions.error_code),
    error_description = coalesce(excluded.error_description, payment_transactions.error_description),
    verified_via = (select array_agg(distinct v) from unnest(payment_transactions.verified_via || excluded.verified_via) v),
    captured_at = coalesce(payment_transactions.captured_at, excluded.captured_at),
    updated_at = now()
  returning * into t;

  if t.status = 'captured' then
    if t.amount_paise <> o.amount_paise or t.currency <> o.currency then
      update public.payment_transactions set flag = 'amount_mismatch' where id = t.id;
      return jsonb_build_object('result', 'mismatch', 'campaign_id', c.id);
    end if;
    if c.entitlement_status <> 'none' and c.payment_transaction_id is distinct from t.id then
      -- the campaign was already unlocked (an earlier payment, or free access): money taken twice
      update public.payment_transactions set flag = 'duplicate_refund_due' where id = t.id and flag is null;
      update public.payment_orders set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now() where id = o.id;
      return jsonb_build_object('result', 'duplicate', 'campaign_id', c.id);
    end if;
    update public.payment_orders set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now() where id = o.id;
    insert into public.campaign_entitlements(campaign_id, user_id, invitation_id, grant_type, source, transaction_id, amount_paise, currency)
    values (c.id, c.user_id, c.invitation_id, 'paid', 'payment', t.id, t.amount_paise, t.currency)
    on conflict (campaign_id) do nothing returning id into v_ent;
    if v_ent is null then return jsonb_build_object('result', 'already_unlocked', 'campaign_id', c.id); end if;
    update public.sharing_campaigns set campaign_status = 'ready', payment_status = 'paid', entitlement_status = 'active', payment_transaction_id = t.id,
           amount_paise = t.amount_paise, paid_at = now(), activated_at = now(), updated_at = now(),
           closes_at = public._campaign_closes_at(c.invitation_id, (o.policy_snapshot->>'campaign_grace_days')::int)
     where id = c.id;
    return jsonb_build_object('result', 'unlocked', 'campaign_id', c.id);
  end if;

  if c.entitlement_status <> 'none' then return jsonb_build_object('result', 'already_unlocked', 'campaign_id', c.id); end if;
  if t.status = 'failed' then
    update public.payment_orders set status = 'attempted', updated_at = now() where id = o.id and status in ('created','attempted');
    if not exists (select 1 from public.payment_transactions x where x.order_id = o.id and x.status = 'authorized') then
      update public.sharing_campaigns set campaign_status = 'payment_failed', payment_status = 'failed', updated_at = now()
       where id = c.id and campaign_status in ('awaiting_payment','payment_pending','payment_failed');
    end if;
    return jsonb_build_object('result', 'failed', 'campaign_id', c.id);
  end if;
  -- created / authorized: money on its way, sharing stays locked
  update public.payment_orders set status = 'attempted', updated_at = now() where id = o.id and status = 'created';
  update public.sharing_campaigns set campaign_status = 'payment_pending', payment_status = 'pending', updated_at = now()
   where id = c.id and campaign_status in ('awaiting_payment','payment_failed','payment_pending');
  return jsonb_build_object('result', 'pending', 'campaign_id', c.id);
end $$;

-- A refund reported by Razorpay. Links already sent keep working; the campaign stops sharing.
-- p_refund: { id, payment_id, amount, status }
create or replace function public._svc_refund_apply(p_provider text, p_refund jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.payment_transactions; v_status text; v_total int;
begin
  select * into t from public.payment_transactions where provider = p_provider and provider_payment_id = p_refund->>'payment_id' for update;
  if not found then return jsonb_build_object('result', 'unknown_payment'); end if;
  v_status := case p_refund->>'status' when 'processed' then 'processed' when 'failed' then 'failed' else 'pending' end;
  insert into public.payment_refunds(transaction_id, provider, provider_refund_id, amount_paise, status, is_test, processed_at)
  values (t.id, p_provider, p_refund->>'id', (p_refund->>'amount')::int, v_status, t.is_test, case when v_status = 'processed' then now() end)
  on conflict (provider, provider_refund_id) do update set status = excluded.status, processed_at = coalesce(payment_refunds.processed_at, excluded.processed_at);
  select coalesce(sum(amount_paise), 0) into v_total from public.payment_refunds where transaction_id = t.id and status = 'processed';
  update public.payment_transactions set amount_refunded_paise = v_total, updated_at = now(),
         status = case when v_total >= amount_paise then 'refunded' when v_total > 0 then 'partially_refunded' else status end
   where id = t.id;
  if v_total >= t.amount_paise then
    update public.campaign_entitlements set status = 'refunded', updated_at = now() where transaction_id = t.id and status = 'active';
    update public.sharing_campaigns set entitlement_status = 'refunded', payment_status = 'refunded', updated_at = now(),
           campaign_status = case when campaign_status in ('ready','sharing') then 'completed' else campaign_status end,
           completed_at = case when campaign_status in ('ready','sharing') then now() else completed_at end
     where payment_transaction_id = t.id and entitlement_status = 'active';
  end if;
  return jsonb_build_object('result', 'ok', 'refunded_paise', v_total);
end $$;

-- Webhook bookkeeping: false when this event id was already processed (so it is skipped).
-- An event that arrived before but failed half-way is processed again (everything is idempotent).
create or replace function public._svc_webhook_seen(p_provider text, p_event_id text, p_type text, p_valid boolean, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.payment_webhook_events(provider, provider_event_id, event_type, signature_valid, payload)
  values (p_provider, p_event_id, left(p_type, 60), p_valid, p_payload)
  on conflict (provider, provider_event_id) do nothing returning id into v_id;
  if v_id is not null then return true; end if;
  return exists (select 1 from public.payment_webhook_events where provider = p_provider and provider_event_id = p_event_id
                 and processed_at is null and signature_valid);
end $$;

create or replace function public._svc_webhook_done(p_provider text, p_event_id text, p_result text) returns void
language sql security definer set search_path = public as $$
  update public.payment_webhook_events set result = left(p_result, 200), processed_at = now() where provider = p_provider and provider_event_id = p_event_id;
$$;

-- live-mode guard used by the Edge Function: is the database in live mode?
create or replace function public._svc_billing_mode() returns text
language sql stable security definer set search_path = public as $$ select (public._billing_policy()).mode; $$;

-- ---------------------------------------------------------------------
-- Admin: read-only for admins, changes for the Super Admin only
-- ---------------------------------------------------------------------
create or replace function public.admin_billing_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pol public.pricing_settings := public._billing_policy();
begin
  perform public._require_admin();
  return jsonb_build_object(
    'policy', to_jsonb(pol),
    'is_super_admin', public.is_super_admin(),
    'users', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'active30', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
      'new7', (select count(*) from auth.users where created_at > now() - interval '7 days')),
    'invitations', (select count(*) from public.invitations),
    'campaigns', jsonb_build_object(
      'total', (select count(*) from public.sharing_campaigns),
      'open', (select count(*) from public.sharing_campaigns where campaign_status in ('ready','sharing')),
      'paid', (select count(*) from public.campaign_entitlements e join public.payment_transactions t on t.id = e.transaction_id where e.grant_type = 'paid' and not t.is_test),
      'complimentary', (select count(*) from public.campaign_entitlements where grant_type = 'complimentary'),
      'awaiting', (select count(*) from public.sharing_campaigns where campaign_status in ('awaiting_payment','payment_failed'))),
    'payments', jsonb_build_object(
      'successful', (select count(*) from public.payment_transactions where status in ('captured','refunded','partially_refunded') and not is_test),
      'failed', (select count(*) from public.payment_transactions where status = 'failed' and not is_test),
      'pending', (select count(*) from public.sharing_campaigns c where c.campaign_status = 'payment_pending'),
      'flagged', (select count(*) from public.payment_transactions where flag is not null and not is_test),
      'revenue_paise', (select coalesce(sum(amount_paise), 0) from public.payment_transactions where status in ('captured','refunded','partially_refunded') and not is_test),
      'refunds_paise', (select coalesce(sum(amount_refunded_paise), 0) from public.payment_transactions where not is_test),
      'average_paise', (select coalesce(round(avg(amount_paise)), 0) from public.payment_transactions where status in ('captured','refunded','partially_refunded') and not is_test)),
    'test', jsonb_build_object(
      'successful', (select count(*) from public.payment_transactions where status in ('captured','refunded','partially_refunded') and is_test),
      'revenue_paise', (select coalesce(sum(amount_paise), 0) from public.payment_transactions where status in ('captured','refunded','partially_refunded') and is_test)),
    'promotions_active', (select count(*) from public.promotional_access where active and starts_at <= now() and ends_at > now()),
    'exemptions_active', (select count(*) from public.user_access_exemptions where revoked_at is null and (ends_at is null or ends_at > now()))
  );
end $$;

create or replace function public.admin_pricing() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return jsonb_build_object('current', to_jsonb(public._billing_policy()), 'is_super_admin', public.is_super_admin(),
    'history', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc), '[]'::jsonb) from (
       select p.*, u.email::text as created_by_email from public.pricing_settings p left join auth.users u on u.id = p.created_by order by p.id desc limit 20) x));
end $$;

-- p: any of payment_required, price_rupees, emergency_free, new_user_free_days, free_campaigns_per_user,
--    guest_cap, campaign_grace_days, mode, note, confirm_live
create or replace function public.admin_set_pricing(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.pricing_settings := public._billing_policy(); n public.pricing_settings; v_rupees numeric;
begin
  perform public._require_super_admin();
  n := cur;
  if p ? 'price_rupees' then
    v_rupees := (p->>'price_rupees')::numeric;
    if v_rupees is null or v_rupees <> trunc(v_rupees) or v_rupees < 10 or v_rupees > 100 then
      raise exception 'The price must be a whole number of rupees from ₹10 to ₹100.';
    end if;
    n.price_paise := (v_rupees * 100)::int;
  end if;
  if p ? 'payment_required' then n.payment_required := (p->>'payment_required')::boolean; end if;
  if p ? 'emergency_free' then n.emergency_free := (p->>'emergency_free')::boolean; end if;
  if p ? 'new_user_free_days' then n.new_user_free_days := (p->>'new_user_free_days')::int; end if;
  if p ? 'free_campaigns_per_user' then n.free_campaigns_per_user := (p->>'free_campaigns_per_user')::int; end if;
  if p ? 'guest_cap' then n.guest_cap := (p->>'guest_cap')::int; end if;
  if p ? 'campaign_grace_days' then n.campaign_grace_days := (p->>'campaign_grace_days')::int; end if;
  if p ? 'mode' then
    if p->>'mode' not in ('test','live') then raise exception 'Mode must be test or live.'; end if;
    if p->>'mode' = 'live' and cur.mode <> 'live' and coalesce(p->>'confirm_live', '') <> 'I approve live payments' then
      raise exception 'To take real money, type the confirmation sentence exactly.';
    end if;
    n.mode := p->>'mode';
  end if;
  insert into public.pricing_settings(payment_required, price_paise, currency, charging_model, provider, mode, emergency_free,
                                      new_user_free_days, free_campaigns_per_user, guest_cap, campaign_grace_days, note, created_by)
  values (n.payment_required, n.price_paise, n.currency, n.charging_model, n.provider, n.mode, n.emergency_free,
          n.new_user_free_days, n.free_campaigns_per_user, n.guest_cap, n.campaign_grace_days, nullif(left(trim(coalesce(p->>'note', '')), 300), ''), auth.uid())
  returning * into n;
  perform public._admin_log('pricing.update', 'pricing', n.id::text, 'Pricing & payments',
    jsonb_build_object('old', to_jsonb(cur) - 'created_by' - 'created_at' - 'id' - 'note', 'new', to_jsonb(n) - 'created_by' - 'created_at' - 'id' - 'note', 'note', n.note));
  return to_jsonb(n);
end $$;

create or replace function public.admin_promotions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_at desc) from (
    select p.*, (p.active and p.starts_at <= now() and p.ends_at > now()) as running,
           (select coalesce(jsonb_agg(u.email::text order by u.email), '[]'::jsonb) from public.promotion_users pu join auth.users u on u.id = pu.user_id where pu.promotion_id = p.id) as emails
      from public.promotional_access p order by p.starts_at desc limit 200) x), '[]'::jsonb);
end $$;

-- p: { id?, name, starts_at, ends_at, audience, total_quota, per_user_quota, active, emails[] }
create or replace function public.admin_save_promotion(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.promotional_access; v_missing text[]; e text;
begin
  perform public._require_super_admin();
  if coalesce(trim(p->>'name'), '') = '' then raise exception 'Give the promotion a name.'; end if;
  if (p->>'ends_at')::timestamptz <= (p->>'starts_at')::timestamptz then raise exception 'The end must be after the start.'; end if;
  if p ? 'id' and p->>'id' <> '' then
    update public.promotional_access set name = left(trim(p->>'name'), 120), starts_at = (p->>'starts_at')::timestamptz, ends_at = (p->>'ends_at')::timestamptz,
           audience = coalesce(p->>'audience', audience), total_quota = coalesce((p->>'total_quota')::int, total_quota),
           per_user_quota = coalesce((p->>'per_user_quota')::int, per_user_quota), active = coalesce((p->>'active')::boolean, active), updated_at = now()
     where id = (p->>'id')::uuid returning * into r;
    if not found then raise exception 'Promotion not found.'; end if;
  else
    insert into public.promotional_access(name, starts_at, ends_at, audience, total_quota, per_user_quota, active, created_by)
    values (left(trim(p->>'name'), 120), (p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz, coalesce(p->>'audience', 'everyone'),
            coalesce((p->>'total_quota')::int, 0), coalesce((p->>'per_user_quota')::int, 0), coalesce((p->>'active')::boolean, true), auth.uid())
    returning * into r;
  end if;
  if r.audience = 'selected' and p ? 'emails' then
    delete from public.promotion_users where promotion_id = r.id;
    for e in select lower(trim(x)) from jsonb_array_elements_text(p->'emails') x where trim(x) <> '' loop
      insert into public.promotion_users(promotion_id, user_id) select r.id, u.id from auth.users u where lower(u.email) = e on conflict do nothing;
      if not found then v_missing := v_missing || e; end if;
    end loop;
  end if;
  perform public._admin_log(case when p ? 'id' and p->>'id' <> '' then 'promotion.update' else 'promotion.create' end, 'promotion', r.id::text, r.name,
    jsonb_strip_nulls(jsonb_build_object('starts_at', r.starts_at, 'ends_at', r.ends_at, 'audience', r.audience, 'total_quota', r.total_quota,
      'per_user_quota', r.per_user_quota, 'active', r.active, 'not_found', to_jsonb(v_missing))));
  return to_jsonb(r) || jsonb_build_object('not_found', coalesce(to_jsonb(v_missing), '[]'::jsonb));
end $$;

create or replace function public.admin_exemptions(p_q text default '') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_q, '')));
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select x.*, u.email::text as email, g.email::text as granted_by_email,
           (x.revoked_at is null and x.starts_at <= now() and (x.ends_at is null or x.ends_at > now()) and (x.campaign_quota = 0 or x.used_count < x.campaign_quota)) as in_force
      from public.user_access_exemptions x join auth.users u on u.id = x.user_id left join auth.users g on g.id = x.granted_by
     where q = '' or strpos(lower(u.email), q) > 0
     order by x.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_grant_exemption(p_email text, p_reason text, p_ends_at timestamptz default null, p_quota int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_user uuid; r public.user_access_exemptions;
begin
  perform public._require_super_admin();
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'No InviteX account uses that email.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Write a short reason.'; end if;
  if p_quota is null or p_quota < 0 or p_quota > 1000 then raise exception 'Free campaigns must be 0 (no limit) to 1000.'; end if;
  insert into public.user_access_exemptions(user_id, reason, ends_at, campaign_quota, granted_by)
  values (v_user, left(trim(p_reason), 300), p_ends_at, p_quota, auth.uid()) returning * into r;
  perform public._admin_log('access.grant', 'user', v_user::text, lower(trim(p_email)),
    jsonb_strip_nulls(jsonb_build_object('reason', r.reason, 'until', r.ends_at, 'campaigns', nullif(r.campaign_quota, 0))));
  return to_jsonb(r);
end $$;

create or replace function public.admin_revoke_exemption(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.user_access_exemptions; v_email text;
begin
  perform public._require_super_admin();
  update public.user_access_exemptions set revoked_at = now(), revoked_by = auth.uid() where id = p_id and revoked_at is null returning * into r;
  if not found then raise exception 'That free access was not found or is already ended.'; end if;
  select email into v_email from auth.users where id = r.user_id;
  -- campaigns already unlocked with it stay unlocked; only new campaigns are affected
  perform public._admin_log('access.revoke', 'user', r.user_id::text, v_email, jsonb_build_object('reason', r.reason, 'used', r.used_count));
  return to_jsonb(r);
end $$;

create or replace function public.admin_campaigns(p_q text default '', p_status text default 'all', p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_q, ''))); v_total int; v_rows jsonb;
begin
  perform public._require_admin();
  select count(*) into v_total from public.sharing_campaigns c join auth.users u on u.id = c.user_id
   where (p_status = 'all' or c.campaign_status = p_status or (p_status = 'unlocked' and c.entitlement_status = 'active'))
     and (q = '' or strpos(lower(u.email), q) > 0 or strpos(lower(c.campaign_name), q) > 0);
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb) into v_rows from (
    select public._campaign_json(c.id) || jsonb_build_object('owner_email', u.email::text, 'slug', i.slug) as x
      from public.sharing_campaigns c join auth.users u on u.id = c.user_id join public.invitations i on i.id = c.invitation_id
     where (p_status = 'all' or c.campaign_status = p_status or (p_status = 'unlocked' and c.entitlement_status = 'active'))
       and (q = '' or strpos(lower(u.email), q) > 0 or strpos(lower(c.campaign_name), q) > 0)
     order by c.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 500) offset greatest(coalesce(p_offset, 0), 0)) s;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

-- One row per payment attempt (orders with no attempt yet get one row). p_status: all | paid | failed | pending | refunded | flagged
create or replace function public.admin_payments(p_q text default '', p_status text default 'all', p_from date default null, p_to date default null,
                                                 p_test boolean default false, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_q, ''))); v_total int; v_rows jsonb;
begin
  perform public._require_admin();
  select coalesce(max(total), 0), coalesce(jsonb_agg(to_jsonb(b) - 'total' order by b.created_at desc), '[]'::jsonb) into v_total, v_rows from (
    select o.id, coalesce(t.created_at, o.created_at) as created_at, o.amount_paise as order_amount_paise, t.amount_paise, o.currency, o.status as order_status, o.provider, o.provider_order_id, o.is_test,
           c.campaign_name, c.id as campaign_id, u.email::text as email,
           t.provider_payment_id, t.status as payment_status, t.method, t.flag, t.amount_refunded_paise, t.captured_at, t.error_description, t.verified_via,
           count(*) over () as total
      from public.payment_orders o join public.sharing_campaigns c on c.id = o.campaign_id join auth.users u on u.id = o.user_id
      left join public.payment_transactions t on t.order_id = o.id
     where o.status <> 'creating' and o.is_test = coalesce(p_test, false)
       and (p_from is null or o.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata'))
       and (p_to is null or o.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata'))
       and (q = '' or strpos(lower(u.email), q) > 0 or strpos(lower(c.campaign_name), q) > 0
            or strpos(lower(coalesce(t.provider_payment_id, '')), q) > 0 or strpos(lower(coalesce(o.provider_order_id, '')), q) > 0)
       and (p_status = 'all'
            or (p_status = 'paid' and t.status = 'captured')
            or (p_status = 'refunded' and t.status in ('refunded','partially_refunded'))
            or (p_status = 'failed' and (t.status = 'failed' or (t.id is null and o.status = 'failed')))
            or (p_status = 'pending' and (t.status in ('created','authorized') or (t.id is null and o.status in ('created','attempted'))))
            or (p_status = 'flagged' and t.flag is not null))
     order by coalesce(t.created_at, o.created_at) desc
     limit least(greatest(coalesce(p_limit, 50), 1), 5000) offset greatest(coalesce(p_offset, 0), 0)) b;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

-- Revenue by day (India time) for the last p_days days.
create or replace function public.admin_revenue(p_days int default 30, p_test boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n int := least(greatest(coalesce(p_days, 30), 1), 366); v_start date := (now() at time zone 'Asia/Kolkata')::date - (least(greatest(coalesce(p_days, 30), 1), 366) - 1);
begin
  perform public._require_admin();
  return jsonb_build_object('days', (select jsonb_agg(jsonb_build_object(
      'day', d::date,
      'payments', (select count(*) from public.payment_transactions t where t.is_test = p_test and t.status in ('captured','refunded','partially_refunded')
                    and (t.captured_at at time zone 'Asia/Kolkata')::date = d::date),
      'revenue_paise', (select coalesce(sum(t.amount_paise), 0) from public.payment_transactions t where t.is_test = p_test and t.status in ('captured','refunded','partially_refunded')
                    and (t.captured_at at time zone 'Asia/Kolkata')::date = d::date),
      'refunds_paise', (select coalesce(sum(r.amount_paise), 0) from public.payment_refunds r where r.is_test = p_test and r.status = 'processed'
                    and (r.processed_at at time zone 'Asia/Kolkata')::date = d::date),
      'free_campaigns', (select count(*) from public.campaign_entitlements e where e.grant_type = 'complimentary' and e.source <> 'existing'
                    and (e.created_at at time zone 'Asia/Kolkata')::date = d::date)
    ) order by d) from generate_series(v_start, v_start + n - 1, interval '1 day') d),
    'by_source', (select coalesce(jsonb_object_agg(source, k), '{}'::jsonb) from (select source, count(*) k from public.campaign_entitlements
                   where created_at >= (v_start::timestamp at time zone 'Asia/Kolkata') group by source) s));
end $$;

-- ---------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------
do $$ declare f text; begin
  -- internal and server-only functions: nobody from the browser
  foreach f in array array[
    'public._billing_policy()', 'public._campaign_closes_at(uuid,int)', 'public._access_decision(uuid)', 'public._campaign_autoclose(uuid)',
    'public._grant_complimentary(uuid,jsonb)', 'public._campaign_json(uuid)', 'public._guest_access(uuid)', 'public._require_host()',
    'public._svc_order_prepare(uuid,uuid,text)', 'public._svc_order_created(uuid,text)', 'public._svc_order_create_failed(uuid,text)',
    'public._svc_campaign_order(uuid,uuid)', 'public._svc_orders_to_reconcile(int)', 'public._svc_payment_apply(text,text,jsonb,text)',
    'public._svc_refund_apply(text,jsonb)', 'public._svc_webhook_seen(text,text,text,boolean,jsonb)', 'public._svc_webhook_done(text,text,text)',
    'public._svc_billing_mode()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    foreach f in array array['public._svc_order_prepare(uuid,uuid,text)', 'public._svc_order_created(uuid,text)', 'public._svc_order_create_failed(uuid,text)',
      'public._svc_campaign_order(uuid,uuid)', 'public._svc_orders_to_reconcile(int)', 'public._svc_payment_apply(text,text,jsonb,text)',
      'public._svc_refund_apply(text,jsonb)', 'public._svc_webhook_seen(text,text,text,boolean,jsonb)', 'public._svc_webhook_done(text,text,text)',
      'public._svc_billing_mode()'] loop
      execute format('grant execute on function %s to service_role', f);
    end loop;
  end if;
  -- signed-in hosts and admins (each function checks who is calling)
  foreach f in array array[
    'public.my_sharing_quote()', 'public.campaign_state(uuid)', 'public.campaign_start(uuid,text,text,text)',
    'public.campaign_mark_shared(uuid,uuid,text,text)', 'public.campaign_complete(uuid)', 'public.campaign_reopen(uuid)', 'public.campaign_cancel(uuid)',
    'public.my_campaigns(uuid)', 'public.my_payments()',
    'public.admin_billing_overview()', 'public.admin_pricing()', 'public.admin_set_pricing(jsonb)', 'public.admin_promotions()',
    'public.admin_save_promotion(jsonb)', 'public.admin_exemptions(text)', 'public.admin_grant_exemption(text,text,timestamptz,int)',
    'public.admin_revoke_exemption(uuid)', 'public.admin_campaigns(text,text,int,int)',
    'public.admin_payments(text,text,date,date,boolean,int,int)', 'public.admin_revenue(int,boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
