import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { claimAdmin, fetchMyMember, fetchTeamName, joinTeam } from './cloud';
import { supabase } from './supabase';
import type { Member } from '../types';

interface AuthState {
  /** false until the stored session (and membership) has been read */
  ready: boolean;
  user: { id: string; email: string } | null;
  /** null while signed in but not yet part of the team */
  member: Member | null;
  /** convenience: member.role === 'admin' (the server enforces it) */
  isAdmin: boolean;
  teamName: string;
  init: () => Promise<void>;
  /** re-read membership and team name, e.g. after linking a player */
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** resolves `needsConfirm: true` when the project requires e-mail verification first */
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  /** send the verification mail again */
  resend: (email: string) => Promise<void>;
  /** enter the team with its join code */
  join: (code: string) => Promise<void>;
  /** become the first admin with the one-time setup code */
  claim: (code: string) => Promise<void>;
}

function message(e: { message?: string } | null): Error {
  const m = e?.message ?? '';
  if (/invalid login credentials/i.test(m)) return new Error('이메일 또는 비밀번호가 맞지 않아요.');
  if (/email not confirmed/i.test(m)) return new Error('메일로 보낸 인증 링크를 먼저 눌러 주세요.');
  if (/already registered|already been registered/i.test(m)) return new Error('이미 가입된 이메일이에요. 로그인해 주세요.');
  if (/password/i.test(m) && /(least|short|weak)/i.test(m)) return new Error('비밀번호가 너무 짧거나 약해요. 8자 이상으로 입력해 주세요.');
  if (/rate limit|too many/i.test(m)) return new Error('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
  if (/failed to fetch|network|load failed/i.test(m)) return new Error('인터넷 연결을 확인해 주세요.');
  return new Error(m || '요청에 실패했어요');
}

export const useAuth = create<AuthState>((set, get) => {
  const empty = { user: null, member: null, isAdmin: false };

  const apply = async (session: Session | null) => {
    if (!session || !supabase) { set({ ...empty, ready: true }); return; }
    const user = { id: session.user.id, email: session.user.email ?? '' };
    try {
      const member = await fetchMyMember(user.id);
      const teamName = member ? await fetchTeamName().catch(() => get().teamName) : get().teamName;
      set({ ready: true, user, member, isAdmin: member?.role === 'admin', teamName });
    } catch {
      // keep what we knew; the next auth event or refresh() tries again
      set({ ready: true, user });
    }
  };

  return {
    ready: !supabase,
    ...empty,
    teamName: '우리 팀',
    init: async () => {
      if (!supabase) return;
      // supabase-js deadlocks if its own API is called synchronously inside this callback.
      supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => void apply(session), 0); });
      const { data } = await supabase.auth.getSession();
      await apply(data.session);
    },
    refresh: async () => {
      const { data } = await supabase!.auth.getSession();
      await apply(data.session);
    },
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw message(error);
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password });
      if (error) throw message(error);
      // An existing confirmed address comes back as a user with no identities.
      if (data.user && data.user.identities?.length === 0) throw message({ message: 'User already registered' });
      return { needsConfirm: !data.session };
    },
    resend: async email => {
      const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim() });
      if (error) throw message(error);
    },
    signOut: async () => {
      await supabase?.auth.signOut();
      set({ ...empty });
    },
    join: async code => { await joinTeam(code); await get().refresh(); },
    claim: async code => { await claimAdmin(code); await get().refresh(); },
  };
});
