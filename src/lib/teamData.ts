import { create } from 'zustand';
import { fetchMatches, fetchStats } from './cloud';
import type { Match, MatchStat } from '../types';

interface TeamData {
  matches: Match[];
  stats: MatchStat[];
  loaded: boolean;
  error: boolean;
  /** (re)load calendar and records; shows cached data while it runs */
  load: () => Promise<void>;
}

/** Shared by home, schedule and records so switching tabs does not refetch or flicker. */
export const useTeamData = create<TeamData>((set) => ({
  matches: [],
  stats: [],
  loaded: false,
  error: false,
  load: async () => {
    try {
      const [matches, stats] = await Promise.all([fetchMatches(), fetchStats()]);
      set({ matches, stats, loaded: true, error: false });
    } catch {
      set(s => ({ loaded: s.loaded, error: true }));
    }
  },
}));
