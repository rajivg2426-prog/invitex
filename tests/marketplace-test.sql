-- Designer marketplace (pilot) database checks.
-- Run on a fresh local database after schema.sql, admin.sql, ai-designs.sql, billing.sql and marketplace.sql
-- (sh tests/run-marketplace-sql.sh does all of it). Ends with "marketplace: all checks passed".
\set ON_ERROR_STOP 1
grant all on all tables in schema public to anon, authenticated;
insert into auth.users(id, email) values
  ('d0000000-0000-0000-0000-00000000000d', 'meera@studio.test'),   -- designer
  ('e0000000-0000-0000-0000-00000000000e', 'copycat@studio.test'), -- second designer
  ('f0000000-0000-0000-0000-00000000000f', 'admin@invitex.test'),  -- super admin
  ('a1000000-0000-0000-0000-0000000000a1', 'host1@example.test'),
  ('a2000000-0000-0000-0000-0000000000a2', 'host2@example.test')
on conflict do nothing;
insert into public.profiles(user_id) select id from auth.users on conflict do nothing;
update public.profiles set role = 'super_admin' where user_id = 'f0000000-0000-0000-0000-00000000000f';

create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.uid', u, false) $$;

do $$
declare r jsonb; v_design uuid; v_copy uuid; v_app uuid; v_lic uuid; v_lic2 uuid; b jsonb; n int; v_pay uuid;
  dz constant text := 'd0000000-0000-0000-0000-00000000000d';
  ez constant text := 'e0000000-0000-0000-0000-00000000000e';
  ad constant text := 'f0000000-0000-0000-0000-00000000000f';
  h1 constant text := 'a1000000-0000-0000-0000-0000000000a1';
  h2 constant text := 'a2000000-0000-0000-0000-0000000000a2';
  pages constant jsonb := '[{"role":"front","path":"designer-art/d/x/front.png","preview":"designer-previews/d/x/front.webp","zones":[{"key":"title","x":0.1,"y":0.3,"w":0.8,"h":0.1}]}]';
  rights constant jsonb := '{"own":true,"noThirdParty":true,"noLikeness":true,"notSoldExclusive":true,"understandsLiability":true}';
begin
  -- 1. applying
  perform pg_temp.as_user(dz);
  r := public.designer_apply('{"displayName":"Meera Studio","city":"Jaipur","state":"Rajasthan","portfolioUrl":"http://insecure.example"}');
  assert r->>'code' = 'invalid', 'portfolio must be https: ' || r::text;
  r := public.designer_apply('{"displayName":"Meera Studio","city":"Jaipur","state":"Rajasthan","portfolioUrl":"https://behance.net/meera","occasions":["wedding"]}');
  assert (r->>'ok')::boolean, 'apply ok ' || r::text; v_app := (r->>'id')::uuid;
  r := public.designer_apply('{"displayName":"Meera Studio","city":"Jaipur","state":"Rajasthan","portfolioUrl":"https://behance.net/meera"}');
  assert r->>'code' = 'already_applied', 'one open application';
  begin perform public.designer_save_design('{}'); assert false, 'non-designer must not save';
  exception when insufficient_privilege then null; end;
  -- a host cannot approve
  perform pg_temp.as_user(h1);
  begin perform public.admin_decide_application(v_app, true); assert false, 'host must not approve';
  exception when insufficient_privilege then null; end;

  -- 2. admin approves (with pilot bonus); second designer too
  perform pg_temp.as_user(ad);
  r := public.admin_decide_application(v_app, true, 'Lovely portfolio', 6);
  assert (r->>'ok')::boolean, 'approve ' || r::text;
  assert (select slug from public.designers where user_id = dz::uuid) = 'meera-studio', 'slug from name';
  assert (select pilot_bonus_until from public.designers where user_id = dz::uuid) > current_date + 150, 'pilot bonus about 6 months';
  perform pg_temp.as_user(ez);
  r := public.designer_apply('{"displayName":"Meera Studio","city":"Delhi","state":"Delhi","portfolioUrl":"https://instagram.com/copy"}');
  perform pg_temp.as_user(ad);
  perform public.admin_decide_application((r->>'id')::uuid, true, null, 0);
  assert (select slug from public.designers where user_id = ez::uuid) = 'meera-studio-1', 'slug kept unique';

  -- 3. drafting and submitting
  perform pg_temp.as_user(dz);
  r := public.designer_save_design('{"title":"Rajwada Gold"}');
  assert r->>'code' = 'agreement_needed', 'agreement first';
  assert (public.designer_accept_agreement('old')->>'code') = 'old_version', 'old agreement refused';
  assert (public.designer_accept_agreement('2026-11-pilot')->>'ok')::boolean, 'agreement accepted';
  r := public.designer_save_design('{"title":"Rajwada Gold","price":12300}');
  assert r->>'code' = 'bad_price', 'only fixed tiers';
  r := public.designer_save_design(jsonb_build_object('title','Rajwada Gold','occasion','wedding','price',14900,'pages',pages,
         'palettes','[{"bg":"#3b0a16","accent":"#d4a24c"}]'::jsonb,'fonts','royal','tags','["Royal","red"]'::jsonb,'phash','["0f0f0f0f0f0f0f0f"]'::jsonb));
  assert (r->>'ok')::boolean, 'save ' || r::text; v_design := (r->>'id')::uuid;
  r := public.designer_submit_design(v_design, rights - 'noLikeness');
  assert r->>'code' = 'rights_missing' and r->>'item' = 'noLikeness', 'every declaration tick needed';
  r := public.designer_submit_design(v_design, rights);
  assert r->>'code' = 'needs_source', 'new designer must upload the source file';
  r := public.designer_save_design(jsonb_build_object('id',v_design,'title','Rajwada Gold','occasion','wedding','price',14900,'pages',pages,
         'palettes','[{"bg":"#3b0a16"}]'::jsonb,'fonts','royal','tags','["royal","red"]'::jsonb,'phash','["0f0f0f0f0f0f0f0f"]'::jsonb,'sourcePath','designer-src/d/x.psd','aiUse','mostly'));
  r := public.designer_submit_design(v_design, rights);
  assert r->>'code' = 'ai_not_allowed', 'mostly-AI designs are not accepted';
  r := public.designer_save_design(jsonb_build_object('id',v_design,'title','Rajwada Gold','occasion','wedding','price',14900,'pages',pages,
         'palettes','[{"bg":"#3b0a16"}]'::jsonb,'fonts','royal','tags','["royal","red"]'::jsonb,'phash','["0f0f0f0f0f0f0f0f"]'::jsonb,'sourcePath','designer-src/d/x.psd'));
  r := public.designer_submit_design(v_design, rights);
  assert (r->>'ok')::boolean and jsonb_array_length(r->'flags') = 0, 'submitted ' || r::text;
  assert (public.designer_save_design(jsonb_build_object('id', v_design, 'title', 'x'))->>'code') = 'locked', 'no edits while in review';

  -- 4. a near copy by another designer is flagged for review
  perform pg_temp.as_user(ez);
  perform public.designer_accept_agreement('2026-11-pilot');
  r := public.designer_save_design(jsonb_build_object('title','Royal Gold','occasion','wedding','price',9900,'pages',pages,
         'palettes','[{"bg":"#000"}]'::jsonb,'phash','["0f0f0f0f0f0f0f1f"]'::jsonb,'sourcePath','designer-src/e/y.psd'));
  v_copy := (r->>'id')::uuid;
  r := public.designer_submit_design(v_copy, rights);
  assert r->'flags' ? 'possible_duplicate', 'near duplicate flagged: ' || r::text;

  -- 5. review
  perform pg_temp.as_user(ad);
  assert jsonb_array_length(public.admin_design_queue()) = 2, 'two in the queue';
  assert (public.admin_review_design(v_copy, 'reject')->>'code') = 'reason_needed', 'rejecting needs a reason';
  r := public.admin_review_design(v_copy, 'reject_flag', 'copy of an existing design');
  assert (select status from public.designers where user_id = ez::uuid) = 'paused', 'flagged designer paused';
  r := public.admin_review_design(v_design, 'approve');
  assert r->>'status' = 'live', 'approved';

  -- 6. the gallery: live designs, previews only
  perform pg_temp.as_user('');
  r := public.marketplace_designs('wedding');
  assert jsonb_array_length(r) = 1 and r->0->>'title' = 'Rajwada Gold', 'gallery shows the live design: ' || r::text;
  assert position('designer-art/' in r::text) = 0, 'full-resolution artwork is never listed';
  assert jsonb_array_length(public.marketplace_designs(null, 'royal')) = 1, 'tag search';

  -- 7. publishing needs a licence
  perform pg_temp.as_user(h1);
  assert (public.my_design(v_design)->>'code') = 'not_owned', 'artwork locked before buying';
  insert into public.invitations(id, owner_id, slug, status, data, published)
  values ('cccccccc-0000-0000-0000-000000000001', h1::uuid, 'aarav-diya-mk', 'draft', '{}', null);
  begin
    update public.invitations set status = 'published', published = jsonb_build_object('marketplace', jsonb_build_object('designId', v_design))
     where id = 'cccccccc-0000-0000-0000-000000000001';
    assert false, 'publishing an unbought premium design must fail';
  exception when insufficient_privilege then null; end;

  -- 8. sales and the split (₹149, Razorpay fee ₹3.52 incl. GST, pilot designer: 60% + 10 = 70% of net)
  r := public._svc_design_sale(h1::uuid, v_design, 9900, 352, 'razorpay', 'pay_wrong');
  assert r->>'code' = 'amount_mismatch' and (r->>'refund')::boolean, 'wrong amount refused';
  r := public._svc_design_sale(h1::uuid, v_design, 14900, 352, 'razorpay', 'pay_1');
  assert (r->>'ok')::boolean, 'sale ' || r::text; v_lic := (r->>'license')::uuid;
  assert (r->'split'->>'gst')::int = 2273 and (r->'split'->>'net')::int = 12275 and (r->'split'->>'pct')::int = 70
         and (r->'split'->>'designer')::int = 8592 and (r->'split'->>'platform')::int = 3683, 'split: ' || (r->'split')::text;
  assert (public._svc_design_sale(h1::uuid, v_design, 14900, 352, 'razorpay', 'pay_1')->>'already')::boolean, 'same payment twice is one licence';
  assert (public._svc_design_sale(h1::uuid, v_design, 14900, 352, 'razorpay', 'pay_2')->>'code') = 'already_owned', 'second purchase refused for refund';
  update public.invitations set status = 'published', published = jsonb_build_object('marketplace', jsonb_build_object('designId', v_design))
   where id = 'cccccccc-0000-0000-0000-000000000001';
  assert (public.my_design(v_design)->>'ok')::boolean, 'owner gets the artwork';
  -- referred sale: 80% + 10 pilot points = 90% (the cap)
  r := public._svc_design_sale(h2::uuid, v_design, 14900, 352, 'razorpay', 'pay_3', (select referral_code from public.designers where user_id = dz::uuid));
  assert (r->>'referred')::boolean and (r->'split'->>'designer')::int = 11047, 'referred split: ' || r::text;
  v_lic2 := (r->>'license')::uuid;
  -- a designer buying their own design earns nothing
  r := public._svc_design_sale(dz::uuid, v_design, 14900, 352, 'razorpay', 'pay_self');
  assert not exists (select 1 from public.designer_ledger where license_id = (r->>'license')::uuid), 'no earning from own purchase';

  -- 9. balance, refunds, ledger
  perform pg_temp.as_user(dz);
  b := public.designer_balance();
  assert (b->>'pending')::int = 8592 + 11047 and (b->>'available')::int = 0 and (b->>'sales')::int = 2, 'balance ' || b::text;
  r := public._svc_design_refund(v_lic, 'host');
  assert (r->>'reversed')::int = 8592, 'refund inside the pending window reverses the earning';
  assert (public._svc_design_refund(v_lic, 'host')->>'already')::boolean, 'refund once';
  b := public.designer_balance();
  assert (b->>'pending')::int = 11047, 'balance after refund ' || b::text;
  begin update public.designer_ledger set amount_paise = 0; assert false, 'ledger must be append-only';
  exception when insufficient_privilege then null; end;
  -- a refunded host can no longer republish changes with that design
  begin
    update public.invitations set published = published || '{"x":1}'::jsonb where id = 'cccccccc-0000-0000-0000-000000000001';
    assert false, 'republish after refund must fail';
  exception when insufficient_privilege then null; end;

  -- 10. payouts (an adjustment stands in for older, available earnings)
  insert into public.designer_ledger(designer_id, kind, amount_paise, available_at, note) values (dz::uuid, 'adjustment', 60000, now() - interval '1 day', 'test: older earnings');
  perform pg_temp.as_user(ad);
  r := public.admin_queue_payouts('2026-12');
  assert (r->>'designers')::int = 0, 'no payout before KYC and the new-designer hold';
  update public.designers set kyc_status = 'verified', joined_at = now() - interval '40 days' where user_id = dz::uuid;
  r := public.admin_queue_payouts('2026-12');
  assert (r->>'designers')::int = 1 and (r->>'total')::int = 60000, 'payout queued: ' || r::text;
  assert (public.admin_queue_payouts('2026-12')->>'designers')::int = 0, 'one payout per month';
  select id into v_pay from public.designer_payouts where designer_id = dz::uuid;
  perform public.admin_settle_payout(v_pay, false, null, 'UPI ID closed');
  assert (public._mk_balance(dz::uuid)->>'available')::int = 60000, 'failed payout returns to available';
  perform pg_temp.as_user(h1);
  begin perform public.admin_queue_payouts('2027-01'); assert false, 'only the super admin runs payouts';
  exception when insufficient_privilege then null; end;
  raise notice 'marketplace: all checks passed';
end $$;

-- browsers cannot call the service steps
set role anon;
do $$ begin
  begin perform public._svc_design_sale(gen_random_uuid(), gen_random_uuid(), 1, 0, 'razorpay', 'x'); raise exception 'FAIL: anon called a service step';
  exception when insufficient_privilege then raise notice 'ok: service steps are closed to browsers'; end;
end $$;
reset role;
