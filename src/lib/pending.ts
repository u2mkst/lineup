/**
 * An invite / setup link carries a code. It is remembered on this device so the person can
 * leave to confirm their e-mail and come back without typing it.
 */
export interface Pending {
  kind: 'invite' | 'setup';
  code: string;
}

const KEY = 'chukgubang:pending';

export function readPending(): Pending | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Pending | null;
    return v && (v.kind === 'invite' || v.kind === 'setup') && typeof v.code === 'string' && v.code ? v : null;
  } catch {
    return null;
  }
}

export function savePending(p: Pending) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function clearPending() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Link a coach shares with the team: opening it joins the club without typing the code. */
export function inviteLink(code: string, origin = location.origin, pathname = location.pathname): string {
  return `${origin}${pathname}#/join/${encodeURIComponent(code)}`;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export interface PasswordCheck {
  long: boolean;
  letter: boolean;
  digit: boolean;
  ok: boolean;
}

/** Live feedback while typing a new password. */
export function checkPassword(v: string): PasswordCheck {
  const long = v.length >= 8;
  const letter = /[A-Za-z가-힣]/.test(v);
  const digit = /\d/.test(v);
  return { long, letter, digit, ok: long && letter && digit };
}

/** The text a coach pastes into the team chat: one tap on the link joins the club. */
export function inviteMessage(teamName: string, code: string): string {
  return `[${teamName}] 축구방 초대\n아래 링크를 열고 이메일로 가입하면 바로 합류돼요.\n${inviteLink(code)}\n(링크가 안 열리면 합류코드: ${code})`;
}
