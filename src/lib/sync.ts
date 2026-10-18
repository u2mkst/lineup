import { create } from 'zustand';
import { useAuth } from './auth';
import { deleteTacticRemote, fetchMyTactics, fetchRoster, isUuid, upsertTactic } from './cloud';
import { cloudEnabled } from './supabase';
import { useStore } from './store';
import { toast } from './toast';
import type { Tactic } from '../types';

export const useSync = create<{ status: 'idle' | 'saving' | 'saved' | 'error' }>(() => ({ status: 'idle' }));

/** Newest edit wins, per tactic. Equal timestamps mean both sides already agree. */
export function planSync(local: Tactic[], remote: Tactic[]): { apply: Tactic[]; push: Tactic[] } {
  const l = new Map(local.map(t => [t.id, t]));
  const r = new Map(remote.map(t => [t.id, t]));
  return {
    apply: remote.filter(t => !l.has(t.id) || t.updatedAt > l.get(t.id)!.updatedAt),
    push: local.filter(t => isUuid(t.id) && (!r.has(t.id) || t.updatedAt > r.get(t.id)!.updatedAt)),
  };
}

const DEBOUNCE_MS = 1200;
const ROSTER_REFRESH_MS = 30_000;

let started = false;

/** Wires the local store to Supabase: roster pull, and tactic push/pull while signed in. */
export function startSync() {
  if (!cloudEnabled || started) return;
  started = true;

  /** id -> updatedAt that the server is known to hold, so we never echo a change back. */
  const known = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let failing = false;

  const fail = (e: unknown) => {
    useSync.setState({ status: 'error' });
    if (!failing) toast(`서버에 저장하지 못했어요. ${(e as Error).message}`, 'error');
    failing = true;
  };
  const ok = () => { failing = false; useSync.setState({ status: 'saved' }); };

  const push = async (id: string) => {
    timers.delete(id);
    const t = useStore.getState().tactics.find(x => x.id === id);
    if (!t || !useAuth.getState().user || !isUuid(t.id) || known.get(id) === t.updatedAt) return;
    useSync.setState({ status: 'saving' });
    try {
      await upsertTactic(t);
      known.set(id, t.updatedAt);
      ok();
    } catch (e) {
      fail(e);
    }
  };
  const schedule = (id: string) => {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => void push(id), DEBOUNCE_MS));
  };

  const reconcile = async () => {
    const user = useAuth.getState().user;
    if (!user) return;
    try {
      const remote = await fetchMyTactics(user.id);
      remote.forEach(t => known.set(t.id, t.updatedAt));
      const { apply, push: up } = planSync(useStore.getState().tactics, remote);
      if (apply.length) {
        const ids = new Set(apply.map(t => t.id));
        useStore.setState(s => ({ tactics: [...apply, ...s.tactics.filter(t => !ids.has(t.id))].sort((a, b) => b.updatedAt - a.updatedAt) }));
      }
      for (const t of up) {
        await upsertTactic(t);
        known.set(t.id, t.updatedAt);
      }
      ok();
      if (up.length) toast(`전술 ${up.length}개를 서버에 저장했어요`);
      if (apply.length) toast(`서버 전술 ${apply.length}개를 불러왔어요`);
    } catch (e) {
      fail(e);
    }
  };

  useStore.subscribe((s, prev) => {
    if (s.tactics === prev.tactics || !useAuth.getState().user) return;
    const before = new Map(prev.tactics.map(t => [t.id, t]));
    const now = new Set(s.tactics.map(t => t.id));
    for (const t of s.tactics) if (before.get(t.id) !== t && known.get(t.id) !== t.updatedAt) schedule(t.id);
    for (const t of prev.tactics) {
      if (now.has(t.id)) continue;
      clearTimeout(timers.get(t.id));
      known.delete(t.id);
      if (isUuid(t.id)) deleteTacticRemote(t.id).catch(fail);
    }
  });

  useAuth.subscribe((s, prev) => {
    if (s.user && !prev.user) void reconcile();
    if (!s.user && prev.user) { known.clear(); useSync.setState({ status: 'idle' }); }
  });

  // The roster is shared by everyone; refresh it on start and whenever the tab comes back.
  let lastRoster = 0;
  const refreshRoster = async () => {
    if (Date.now() - lastRoster < ROSTER_REFRESH_MS) return;
    lastRoster = Date.now();
    try {
      useStore.setState({ roster: await fetchRoster() });
    } catch { /* keep the cached roster */ }
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void refreshRoster());
  window.addEventListener('online', () => { void refreshRoster(); void reconcile(); });

  void useAuth.getState().init().then(() => reconcile());
  void refreshRoster();
}

/** Force a roster reload, e.g. after an admin changed it. */
export async function reloadRoster(): Promise<void> {
  useStore.setState({ roster: await fetchRoster() });
}
