-- =====================================================================
-- InviteX designer marketplace (pilot, India only) – database foundation
-- Run order: schema.sql, admin.sql, ai-designs.sql, billing.sql, marketplace.sql.
-- Safe to run again.
--
-- What lives here
--   * designer applications and designer accounts (invite-only pilot)
--   * designs: artwork + text zones + palettes + fonts, reviewed by an admin
--   * template licences: a host who buys a design may use it on all of their own events
--   * an append-only earnings ledger; balances are always computed from it
--   * the rule that an invitation using a premium design cannot be published without a licence
--
-- Money is in paise. Prices include 18% GST. The designer's share applies to NET revenue:
--   net = price − GST in the price − payment fee (incl. GST on the fee)
--   share = 60% standard, 70% exclusive to InviteX, 80% for sales the designer referred;
--           pilot designers get +10 points until their bonus ends (capped at 90%).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings (one row). Only the Super Admin changes these.
-- ---------------------------------------------------------------------
create table if not exists public.marketplace_settings (
  id                   int primary key default 1 check (id = 1),
  share_standard_pct   int not null default 60 check (share_standard_pct between 0 and 90),
  share_exclusive_pct  int not null default 70 check (share_exclusive_pct between 0 and 90),
  share_referral_pct   int not null default 80 check (share_referral_pct between 0 and 90),
  pilot_bonus_pct      int not null default 10 check (pilot_bonus_pct between 0 and 30),
  share_cap_pct        int not null default 90 check (share_cap_pct between 0 and 95),
  gst_pct              numeric(5,2) not null default 18,
  price_tiers_paise    int[] not null default array[9900, 14900, 19900, 24900],
  pending_days         int not null default 14,   -- a sale's earning becomes available after this
  new_designer_hold_days int not null default 30, -- first payout waits at least this long after joining
  payout_threshold_paise int not null default 50000,
  weekly_submissions_new int not null default 5,
  refund_window_hours  int not null default 24,   -- automatic refund before sharing starts
  agreement_version    text not null default '2026-11-pilot',
  updated_at           timestamptz not null default now()
);
insert into public.marketplace_settings(id) values (1) on conflict (id) do nothing;

create or replace function public._mk() returns public.marketplace_settings
language sql stable security definer set search_path = public as $$ select * from public.marketplace_settings where id = 1 $$;

-- ---------------------------------------------------------------------
-- Designer applications and designers
-- ---------------------------------------------------------------------
create table if not exists public.designer_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 2 and 80),
  city          text not null check (char_length(city) between 2 and 80),
  state         text not null check (char_length(state) between 2 and 60),
  portfolio_url text not null check (portfolio_url ~* '^https://[^[:space:]]{4,}$' and char_length(portfolio_url) <= 300),
  sample_paths  text[] not null default '{}' check (cardinality(sample_paths) between 0 and 6),
  occasions     text[] not null default '{}',
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note   text,
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
-- one open application per person
create unique index if not exists designer_applications_one_open on public.designer_applications(user_id) where status = 'pending';

create table if not exists public.designers (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  display_name       text not null check (char_length(display_name) between 2 and 80),
  slug               text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  city               text not null,
  state              text not null,
  trust_level        text not null default 'new' check (trust_level in ('new','trusted','featured')),
  status             text not null default 'active' check (status in ('active','paused','closed')),
  status_reason      text,
  agreement_version  text,
  agreement_at       timestamptz,
  pilot_bonus_until  date,                      -- set for pilot designers: +bonus points until this date
  referral_code      text not null unique default lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  -- payout details (India only). Only masked values are kept here; full details live with the payout provider.
  kyc_status         text not null default 'none' check (kyc_status in ('none','pending','verified','failed')),
  pan_last4          text check (pan_last4 is null or pan_last4 ~ '^[A-Z0-9]{4}$'),
  payout_method      text check (payout_method in ('upi','bank')),
  payout_masked      text,
  payout_contact_ref text,                      -- RazorpayX contact / fund account id
  joined_at          timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Designs
-- pages: [{ role: 'front'|'events'|'rsvp'|'back', path: 'designer-art/<uid>/<id>/front.png',
--           preview: '<watermarked 800px path>', zones: [{ key, x, y, w, h, align, maxLines }] }]
-- Coordinates are fractions of the page (0..1) so they work at any size.
-- ---------------------------------------------------------------------
create table if not exists public.designs (
  id             uuid primary key default gen_random_uuid(),
  designer_id    uuid not null references public.designers(user_id) on delete cascade,
  title          text not null default '' check (char_length(title) <= 80),
  occasion       text not null default 'wedding',
  style_tags     text[] not null default '{}',
  tags           text[] not null default '{}' check (cardinality(tags) <= 8),
  languages      text[] not null default array['en'],
  price_paise    int not null default 14900,
  exclusive      boolean not null default false,
  exclusive_until date,
  pages          jsonb not null default '[]'::jsonb,
  palettes       jsonb not null default '[]'::jsonb,
  font_pairing   text not null default '',
  phash          text[] not null default '{}',  -- 64-bit perceptual hash (16 hex chars) per page
  source_path    text,                         -- layered source file (required for a new designer's first 5)
  ai_use         text not null default 'none' check (ai_use in ('none','assisted','mostly')),
  rights         jsonb,                        -- the declaration, stored as ticked, with time
  flags          text[] not null default '{}', -- e.g. possible_duplicate
  status         text not null default 'draft' check (status in ('draft','in_review','changes_requested','live','paused','removed')),
  review_note    text,
  submitted_at   timestamptz,
  approved_at    timestamptz,
  removal_requested_at timestamptz,            -- designer asked to remove: stops sales after the notice period
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists designs_live_idx on public.designs(occasion, approved_at desc) where status = 'live';
create index if not exists designs_designer_idx on public.designs(designer_id, updated_at desc);

-- every review decision, append-only
create table if not exists public.design_reviews (
  id          bigint generated always as identity primary key,
  design_id   uuid not null references public.designs(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision    text not null check (decision in ('approve','changes','reject','reject_flag','pause','restore','remove')),
  reason      text,
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Licences and the earnings ledger
-- ---------------------------------------------------------------------
create table if not exists public.template_licenses (
  id              uuid primary key default gen_random_uuid(),
  design_id       uuid not null references public.designs(id) on delete restrict,
  user_id         uuid not null references auth.users(id) on delete cascade,
  amount_paise    int not null check (amount_paise >= 0),
  fee_paise       int not null default 0 check (fee_paise >= 0),
  provider        text not null default 'razorpay' check (provider in ('razorpay','simulated','complimentary')),
  provider_payment_id text,
  referral_code   text,
  status          text not null default 'active' check (status in ('active','refunded','revoked')),
  first_shared_at timestamptz,               -- set when an invitation using it starts sharing
  created_at      timestamptz not null default now(),
  refunded_at     timestamptz,
  unique (provider, provider_payment_id)
);
-- a host owns a design once
create unique index if not exists template_licenses_one_active on public.template_licenses(design_id, user_id) where status = 'active';

create table if not exists public.designer_ledger (
  id            bigint generated always as identity primary key,
  designer_id   uuid not null references public.designers(user_id) on delete restrict,
  design_id     uuid references public.designs(id) on delete set null,
  license_id    uuid references public.template_licenses(id) on delete set null,
  payout_id     uuid,
  kind          text not null check (kind in ('sale','refund','chargeback','adjustment','payout','payout_failed')),
  gross_paise   int not null default 0,
  gst_paise     int not null default 0,
  fee_paise     int not null default 0,
  net_paise     int not null default 0,
  share_pct     int,
  amount_paise  int not null,                 -- designer's money: + earned, − reversed or paid out
  available_at  timestamptz not null default now(),
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists designer_ledger_designer_idx on public.designer_ledger(designer_id, created_at desc);
create or replace function public.designer_ledger_append_only() returns trigger language plpgsql as $$
begin raise exception 'The earnings ledger cannot be changed or deleted. Add an adjustment instead.' using errcode = '42501'; end $$;
drop trigger if exists t_designer_ledger_append_only on public.designer_ledger;
create trigger t_designer_ledger_append_only before update or delete on public.designer_ledger
  for each row execute function public.designer_ledger_append_only();

create table if not exists public.designer_payouts (
  id            uuid primary key default gen_random_uuid(),
  designer_id   uuid not null references public.designers(user_id) on delete restrict,
  amount_paise  int not null check (amount_paise > 0),
  status        text not null default 'queued' check (status in ('queued','processing','paid','failed')),
  provider_ref  text,
  failure       text,
  period        text not null,                 -- 'YYYY-MM' the payout covers
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (designer_id, period)
);

-- ---------------------------------------------------------------------
-- Row level security: people read their own rows; every change goes through the functions below
-- ---------------------------------------------------------------------
alter table public.marketplace_settings  enable row level security;
alter table public.designer_applications enable row level security;
alter table public.designers             enable row level security;
alter table public.designs               enable row level security;
alter table public.design_reviews        enable row level security;
alter table public.template_licenses     enable row level security;
alter table public.designer_ledger       enable row level security;
alter table public.designer_payouts      enable row level security;
revoke all on public.marketplace_settings, public.designer_applications, public.designers, public.designs, public.design_reviews,
              public.template_licenses, public.designer_ledger, public.designer_payouts from anon, authenticated;
grant select on public.designer_applications, public.designers, public.designs, public.template_licenses,
               public.designer_ledger, public.designer_payouts to authenticated;

drop policy if exists mk_app_own on public.designer_applications;
create policy mk_app_own on public.designer_applications for select to authenticated using (user_id = auth.uid());
drop policy if exists mk_designer_own on public.designers;
create policy mk_designer_own on public.designers for select to authenticated using (user_id = auth.uid());
drop policy if exists mk_designs_own on public.designs;
create policy mk_designs_own on public.designs for select to authenticated using (designer_id = auth.uid());
drop policy if exists mk_lic_own on public.template_licenses;
create policy mk_lic_own on public.template_licenses for select to authenticated using (user_id = auth.uid());
drop policy if exists mk_ledger_own on public.designer_ledger;
create policy mk_ledger_own on public.designer_ledger for select to authenticated using (designer_id = auth.uid());
drop policy if exists mk_payout_own on public.designer_payouts;
create policy mk_payout_own on public.designer_payouts for select to authenticated using (designer_id = auth.uid());

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public._mk_require_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'Your account is paused.' using errcode = '42501'; end if;
  return auth.uid();
end $$;

create or replace function public._mk_require_designer() returns public.designers
language plpgsql stable security definer set search_path = public as $$
declare d public.designers;
begin
  perform public._mk_require_user();
  select * into d from public.designers where user_id = auth.uid();
  if not found then raise exception 'This is for approved InviteX designers.' using errcode = '42501'; end if;
  if d.status <> 'active' then raise exception 'Your designer account is %.', d.status using errcode = '42501'; end if;
  return d;
end $$;

-- Hamming distance between two 64-bit perceptual hashes written as 16 hex characters
create or replace function public._mk_hamming(a text, b text) returns int
language sql immutable as $$
  select case when a ~ '^[0-9a-f]{16}$' and b ~ '^[0-9a-f]{16}$'
              then bit_count(('x' || a)::bit(64) # ('x' || b)::bit(64))::int end
$$;

-- The designer's share (percent of net) for one sale
create or replace function public._mk_share_pct(p_designer uuid, p_design uuid, p_referred boolean, p_at timestamptz default now()) returns int
language plpgsql stable security definer set search_path = public as $$
declare s public.marketplace_settings := public._mk(); d public.designers; g public.designs; v int;
begin
  select * into d from public.designers where user_id = p_designer;
  select * into g from public.designs where id = p_design;
  v := case when p_referred then s.share_referral_pct
            when g.exclusive and (g.exclusive_until is null or g.exclusive_until >= p_at::date) then s.share_exclusive_pct
            else s.share_standard_pct end;
  if d.pilot_bonus_until is not null and d.pilot_bonus_until >= p_at::date then v := v + s.pilot_bonus_pct; end if;
  return least(v, s.share_cap_pct);
end $$;

-- Split one sale: GST is inside the price; the fee includes GST on the fee
create or replace function public._mk_split(p_gross int, p_fee int, p_pct int) returns jsonb
language plpgsql immutable as $$
declare v_gst int; v_net int; v_designer int;
begin
  v_gst := round(p_gross * 18.0 / 118.0);
  v_net := greatest(p_gross - v_gst - p_fee, 0);
  v_designer := floor(v_net * p_pct / 100.0);
  return jsonb_build_object('gross', p_gross, 'gst', v_gst, 'fee', p_fee, 'net', v_net, 'pct', p_pct,
                            'designer', v_designer, 'platform', v_net - v_designer);
end $$;

-- ---------------------------------------------------------------------
-- Designer side
-- ---------------------------------------------------------------------
create or replace function public.designer_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._mk_require_user(); v_id uuid;
begin
  if exists (select 1 from public.designers where user_id = v_uid) then return jsonb_build_object('ok', false, 'code', 'already_designer'); end if;
  if exists (select 1 from public.designer_applications where user_id = v_uid and status = 'pending') then
    return jsonb_build_object('ok', false, 'code', 'already_applied'); end if;
  begin
    insert into public.designer_applications(user_id, display_name, city, state, portfolio_url, sample_paths, occasions)
    values (v_uid, trim(p->>'displayName'), trim(p->>'city'), trim(p->>'state'), trim(p->>'portfolioUrl'),
            coalesce((select array_agg(x) from (select left(x, 300) x from jsonb_array_elements_text(coalesce(p->'samples', '[]'::jsonb)) x limit 6) s), '{}'),
            coalesce((select array_agg(left(x, 40)) from jsonb_array_elements_text(coalesce(p->'occasions', '[]'::jsonb)) x), '{}'))
    returning id into v_id;
  exception when check_violation or not_null_violation then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Please fill in your name, city, state and a portfolio link starting with https://');
  end;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.designer_accept_agreement(p_version text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.designers := public._mk_require_designer();
begin
  if p_version is distinct from (public._mk()).agreement_version then
    return jsonb_build_object('ok', false, 'code', 'old_version', 'current', (public._mk()).agreement_version); end if;
  update public.designers set agreement_version = p_version, agreement_at = now(), updated_at = now() where user_id = d.user_id;
  return jsonb_build_object('ok', true);
end $$;

-- Create or update a draft. Only drafts and designs with changes requested can be edited.
create or replace function public.designer_save_design(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.designers := public._mk_require_designer(); s public.marketplace_settings := public._mk(); g public.designs; v_id uuid;
begin
  if d.agreement_version is distinct from s.agreement_version then return jsonb_build_object('ok', false, 'code', 'agreement_needed'); end if;
  if coalesce((p->>'price')::int, 14900) <> all(s.price_tiers_paise) then return jsonb_build_object('ok', false, 'code', 'bad_price'); end if;
  if jsonb_typeof(coalesce(p->'pages', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p->'pages', '[]'::jsonb)) > 4 then
    return jsonb_build_object('ok', false, 'code', 'bad_pages'); end if;
  if coalesce(p->>'aiUse', 'none') not in ('none','assisted','mostly') then return jsonb_build_object('ok', false, 'code', 'invalid'); end if;
  v_id := nullif(p->>'id', '')::uuid;
  if v_id is not null then
    select * into g from public.designs where id = v_id and designer_id = d.user_id for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if g.status not in ('draft','changes_requested') then return jsonb_build_object('ok', false, 'code', 'locked', 'status', g.status); end if;
  end if;
  insert into public.designs as x (id, designer_id, title, occasion, style_tags, tags, languages, price_paise, exclusive, pages, palettes, font_pairing, phash, source_path, ai_use)
  values (coalesce(v_id, gen_random_uuid()), d.user_id, left(trim(coalesce(p->>'title', '')), 80), left(coalesce(p->>'occasion', 'wedding'), 40),
          coalesce((select array_agg(left(x, 30)) from (select x from jsonb_array_elements_text(coalesce(p->'styleTags', '[]'::jsonb)) x limit 6) t), '{}'),
          coalesce((select array_agg(lower(left(x, 30))) from (select x from jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb)) x limit 8) t), '{}'),
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'languages', '["en"]'::jsonb)) x where x in ('en','hi','pa')), array['en']),
          coalesce((p->>'price')::int, 14900), coalesce((p->>'exclusive')::boolean, false),
          coalesce(p->'pages', '[]'::jsonb), coalesce(p->'palettes', '[]'::jsonb), left(coalesce(p->>'fonts', ''), 60),
          coalesce((select array_agg(lower(x)) from jsonb_array_elements_text(coalesce(p->'phash', '[]'::jsonb)) x where lower(x) ~ '^[0-9a-f]{16}$'), '{}'),
          nullif(left(coalesce(p->>'sourcePath', ''), 300), ''), coalesce(p->>'aiUse', 'none'))
  on conflict (id) do update set title = excluded.title, occasion = excluded.occasion, style_tags = excluded.style_tags, tags = excluded.tags,
     languages = excluded.languages, price_paise = excluded.price_paise, exclusive = excluded.exclusive, pages = excluded.pages,
     palettes = excluded.palettes, font_pairing = excluded.font_pairing, phash = excluded.phash, source_path = excluded.source_path,
     ai_use = excluded.ai_use, updated_at = now()
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Submit for review with the rights declaration. p_rights: { own: true, noThirdParty: true, noLikeness: true,
-- notSoldExclusive: true, understandsLiability: true }
create or replace function public.designer_submit_design(p_id uuid, p_rights jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.designers := public._mk_require_designer(); s public.marketplace_settings := public._mk(); g public.designs;
        v_flags text[] := '{}'; v_done int; k text;
begin
  select * into g from public.designs where id = p_id and designer_id = d.user_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if g.status not in ('draft','changes_requested') then return jsonb_build_object('ok', false, 'code', 'locked'); end if;
  foreach k in array array['own','noThirdParty','noLikeness','notSoldExclusive','understandsLiability'] loop
    if coalesce((p_rights->>k)::boolean, false) is not true then return jsonb_build_object('ok', false, 'code', 'rights_missing', 'item', k); end if;
  end loop;
  if g.ai_use = 'mostly' then return jsonb_build_object('ok', false, 'code', 'ai_not_allowed'); end if;
  if char_length(g.title) < 3 then return jsonb_build_object('ok', false, 'code', 'needs_title'); end if;
  if jsonb_array_length(g.pages) < 1 or not exists (select 1 from jsonb_array_elements(g.pages) pg where pg->>'role' = 'front' and coalesce(pg->>'path', '') <> '') then
    return jsonb_build_object('ok', false, 'code', 'needs_front'); end if;
  if jsonb_array_length(g.palettes) < 1 then return jsonb_build_object('ok', false, 'code', 'needs_palette'); end if;
  -- a new designer's first 5 designs need the layered source file
  select count(*) into v_done from public.designs where designer_id = d.user_id and approved_at is not null;
  if d.trust_level = 'new' and v_done < 5 and g.source_path is null then return jsonb_build_object('ok', false, 'code', 'needs_source'); end if;
  -- new designers: at most N submissions a week
  if d.trust_level = 'new'
     and (select count(*) from public.designs x where x.designer_id = d.user_id and x.submitted_at > now() - interval '7 days' and x.id <> g.id) >= s.weekly_submissions_new then
    return jsonb_build_object('ok', false, 'code', 'weekly_limit', 'n', s.weekly_submissions_new);
  end if;
  -- near-duplicates of someone else's design are held for a closer look (never auto-rejected)
  if exists (select 1 from public.designs o, unnest(o.phash) a, unnest(g.phash) b
              where o.designer_id <> d.user_id and o.status in ('in_review','live','paused','removed') and public._mk_hamming(a, b) <= 6) then
    v_flags := v_flags || 'possible_duplicate'::text;
  end if;
  if g.ai_use = 'assisted' then v_flags := v_flags || 'ai_assisted'::text; end if;
  update public.designs set status = 'in_review', submitted_at = now(), flags = v_flags, updated_at = now(),
         rights = p_rights || jsonb_build_object('at', now(), 'agreement', d.agreement_version) where id = g.id;
  return jsonb_build_object('ok', true, 'flags', to_jsonb(v_flags));
end $$;

-- Earnings: pending (not yet available), available (can be paid), paid out, and lifetime
create or replace function public.designer_balance() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d public.designers := public._mk_require_designer();
begin
  return public._mk_balance(d.user_id);
end $$;

create or replace function public._mk_balance(p_designer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pending',   coalesce(sum(amount_paise) filter (where kind in ('sale','refund','chargeback','adjustment') and available_at > now()), 0),
    'available', coalesce(sum(amount_paise) filter (where available_at <= now() or kind in ('payout','payout_failed')), 0),
    'paid',      -coalesce(sum(amount_paise) filter (where kind = 'payout'), 0) - coalesce(sum(amount_paise) filter (where kind = 'payout_failed'), 0),
    'lifetime',  coalesce(sum(amount_paise) filter (where kind in ('sale','refund','chargeback','adjustment')), 0),
    'sales',     count(*) filter (where kind = 'sale'))
  from public.designer_ledger where designer_id = p_designer;
$$;

-- Everything the designer page needs to decide what to show
create or replace function public.my_designer_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._mk_require_user(); s public.marketplace_settings := public._mk(); d public.designers; a public.designer_applications;
begin
  select * into d from public.designers where user_id = v_uid;
  select * into a from public.designer_applications where user_id = v_uid order by created_at desc limit 1;
  return jsonb_build_object(
    'settings', jsonb_build_object('tiers', to_jsonb(s.price_tiers_paise), 'standard', s.share_standard_pct, 'exclusive', s.share_exclusive_pct,
                                   'referral', s.share_referral_pct, 'bonus', s.pilot_bonus_pct, 'cap', s.share_cap_pct, 'agreement', s.agreement_version,
                                   'threshold', s.payout_threshold_paise, 'pendingDays', s.pending_days),
    'application', case when a.id is null then null else jsonb_build_object('status', a.status, 'note', a.review_note, 'at', a.created_at) end,
    'designer', case when d.user_id is null then null else jsonb_build_object('name', d.display_name, 'slug', d.slug, 'status', d.status,
                  'trust', d.trust_level, 'agreement', d.agreement_version, 'bonusUntil', d.pilot_bonus_until, 'referral', d.referral_code,
                  'kyc', d.kyc_status, 'approvedCount', (select count(*) from public.designs x where x.designer_id = d.user_id and x.approved_at is not null)) end,
    'balance', case when d.user_id is null then null else public._mk_balance(d.user_id) end);
end $$;

create or replace function public.designer_designs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d public.designers := public._mk_require_designer();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'occasion', g.occasion, 'styleTags', g.style_tags, 'tags', g.tags,
            'languages', g.languages, 'price', g.price_paise, 'exclusive', g.exclusive, 'pages', g.pages, 'palettes', g.palettes, 'fonts', g.font_pairing,
            'phash', g.phash, 'sourcePath', g.source_path, 'aiUse', g.ai_use, 'status', g.status, 'reviewNote', g.review_note,
            'sales', (select count(*) from public.designer_ledger l where l.design_id = g.id and l.kind = 'sale'),
            'earned', (select coalesce(sum(amount_paise), 0) from public.designer_ledger l where l.design_id = g.id and l.kind in ('sale','refund','chargeback')),
            'updatedAt', g.updated_at) order by g.updated_at desc)
     from public.designs g where g.designer_id = d.user_id), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- Host side: browsing and owning designs
-- ---------------------------------------------------------------------
-- Live designs for the gallery. Only preview images are returned, never the full-resolution artwork.
create or replace function public.marketplace_designs(p_occasion text default null, p_q text default null, p_limit int default 48, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'approvedAt' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', g.id, 'title', g.title, 'occasion', g.occasion, 'styleTags', g.style_tags, 'tags', g.tags,
             'languages', g.languages, 'price', g.price_paise, 'designer', jsonb_build_object('name', d.display_name, 'slug', d.slug),
             'previews', (select coalesce(jsonb_agg(jsonb_build_object('role', pg->>'role', 'preview', pg->>'preview')), '[]'::jsonb) from jsonb_array_elements(g.pages) pg),
             'palettes', g.palettes, 'fonts', g.font_pairing, 'approvedAt', g.approved_at,
             'owned', exists (select 1 from public.template_licenses l where l.design_id = g.id and l.user_id = auth.uid() and l.status = 'active')) x
      from public.designs g join public.designers d on d.user_id = g.designer_id
     where g.status = 'live' and d.status = 'active'
       and (p_occasion is null or g.occasion = p_occasion)
       and (p_q is null or g.title ilike '%' || p_q || '%' or lower(p_q) = any(g.tags) or p_q ilike any(g.style_tags))
     order by g.approved_at desc
     limit least(greatest(coalesce(p_limit, 48), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) s;
$$;

-- The full design (artwork paths and text zones) for a host who owns it
create or replace function public.my_design(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._mk_require_user(); g public.designs;
begin
  if not exists (select 1 from public.template_licenses where design_id = p_id and user_id = v_uid and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'not_owned'); end if;
  select * into g from public.designs where id = p_id;
  return jsonb_build_object('ok', true, 'design', jsonb_build_object('id', g.id, 'title', g.title, 'pages', g.pages, 'palettes', g.palettes, 'fonts', g.font_pairing));
end $$;

create or replace function public.my_design_licenses() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'designId', l.design_id, 'title', g.title, 'status', l.status, 'amount', l.amount_paise, 'at', l.created_at)
                            order by l.created_at desc), '[]'::jsonb)
    from public.template_licenses l join public.designs g on g.id = l.design_id
   where l.user_id = auth.uid();
$$;

-- An invitation that uses a premium design can only be published by a host who owns that design.
-- The editor stores the choice in published.marketplace.designId. Removed or paused designs keep
-- working for hosts who already own them.
create or replace function public._mk_invitation_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_design uuid;
begin
  if new.status <> 'published' or new.published is null then return new; end if;
  v_design := nullif(new.published #>> '{marketplace,designId}', '')::uuid;
  if v_design is null then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' and (old.published #>> '{marketplace,designId}') is not distinct from v_design::text
     and exists (select 1 from public.template_licenses where design_id = v_design and user_id = new.owner_id and status = 'active') then
    return new;
  end if;
  if not exists (select 1 from public.template_licenses where design_id = v_design and user_id = new.owner_id and status = 'active') then
    raise exception 'This design needs to be bought before the invitation can be published.' using errcode = '42501', hint = 'design_not_owned';
  end if;
  return new;
end $$;
drop trigger if exists t_mk_invitation_guard on public.invitations;
create trigger t_mk_invitation_guard before insert or update of status, published on public.invitations
  for each row execute function public._mk_invitation_guard();

-- ---------------------------------------------------------------------
-- Service steps (called by the payment Edge Function with the service role, never by browsers)
-- ---------------------------------------------------------------------
-- A captured payment for a design: grant the licence and book the designer's earning.
create or replace function public._svc_design_sale(p_user uuid, p_design uuid, p_amount int, p_fee int, p_provider text,
                                                   p_payment_id text, p_referral text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.marketplace_settings := public._mk(); g public.designs; d public.designers; l public.template_licenses;
        v_ref boolean; v_pct int; v_split jsonb;
begin
  select * into g from public.designs where id = p_design;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if g.status <> 'live' then return jsonb_build_object('ok', false, 'code', 'not_for_sale', 'refund', true); end if;
  if p_amount <> g.price_paise then return jsonb_build_object('ok', false, 'code', 'amount_mismatch', 'refund', true); end if;
  select * into l from public.template_licenses where provider = p_provider and provider_payment_id = p_payment_id;
  if found then return jsonb_build_object('ok', true, 'license', l.id, 'already', true); end if;
  if exists (select 1 from public.template_licenses where design_id = p_design and user_id = p_user and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'already_owned', 'refund', true); end if;
  select * into d from public.designers where user_id = g.designer_id;
  v_ref := p_referral is not null and p_referral = d.referral_code and p_user <> d.user_id;
  if p_user = d.user_id then v_ref := false; end if;
  v_pct := public._mk_share_pct(d.user_id, g.id, v_ref);
  v_split := public._mk_split(p_amount, greatest(coalesce(p_fee, 0), 0), v_pct);
  insert into public.template_licenses(design_id, user_id, amount_paise, fee_paise, provider, provider_payment_id, referral_code)
  values (g.id, p_user, p_amount, greatest(coalesce(p_fee, 0), 0), p_provider, p_payment_id, case when v_ref then p_referral end)
  returning * into l;
  -- a designer buying their own design earns nothing from it
  if p_user <> d.user_id then
    insert into public.designer_ledger(designer_id, design_id, license_id, kind, gross_paise, gst_paise, fee_paise, net_paise, share_pct, amount_paise, available_at, note)
    values (d.user_id, g.id, l.id, 'sale', p_amount, (v_split->>'gst')::int, (v_split->>'fee')::int, (v_split->>'net')::int, v_pct,
            (v_split->>'designer')::int, now() + make_interval(days => s.pending_days), case when v_ref then 'referred sale' end);
  end if;
  return jsonb_build_object('ok', true, 'license', l.id, 'split', v_split, 'referred', v_ref);
end $$;

-- A refund. p_cause: 'host' (platform decision), 'takedown' (always reverses the designer), 'chargeback'.
-- Within the pending window the designer's earning is reversed; after it, the platform absorbs a host refund.
create or replace function public._svc_design_refund(p_license uuid, p_cause text default 'host') returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.template_licenses; e public.designer_ledger; v_reverse boolean; v_kind text;
begin
  select * into l from public.template_licenses where id = p_license for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if l.status <> 'active' then return jsonb_build_object('ok', true, 'already', true); end if;
  select * into e from public.designer_ledger where license_id = l.id and kind = 'sale' order by id limit 1;
  update public.template_licenses set status = case when p_cause = 'takedown' then 'revoked' else 'refunded' end, refunded_at = now() where id = l.id;
  if e.id is null then return jsonb_build_object('ok', true, 'reversed', 0); end if;
  v_reverse := p_cause in ('takedown','chargeback') or e.available_at > now();
  v_kind := case when p_cause = 'chargeback' then 'chargeback' else 'refund' end;
  insert into public.designer_ledger(designer_id, design_id, license_id, kind, gross_paise, net_paise, share_pct, amount_paise, available_at, note)
  values (e.designer_id, e.design_id, l.id, v_kind, -e.gross_paise, -e.net_paise, e.share_pct,
          case when v_reverse then -e.amount_paise else 0 end, greatest(e.available_at, now()),  -- a reversal inside the window nets out of 'pending'
          case when v_reverse then p_cause || ': earning reversed' else p_cause || ': after the pending window, absorbed by InviteX' end);
  return jsonb_build_object('ok', true, 'reversed', case when v_reverse then e.amount_paise else 0 end);
end $$;

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
create or replace function public.admin_designer_applications(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('email', u.email) order by a.created_at)
                     from public.designer_applications a left join auth.users u on u.id = a.user_id
                    where p_status = 'all' or a.status = p_status), '[]'::jsonb);
end $$;

-- Approve or reject an application. Approving creates the designer account.
create or replace function public.admin_decide_application(p_id uuid, p_approve boolean, p_note text default null, p_pilot_months int default 6) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.designer_applications; v_slug text; v_try text; n int := 0;
begin
  perform public._require_admin();
  select * into a from public.designer_applications where id = p_id for update;
  if not found or a.status <> 'pending' then return jsonb_build_object('ok', false, 'code', 'not_pending'); end if;
  update public.designer_applications set status = case when p_approve then 'approved' else 'rejected' end, review_note = left(p_note, 500),
         reviewed_by = auth.uid(), reviewed_at = now() where id = a.id;
  if p_approve then
    v_slug := trim(both '-' from regexp_replace(lower(a.display_name), '[^a-z0-9]+', '-', 'g'));
    if char_length(v_slug) < 3 then v_slug := 'designer-' || substr(replace(a.user_id::text, '-', ''), 1, 6); end if;
    v_slug := left(v_slug, 40); v_try := v_slug;
    while exists (select 1 from public.designers where slug = v_try) loop n := n + 1; v_try := v_slug || '-' || n; end loop;
    insert into public.designers(user_id, display_name, slug, city, state, pilot_bonus_until)
    values (a.user_id, a.display_name, v_try, a.city, a.state,
            case when coalesce(p_pilot_months, 0) > 0 then (now() + make_interval(months => p_pilot_months))::date end)
    on conflict (user_id) do nothing;
  end if;
  perform public._admin_log(case when p_approve then 'designer.approve' else 'designer.reject' end, 'designer', a.user_id::text, a.display_name,
                            jsonb_build_object('note', p_note));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_design_queue(p_status text default 'in_review') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'occasion', g.occasion, 'price', g.price_paise,
            'status', g.status, 'flags', g.flags, 'aiUse', g.ai_use, 'pages', g.pages, 'palettes', g.palettes, 'fonts', g.font_pairing,
            'sourcePath', g.source_path, 'rights', g.rights, 'submittedAt', g.submitted_at,
            'designer', jsonb_build_object('id', d.user_id, 'name', d.display_name, 'trust', d.trust_level,
               'live', (select count(*) from public.designs x where x.designer_id = d.user_id and x.status = 'live'),
               'rejected', (select count(*) from public.design_reviews r join public.designs x on x.id = r.design_id
                             where x.designer_id = d.user_id and r.decision in ('reject','reject_flag'))))
            order by g.submitted_at)
       from public.designs g join public.designers d on d.user_id = g.designer_id
      where g.status = p_status), '[]'::jsonb);
end $$;

-- approve | changes | reject | reject_flag | pause | restore | remove
create or replace function public.admin_review_design(p_id uuid, p_decision text, p_reason text default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g public.designs; v_status text;
begin
  perform public._require_admin();
  select * into g from public.designs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_decision in ('approve','changes','reject','reject_flag') and g.status <> 'in_review' then
    return jsonb_build_object('ok', false, 'code', 'not_in_review'); end if;
  if p_decision in ('changes','reject','reject_flag') and coalesce(trim(p_reason), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'reason_needed'); end if;
  v_status := case p_decision when 'approve' then 'live' when 'changes' then 'changes_requested' when 'reject' then 'removed'
                when 'reject_flag' then 'removed' when 'pause' then 'paused' when 'restore' then 'live' when 'remove' then 'removed' end;
  if v_status is null then return jsonb_build_object('ok', false, 'code', 'bad_decision'); end if;
  if p_decision = 'restore' and g.status <> 'paused' then return jsonb_build_object('ok', false, 'code', 'not_paused'); end if;
  update public.designs set status = v_status, review_note = coalesce(left(p_note, 1000), left(p_reason, 200)),
         approved_at = case when p_decision = 'approve' then now() else approved_at end, updated_at = now() where id = g.id;
  insert into public.design_reviews(design_id, reviewer_id, decision, reason, note) values (g.id, auth.uid(), p_decision, left(p_reason, 200), left(p_note, 1000));
  if p_decision = 'reject_flag' then
    update public.designers set status = 'paused', status_reason = 'Flagged in review: ' || left(p_reason, 200), updated_at = now() where user_id = g.designer_id;
  end if;
  -- a trusted designer is one with 10 approved designs and no upheld takedown
  if p_decision = 'approve' then
    update public.designers set trust_level = 'trusted', updated_at = now()
     where user_id = g.designer_id and trust_level = 'new'
       and (select count(*) from public.designs x where x.designer_id = g.designer_id and x.approved_at is not null) >= 10
       and not exists (select 1 from public.design_reviews r join public.designs x on x.id = r.design_id
                        where x.designer_id = g.designer_id and r.decision = 'remove' and r.reason = 'takedown');
  end if;
  perform public._admin_log('design.' || p_decision, 'design', g.id::text, g.title, jsonb_build_object('reason', p_reason, 'note', p_note));
  return jsonb_build_object('ok', true, 'status', v_status);
end $$;

-- Monthly payout run (on the 5th): queue a payout for every designer whose available balance has
-- reached the threshold, whose payout details are verified, and who joined long enough ago.
-- The payouts are then sent through RazorpayX and marked paid or failed.
create or replace function public.admin_queue_payouts(p_period text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.marketplace_settings := public._mk(); r record; v_id uuid; v_n int := 0; v_total int := 0; v_avail int;
begin
  perform public._require_super_admin();
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then return jsonb_build_object('ok', false, 'code', 'bad_period'); end if;
  for r in select * from public.designers where status = 'active' and kyc_status = 'verified'
             and joined_at <= now() - make_interval(days => s.new_designer_hold_days) loop
    v_avail := (public._mk_balance(r.user_id)->>'available')::int;
    if v_avail >= s.payout_threshold_paise and not exists (select 1 from public.designer_payouts where designer_id = r.user_id and period = p_period) then
      insert into public.designer_payouts(designer_id, amount_paise, period) values (r.user_id, v_avail, p_period) returning id into v_id;
      insert into public.designer_ledger(designer_id, payout_id, kind, amount_paise, note, created_by)
      values (r.user_id, v_id, 'payout', -v_avail, 'payout ' || p_period, auth.uid());
      v_n := v_n + 1; v_total := v_total + v_avail;
    end if;
  end loop;
  perform public._admin_log('payout.queue', 'payout', p_period, p_period, jsonb_build_object('designers', v_n, 'total_paise', v_total));
  return jsonb_build_object('ok', true, 'designers', v_n, 'total', v_total);
end $$;

-- Mark a payout paid or failed. A failed payout returns the money to the designer's available balance.
create or replace function public.admin_settle_payout(p_id uuid, p_paid boolean, p_ref text default null, p_failure text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.designer_payouts; v_fails int;
begin
  perform public._require_super_admin();
  select * into p from public.designer_payouts where id = p_id for update;
  if not found or p.status not in ('queued','processing') then return jsonb_build_object('ok', false, 'code', 'not_open'); end if;
  update public.designer_payouts set status = case when p_paid then 'paid' else 'failed' end, provider_ref = left(p_ref, 120),
         failure = left(p_failure, 300), updated_at = now() where id = p.id;
  if not p_paid then
    insert into public.designer_ledger(designer_id, payout_id, kind, amount_paise, note, created_by)
    values (p.designer_id, p.id, 'payout_failed', p.amount_paise, 'payout failed: ' || coalesce(left(p_failure, 200), 'unknown'), auth.uid());
    -- three failures in a row: pause payouts until the designer updates their details
    select count(*) into v_fails from (select status from public.designer_payouts where designer_id = p.designer_id order by created_at desc limit 3) t where status = 'failed';
    if v_fails >= 3 then update public.designers set kyc_status = 'failed', updated_at = now() where user_id = p.designer_id; end if;
  end if;
  perform public._admin_log(case when p_paid then 'payout.paid' else 'payout.failed' end, 'payout', p.id::text, p.period,
                            jsonb_build_object('amount_paise', p.amount_paise, 'ref', p_ref, 'failure', p_failure));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array[
    'public._mk()', 'public._mk_require_user()', 'public._mk_require_designer()', 'public._mk_share_pct(uuid,uuid,boolean,timestamptz)',
    'public._mk_balance(uuid)', 'public._mk_invitation_guard()',
    'public._svc_design_sale(uuid,uuid,int,int,text,text,text)', 'public._svc_design_refund(uuid,text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public._svc_design_sale(uuid,uuid,int,int,text,text,text)', 'public._svc_design_refund(uuid,text)'] loop
    execute format('grant execute on function %s to service_role', f);
  end loop;
  foreach f in array array[
    'public.designer_apply(jsonb)', 'public.designer_accept_agreement(text)', 'public.designer_save_design(jsonb)',
    'public.designer_submit_design(uuid,jsonb)', 'public.designer_balance()', 'public.my_designer_state()', 'public.designer_designs()', 'public.my_design(uuid)', 'public.my_design_licenses()',
    'public.admin_designer_applications(text)', 'public.admin_decide_application(uuid,boolean,text,int)', 'public.admin_design_queue(text)',
    'public.admin_review_design(uuid,text,text,text)', 'public.admin_queue_payouts(text)', 'public.admin_settle_payout(uuid,boolean,text,text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke all on function public.marketplace_designs(text,text,int,int) from public';
  execute 'grant execute on function public.marketplace_designs(text,text,int,int) to anon, authenticated';
end $$;

-- ---------------------------------------------------------------------
-- Storage for designers
--   designer-previews (public): watermarked 800px previews shown in the gallery
--   designer-art      (public read by exact link, no listing): full artwork. Each design's folder name
--                     carries a random part, and the path is only handed out after purchase (my_design).
--                     Guests must be able to load it on a published invitation, so it cannot be private.
--   designer-source   (private): layered source files, readable only by the designer and admins
-- Designers write only inside a folder named after their own user id.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('designer-previews', 'designer-previews', true, 2097152, array['image/webp','image/jpeg','image/png']),
  ('designer-art', 'designer-art', true, 15728640, array['image/png','image/jpeg','image/svg+xml','image/webp']),
  ('designer-source', 'designer-source', false, 157286400, array['application/octet-stream','image/vnd.adobe.photoshop','application/pdf','application/postscript','video/mp4','application/zip'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public._mk_is_active_designer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.designers where user_id = auth.uid() and status = 'active') and public.is_active_user();
$$;

drop policy if exists mk_designer_files_insert on storage.objects;
create policy mk_designer_files_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('designer-previews','designer-art','designer-source')
              and (storage.foldername(name))[1] = (select auth.uid()::text) and (select public._mk_is_active_designer()));
drop policy if exists mk_designer_files_own on storage.objects;
create policy mk_designer_files_own on storage.objects for select to authenticated
  using (bucket_id in ('designer-previews','designer-art','designer-source') and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists mk_designer_files_delete on storage.objects;
create policy mk_designer_files_delete on storage.objects for delete to authenticated
  using (bucket_id in ('designer-previews','designer-art','designer-source') and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists mk_designer_files_admin on storage.objects;
create policy mk_designer_files_admin on storage.objects for select to authenticated
  using (bucket_id in ('designer-previews','designer-art','designer-source') and (select public.is_admin()));
