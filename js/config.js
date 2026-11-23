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
  SUPABASE_URL: '',          // e.g. 'https://abcdefgh.supabase.co'
  SUPABASE_ANON_KEY: '',     // the "anon public" key from Project Settings > API
  MEDIA_BUCKET: 'invite-media',
  // Optional: absolute public URL where invite.html is hosted. When empty the
  // current site location is used.
  PUBLIC_BASE_URL: '',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
};
