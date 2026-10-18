import type { Tactic } from '../types';

/** Who plays each of our slots at a given frame: the line-up plus every substitution up to then. */
export function assignAt(tactic: Tactic, frameIndex: number): Record<string, string | null> {
  const out = { ...tactic.us.assign };
  for (let i = 1; i <= frameIndex && i < tactic.frames.length; i++) Object.assign(out, tactic.frames[i].subs);
  return out;
}

/** Players not on the pitch at a frame. */
export function benchAt<T extends { id: string }>(tactic: Tactic, roster: T[], frameIndex: number): T[] {
  const on = new Set(Object.values(assignAt(tactic, frameIndex)).filter(Boolean));
  return roster.filter(p => !on.has(p.id));
}
