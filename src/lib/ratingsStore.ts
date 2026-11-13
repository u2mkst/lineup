import { create } from 'zustand';
import { fetchRatings, saveRating } from './cloud';
import type { Rating } from '../types';

interface RatingsState {
  data: Record<string, Rating>;
  loaded: boolean;
  load: () => Promise<void>;
  /** optimistic local change; the server write is done by `persist` */
  set: (playerId: string, r: Rating) => void;
  persist: (playerId: string) => Promise<void>;
  reset: () => void;
}

/**
 * The coach's private ratings. Deliberately NOT persisted to localStorage and never part of a
 * tactic or share link: it lives in memory for this admin session only.
 */
export const useRatings = create<RatingsState>((set, get) => ({
  data: {},
  loaded: false,
  load: async () => { set({ data: await fetchRatings(), loaded: true }); },
  set: (playerId, r) => set(s => ({ data: { ...s.data, [playerId]: r } })),
  persist: async playerId => {
    const r = get().data[playerId];
    if (r) await saveRating(playerId, r);
  },
  reset: () => set({ data: {}, loaded: false }),
}));
