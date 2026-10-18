import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from './supabase';

interface AuthState {
  /** false until the stored session has been read */
  ready: boolean;
  user: { id: string; email: string } | null;
  /** every account is an admin today, but the server is the source of truth */
  isAdmin: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** resolves `needsConfirm: true` when the project requires e-mail verification first */
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
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

export const useAuth = create<AuthState>((set) => {
  const apply = async (session: Session | null) => {
    if (!session || !supabase) { set({ ready: true, user: null, isAdmin: false }); return; }
    const user = { id: session.user.id, email: session.user.email ?? '' };
    set({ ready: true, user });
    const { data } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    set({ isAdmin: !!data });
  };

  return {
    ready: !supabase,
    user: null,
    isAdmin: false,
    init: async () => {
      if (!supabase) return;
      // supabase-js deadlocks if its own API is called synchronously inside this callback.
      supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => void apply(session), 0); });
      const { data } = await supabase.auth.getSession();
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
    signOut: async () => {
      await supabase?.auth.signOut();
      set({ user: null, isAdmin: false });
    },
  };
});
