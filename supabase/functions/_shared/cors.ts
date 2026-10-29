// Shared CORS headers for browser-invoked Edge Functions.
// The anon key is public; RLS and per-function auth checks are the real guard.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
