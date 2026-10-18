import { linkTactic, upsertTactic } from './cloud';
import { useStore } from './store';
import type { Tactic } from '../types';

/**
 * Tie a line-up to a match. The match points at the tactic, so the tactic must be on the
 * server and public first (anyone voting for the match has to be able to see it).
 */
export async function attachTactic(tactic: Tactic, matchId: string): Promise<void> {
  await upsertTactic({ ...tactic, isPublic: true, matchId });
  await linkTactic(matchId, tactic.id);
  useStore.getState().edit(tactic.id, t => { t.isPublic = true; t.matchId = matchId; });
}

export async function detachTactic(tactic: Tactic): Promise<void> {
  if (tactic.matchId) await linkTactic(tactic.matchId, null);
  useStore.getState().edit(tactic.id, t => { delete t.matchId; });
}
