/**
 * Player sign-up by personal code. Pure logic with an injected store so it can be tested without Deno or a database.
 *
 * A player gets a code from the coach, types it, picks an ID and a password. Supabase Auth needs an e-mail, so the
 * account is created as <id>@ID_DOMAIN (confirmed, never mailed) and the app signs in with the ID.
 */
export const ID_DOMAIN = 'lineup-jade-xi.vercel.app';
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const MIN_PASSWORD = 6;
export const MAX_PASSWORD = 72;
export const CODE_RE = /^[A-Z2-9]{8}$/;

export const normalizeCode = (s: unknown): string => String(s ?? '').toUpperCase().replace(/[\s-]/g, '');
export const normalizeUsername = (s: unknown): string => String(s ?? '').trim().toLowerCase();
export const emailFor = (username: string, domain = ID_DOMAIN): string => `${username}@${domain}`;

export interface CodeRow {
  player_id: string;
  claimed_by: string | null;
  used_at: string | null;
  username: string | null;
}

export type CreateUserResult = { id: string } | { error: 'taken' | 'failed' };

export interface Store {
  findCode(code: string): Promise<CodeRow | null>;
  playerName(playerId: string): Promise<string | null>;
  createUser(email: string, password: string, username: string): Promise<CreateUserResult>;
  updatePassword(userId: string, password: string): Promise<boolean>;
  /** false when the player already belongs to another account */
  addMember(userId: string, playerId: string): Promise<boolean>;
  markUsed(playerId: string, userId: string, username: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export interface Result {
  status: number;
  body: Record<string, unknown>;
}

const fail = (status: number, error: string): Result => ({ status, body: { error } });

/** Handles `{action: 'check' | 'claim', code, username?, password?}`. */
export async function handle(input: unknown, store: Store, sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))): Promise<Result> {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const action = body.action;
  if (action !== 'check' && action !== 'claim') return fail(400, 'bad_request');

  const code = normalizeCode(body.code);
  const row = CODE_RE.test(code) ? await store.findCode(code) : null;
  if (!row) { await sleep(800); return fail(404, 'bad_code'); } // slows guessing
  if (row.used_at) return fail(409, 'used');

  const recovery = !!row.claimed_by;

  if (action === 'check') {
    const name = await store.playerName(row.player_id);
    return { status: 200, body: { playerName: name ?? '', recovery, username: recovery ? row.username : null } };
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) return fail(400, 'weak_password');

  // The coach re-issued the code of a player who already has an account: this sets a new password for it.
  if (recovery) {
    if (!(await store.updatePassword(row.claimed_by!, password))) return fail(500, 'failed');
    await store.markUsed(row.player_id, row.claimed_by!, row.username ?? '');
    return { status: 200, body: { ok: true, username: row.username } };
  }

  const username = normalizeUsername(body.username);
  if (!USERNAME_RE.test(username)) return fail(400, 'invalid_username');

  const made = await store.createUser(emailFor(username), password, username);
  if ('error' in made) return fail(made.error === 'taken' ? 409 : 500, made.error === 'taken' ? 'username_taken' : 'failed');

  // Two people racing for the same code: only one can own the player, the other account is rolled back.
  if (!(await store.addMember(made.id, row.player_id))) {
    await store.deleteUser(made.id);
    return fail(409, 'used');
  }
  await store.markUsed(row.player_id, made.id, username);
  return { status: 200, body: { ok: true, username } };
}
