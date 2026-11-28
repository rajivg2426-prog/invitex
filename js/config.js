/*
 * InviteX runtime configuration.
 *
 * DEMO / LOCAL MODE (default): leave SUPABASE_URL empty. Everything is stored in
 * this browser's IndexedDB. Guest links only work in this same browser.
 *
 * PRODUCTION MODE: fill in your Supabase project URL and the *anon public* key.
 * The anon key is designed to be public; all protection comes from the Row Level
 * Security policies and SECURITY DEFINER functions in supabase/schema.sql.
 *
 * NEVER put the service_role key (or any other secret) in this file or anywhere
 * in the frontend.
 */
window.INVITEX_CONFIG = {
  SUPABASE_URL: 'https://elevbhlcxqnqgfsqplrk.supabase.co',
  // Public "publishable" key (sb_publishable_…), safe in the browser. Never the secret/service_role key.
  SUPABASE_ANON_KEY: 'sb_publishable_pAu9_dgaoDzj2DyvA7sGug_sEe5kWF8',
  MEDIA_BUCKET: 'invite-media',
  // Optional: absolute public URL where invite.html is hosted. When empty the
  // current site location is used.
  PUBLIC_BASE_URL: 'https://invitex.pages.dev/',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
};
