/**
 * Players sign in with an ID instead of an e-mail. Supabase Auth needs an e-mail, so the ID is turned into
 * <id>@ID_DOMAIN. Keep ID_DOMAIN identical to supabase/functions/claim-player/logic.ts (a test checks that).
 */
export const ID_DOMAIN = 'lineup-jade-xi.vercel.app';
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const MIN_PLAYER_PASSWORD = 6;

export const normalizeUsername = (s: string) => s.trim().toLowerCase();
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');
export const isCode = (s: string) => /^[A-Z2-9]{8}$/.test(normalizeCode(s));

/** What the login box accepted: an e-mail as typed, or an ID mapped to its internal e-mail. */
export function loginEmail(input: string): string {
  const v = input.trim();
  return v.includes('@') ? v : `${normalizeUsername(v)}@${ID_DOMAIN}`;
}

export interface UsernameCheck { ok: boolean; long: boolean; chars: boolean }
/** Live feedback while choosing an ID. */
export function checkUsername(raw: string): UsernameCheck {
  const v = normalizeUsername(raw);
  const long = v.length >= 3 && v.length <= 20;
  const chars = /^[a-z0-9_]*$/.test(v);
  return { ok: USERNAME_RE.test(v), long, chars };
}
