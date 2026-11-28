-- v2.4: the host's own RSVP questions. Run after supabase/schema.sql (and tests/schema-test.sql, which grants table access).
-- psql -d ivx -f tests/rsvp-questions-test.sql   → ends with "rsvp questions: all checks passed"
\set ON_ERROR_STOP 1
grant all on all tables in schema public to anon, authenticated;
insert into auth.users values ('33333333-3333-3333-3333-333333333333') on conflict do nothing;
insert into invitations(id, owner_id, slug, status, data, published, max_total, max_per_invite)
values ('aaaaaaaa-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','meera-q','published','{}',
  '{"text":{"en":{"title":"Meera"}},"settings":{"questions":[
     {"id":"qtravel","label":"Arriving by?","type":"choice","options":"Train, Car","required":true},
     {"id":"qsong","label":"Song request","type":"text","required":false},
     {"id":"qblank","label":"  ","type":"text","required":true}]}}', 0, 6)
on conflict (id) do nothing;
set role anon; select set_config('request.jwt.uid','',false);
do $$
declare r jsonb; a jsonb; tok text;
begin
  -- a required answer is missing → refused
  r := public.submit_rsvp('meera-q','{"name":"Asha","phone":"9811111111","status":"yes","adults":1,"consent":true}');
  assert r->>'code' = 'needAnswer', 'missing required answer should be refused, got ' || r::text;
  -- blank answer counts as missing
  r := public.submit_rsvp('meera-q','{"name":"Asha","phone":"9811111111","status":"yes","adults":1,"consent":true,"answers":{"qtravel":"   "}}');
  assert r->>'code' = 'needAnswer', 'blank answer should be refused';
  -- "no" never needs answers
  r := public.submit_rsvp('meera-q','{"name":"Nikhil","phone":"9822222222","status":"no","consent":true}');
  assert r->>'status' = 'ok', 'a no needs no answers, got ' || r::text;
  -- answered: stored, junk keys and empty values dropped, values cut to 300
  r := public.submit_rsvp('meera-q', jsonb_build_object('name','Asha','phone','9811111111','status','yes','adults',1,'consent',true,
         'answers', jsonb_build_object('qtravel','Train','qsong', repeat('x', 400),'bad key!','nope','qempty','')));
  assert r->>'status' = 'ok', 'answered reply should pass, got ' || r::text;
  tok := r->>'editToken';
  reset role;
  select answers into a from rsvps where phone_norm like '%9811111111';
  assert a->>'qtravel' = 'Train', 'answer stored';
  assert length(a->>'qsong') = 300, 'answer cut to 300';
  assert not (a ? 'bad key!') and not (a ? 'qempty'), 'junk dropped: ' || a::text;
  set role anon;
  -- the private edit link returns the answers, and an edit replaces them
  assert (public.get_rsvp_by_edit_token('meera-q', tok)->'answers'->>'qtravel') = 'Train', 'edit link returns answers';
  r := public.submit_rsvp('meera-q','{"name":"Asha","phone":"9811111111","status":"maybe","adults":1,"consent":true,"answers":{"qtravel":"Car"}}', null, null, tok);
  assert r->>'status' = 'ok' and (r->>'updated')::boolean, 'edit ok';
  reset role;
  select answers into a from rsvps where phone_norm like '%9811111111';
  assert a = '{"qtravel":"Car"}'::jsonb, 'edit replaced answers: ' || a::text;
  -- an invitation without questions is unaffected
  assert (select count(*) from rsvps where answers = '{}'::jsonb) >= 1, 'replies without answers default to {}';
  raise notice 'rsvp questions: all checks passed';
end $$;
reset role;
