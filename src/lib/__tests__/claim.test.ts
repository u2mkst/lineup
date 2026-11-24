import { describe, expect, it } from 'vitest';
import { emailFor, handle, ID_DOMAIN, normalizeCode, type CodeRow, type Store } from '../../../supabase/functions/claim-player/logic';

function makeStore(rows: Record<string, CodeRow>, opts: { takenEmails?: string[]; playerOwned?: Set<string> } = {}) {
  const log: string[] = [];
  const users = new Map<string, { email: string; password: string }>();
  const taken = new Set(opts.takenEmails ?? []);
  const owned = opts.playerOwned ?? new Set<string>();
  let n = 0;
  const store: Store = {
    findCode: async c => rows[c] ?? null,
    playerName: async id => ({ p1: '김하민', p2: '박나로' })[id] ?? null,
    createUser: async (email, password) => {
      if (taken.has(email)) return { error: 'taken' };
      const id = `u${++n}`; users.set(id, { email, password }); taken.add(email); log.push(`create ${email}`); return { id };
    },
    updatePassword: async (id, pw) => { if (!users.has(id)) users.set(id, { email: '', password: pw }); users.get(id)!.password = pw; log.push(`password ${id}`); return true; },
    addMember: async (_u, p) => { if (owned.has(p)) return false; owned.add(p); log.push(`member ${p}`); return true; },
    markUsed: async (p, u, name) => { rows[Object.keys(rows).find(k => rows[k].player_id === p)!].used_at = 'now'; log.push(`used ${p} ${u} ${name}`); },
    deleteUser: async id => { users.delete(id); log.push(`delete ${id}`); },
  };
  return { store, log, users };
}
const fresh = (): Record<string, CodeRow> => ({ ABCD2345: { player_id: 'p1', claimed_by: null, used_at: null, username: null } });
const noSleep = async () => undefined;

describe('claim-player', () => {
  it('names the player for a valid code, accepting lower case and dashes', async () => {
    const { store } = makeStore(fresh());
    const r = await handle({ action: 'check', code: 'abcd-2345' }, store, noSleep);
    expect(r).toEqual({ status: 200, body: { playerName: '김하민', recovery: false, username: null } });
    expect(normalizeCode(' ab cd-23 45 ')).toBe('ABCD2345');
  });

  it('rejects unknown or malformed codes and slows the caller down', async () => {
    const { store } = makeStore(fresh());
    let slept = 0;
    const sleep = async (ms: number) => { slept += ms; };
    expect((await handle({ action: 'check', code: 'ZZZZ2222' }, store, sleep)).body).toEqual({ error: 'bad_code' });
    expect((await handle({ action: 'claim', code: 'short', username: 'abc', password: '123456' }, store, sleep)).status).toBe(404);
    expect(slept).toBeGreaterThanOrEqual(1600);
    expect((await handle({ action: 'nope', code: 'ABCD2345' }, store, noSleep)).status).toBe(400);
    expect((await handle(null, store, noSleep)).status).toBe(400);
  });

  it('creates the account, links the player and consumes the code', async () => {
    const rows = fresh();
    const { store, log } = makeStore(rows);
    const r = await handle({ action: 'claim', code: 'ABCD2345', username: ' Kim_HaMin ', password: 'secret1' }, store, noSleep);
    expect(r).toEqual({ status: 200, body: { ok: true, username: 'kim_hamin' } });
    expect(log).toEqual([`create kim_hamin@${ID_DOMAIN}`, 'member p1', 'used p1 u1 kim_hamin']);
    expect(rows.ABCD2345.used_at).toBe('now');
    // the code cannot be used twice
    expect((await handle({ action: 'claim', code: 'ABCD2345', username: 'other', password: 'secret1' }, store, noSleep)).body).toEqual({ error: 'used' });
    expect((await handle({ action: 'check', code: 'ABCD2345' }, store, noSleep)).status).toBe(409);
  });

  it('validates the ID and the password before creating anything', async () => {
    const { store, log } = makeStore(fresh());
    for (const username of ['ab', 'has space', '한글아이디', 'UPPER-dash', 'x'.repeat(21), '']) {
      expect((await handle({ action: 'claim', code: 'ABCD2345', username, password: 'secret1' }, store, noSleep)).body).toEqual({ error: 'invalid_username' });
    }
    expect((await handle({ action: 'claim', code: 'ABCD2345', username: 'okname', password: '12345' }, store, noSleep)).body).toEqual({ error: 'weak_password' });
    expect((await handle({ action: 'claim', code: 'ABCD2345', username: 'okname', password: 'x'.repeat(73) }, store, noSleep)).body).toEqual({ error: 'weak_password' });
    expect(log).toEqual([]);
  });

  it('tells the player when the ID is taken and keeps the code usable', async () => {
    const rows = fresh();
    const { store } = makeStore(rows, { takenEmails: [`kim@${ID_DOMAIN}`] });
    expect(await handle({ action: 'claim', code: 'ABCD2345', username: 'kim', password: 'secret1' }, store, noSleep)).toEqual({ status: 409, body: { error: 'username_taken' } });
    expect(rows.ABCD2345.used_at).toBeNull();
    expect((await handle({ action: 'claim', code: 'ABCD2345', username: 'kim2', password: 'secret1' }, store, noSleep)).status).toBe(200);
  });

  it('rolls the new account back when someone else got the player first', async () => {
    const { store, log, users } = makeStore(fresh(), { playerOwned: new Set(['p1']) });
    const r = await handle({ action: 'claim', code: 'ABCD2345', username: 'late', password: 'secret1' }, store, noSleep);
    expect(r).toEqual({ status: 409, body: { error: 'used' } });
    expect(log).toEqual([`create late@${ID_DOMAIN}`, 'delete u1']);
    expect(users.size).toBe(0);
  });

  it('a re-issued code of an existing player resets the password and keeps the ID', async () => {
    const rows: Record<string, CodeRow> = { QWER3456: { player_id: 'p2', claimed_by: 'u9', used_at: null, username: 'naro' } };
    const { store, log } = makeStore(rows);
    expect((await handle({ action: 'check', code: 'QWER3456' }, store, noSleep)).body).toEqual({ playerName: '박나로', recovery: true, username: 'naro' });
    const r = await handle({ action: 'claim', code: 'QWER3456', username: 'ignored', password: 'brandnew1' }, store, noSleep);
    expect(r).toEqual({ status: 200, body: { ok: true, username: 'naro' } });
    expect(log).toEqual(['password u9', 'used p2 u9 naro']);
    expect(emailFor('naro')).toBe(`naro@${ID_DOMAIN}`);
  });
});
