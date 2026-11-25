\set ON_ERROR_STOP 1
-- Sample accounts and invitations for tests/admin-e2e.js.
-- Run after supabase-stubs.sql + schema.sql + admin.sql on the local test database.
insert into auth.users(id, email, created_at, last_sign_in_at) values
  ('a1000000-0000-0000-0000-000000000001', 'rajeev.admin@example.com', now() - interval '40 days', now() - interval '1 hour'),
  ('b1000000-0000-0000-0000-000000000002', 'priya.host@example.com',  now() - interval '20 days', now() - interval '2 days'),
  ('c1000000-0000-0000-0000-000000000003', 'spam.account@example.com', now() - interval '3 days', now() - interval '3 days'),
  ('d1000000-0000-0000-0000-000000000004', 'new.host@example.com',    now() - interval '1 day', null)
on conflict do nothing;
update public.profiles set role = 'admin' where user_id = (select id from auth.users where email = 'rajeev.admin@example.com');
insert into public.invitations(id, owner_id, slug, status, data, published, published_at, created_at) values
  ('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'priya-wedding', 'published',
   '{"defaultLang":"en","category":"wedding","text":{"en":{"title":"Priya weds Arjun"}}}', '{"text":{"en":{"title":"Priya weds Arjun"}}}', now() - interval '10 days', now() - interval '15 days'),
  ('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', null, 'draft',
   '{"defaultLang":"en","category":"birthday","text":{"en":{"title":"Kabir turns 5"}}}', null, null, now() - interval '2 days'),
  ('e1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'free-prize', 'published',
   '{"defaultLang":"en","category":"corporate","text":{"en":{"title":"Win a free prize now"}}}', '{"text":{"en":{"title":"Win a free prize now"}}}', now() - interval '2 days', now() - interval '3 days')
on conflict do nothing;
insert into public.guests(invitation_id, name, phone) values
  ('e1000000-0000-0000-0000-000000000001', 'Rakesh', '9876543210'), ('e1000000-0000-0000-0000-000000000001', 'Sunita', '9876543211');
insert into public.rsvps(invitation_id, ref, name, phone, status, adults, children, consent, created_at) values
  ('e1000000-0000-0000-0000-000000000001', 'IVX-T1', 'Rakesh', '9876543210', 'yes', 2, 1, true, now() - interval '5 days'),
  ('e1000000-0000-0000-0000-000000000001', 'IVX-T2', 'Sunita', '9876543211', 'no', 0, 0, true, now() - interval '1 day');
insert into public.ai_credits(user_id, tries_used, tries_limit) values ('b1000000-0000-0000-0000-000000000002', 3, 3) on conflict (user_id) do update set tries_used = 3, tries_limit = 3;
insert into public.ai_generations(user_id, style, provider, images, ok, created_at) values
  ('b1000000-0000-0000-0000-000000000002', 'royal', 'google', 4, true, now() - interval '9 days'),
  ('b1000000-0000-0000-0000-000000000002', 'floral', 'google', 4, true, now() - interval '8 days'),
  ('b1000000-0000-0000-0000-000000000002', 'floral', 'google', 0, false, now() - interval '8 days');
