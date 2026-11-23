\set ON_ERROR_STOP 1
grant all on all tables in schema public to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
-- host 1 creates & publishes as authenticated
set role authenticated; select set_config('request.jwt.uid','11111111-1111-1111-1111-111111111111',false);
insert into invitations(id, owner_id, slug, status, data, published, max_total, max_per_invite)
values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','kabir','published','{}','{"text":{"en":{"title":"Kabir"}}}', 10, 4);
insert into guests(invitation_id, name, phone, token) values ('aaaaaaaa-0000-0000-0000-000000000001','Rakesh','9876543210','tok1');
select public.set_invitation_password('aaaaaaaa-0000-0000-0000-000000000001', null);
-- host 2 cannot see host 1 data
select set_config('request.jwt.uid','22222222-2222-2222-2222-222222222222',false);
select 'host2 sees invitations:', count(*) from invitations;
select 'host2 sees invitation_secrets:', count(*) from invitation_secrets;
reset role;
-- anonymous guest
set role anon; select set_config('request.jwt.uid','',false);
select 'anon table rows:', (select count(*) from invitations), (select count(*) from rsvps), (select count(*) from guests);
select public.get_public_invitation('kabir', null, 'tok1')->'guest';
select public.submit_rsvp('kabir','{"name":"Rakesh","phone":"9876543210","status":"yes","adults":2,"children":1,"consent":true}',null,'tok1',null)->>'status' as first;
select public.submit_rsvp('kabir','{"name":"Imposter","phone":"+91 98765-43210","status":"yes","adults":1,"consent":true}')->>'code' as dup;
select public.submit_rsvp('kabir','{"name":"Big","phone":"9000000001","status":"yes","adults":5,"consent":true}')->>'code' as maxparty;
select public.submit_rsvp('kabir','{"name":"Pooja","phone":"9123456780","status":"no","adults":3,"consent":true}')->>'status' as decline;
select public.submit_rsvp('kabir','{"name":"Cap","phone":"9000000002","status":"yes","adults":4,"children":4,"consent":true}')->>'code' as cap_or_party;
reset role;
select name, status, adults, children, phone_norm from rsvps order by created_at;
set role authenticated; select set_config('request.jwt.uid','11111111-1111-1111-1111-111111111111',false);
select public.set_invitation_password('aaaaaaaa-0000-0000-0000-000000000001', 'secret');
reset role; set role anon;
select public.get_public_invitation('kabir')->>'status' as nopw, public.get_public_invitation('kabir','bad')->>'status' as badpw, public.get_public_invitation('kabir','secret')->>'status' as goodpw;
