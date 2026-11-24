// Supabase Edge Function: sign-up with a player's personal code. Deployed with verify_jwt = false (callers are not signed in).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, ID_DOMAIN, type Store } from './logic.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
void ID_DOMAIN;

const store: Store = {
  async findCode(code) {
    const { data } = await admin.from('player_codes').select('player_id, claimed_by, used_at, username').eq('code', code).maybeSingle();
    return data ?? null;
  },
  async playerName(playerId) {
    const { data } = await admin.from('players').select('name').eq('id', playerId).maybeSingle();
    return data?.name ?? null;
  },
  async createUser(email, password, username) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } });
    if (error || !data.user) return { error: /already|exists|registered|duplicate/i.test(error?.message ?? '') ? 'taken' : 'failed' };
    return { id: data.user.id };
  },
  async updatePassword(userId, password) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    return !error;
  },
  async addMember(userId, playerId) {
    const { error } = await admin.from('members').insert({ user_id: userId, role: 'player', player_id: playerId });
    return !error;
  },
  async markUsed(playerId, userId, username) {
    await admin.from('player_codes').update({ used_at: new Date().toISOString(), claimed_by: userId, username }).eq('player_id', playerId);
  },
  async deleteUser(userId) {
    await admin.auth.admin.deleteUser(userId);
  },
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'bad_request' });
  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  try {
    const r = await handle(body, store);
    return json(r.status, r.body);
  } catch {
    return json(500, { error: 'failed' });
  }
});
