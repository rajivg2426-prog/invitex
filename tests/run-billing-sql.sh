#!/bin/sh
# Builds a fresh local database and runs the paid-sharing database tests.
set -e
psql -q -d postgres -f tests/supabase-stubs.sql >/dev/null 2>&1
psql -q -d ivx -c 'create role service_role nologin' 2>/dev/null || true
for f in supabase/schema.sql supabase/admin.sql supabase/ai-designs.sql tests/billing-seed-before.sql supabase/billing.sql tests/billing-test.sql; do
  psql -q -d ivx -v ON_ERROR_STOP=1 -f "$f"
done
