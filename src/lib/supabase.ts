import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Needed to call Edge Functions of people who are not signed in yet. */
export const supabaseConfig = { url: (url ?? '') as string, key: (key ?? '') as string };

/** `null` when the env vars are missing: the app then works purely on this device. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;

export const cloudEnabled = supabase !== null;
