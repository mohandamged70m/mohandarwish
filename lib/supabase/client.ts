import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazily created so that importing this module during prerender / build
// (e.g. BookButton -> BookingModal -> supabase) never throws when
// NEXT_PUBLIC_SUPABASE_* is missing. The client is only instantiated on
// first property access, which happens at runtime in event handlers / effects.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Placeholder keeps prerender/build alive without env vars.
    // Callers already try/catch storage/db failures.
    _client = createClient("https://placeholder.supabase.co", "placeholder-key");
    return _client;
  }
  _client = createClient(url, key);
  return _client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
});
