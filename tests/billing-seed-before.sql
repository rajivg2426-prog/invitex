-- Run BEFORE supabase/billing.sql: an invitation that was already shared before paid sharing existed.
insert into auth.users(id, email, created_at) values ('40000000-0000-0000-0000-000000000004', 'early.host@example.com', now() - interval '500 days') on conflict do nothing;
insert into public.invitations(id, owner_id, slug, status, data, published, published_at)
values ('eeeeeeee-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'old-wedding', 'published',
        '{"text":{"en":{"title":"Old Wedding"}}}', '{"text":{"en":{"title":"Old Wedding"}}}', now() - interval '30 days')
on conflict do nothing;
