import type { Player, Pos } from '../types';

const ORDER: Record<Pos, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

/** GK -> DF -> MF -> FW, then by shirt number. */
export function sortRoster(list: Player[]): Player[] {
  return [...list].sort((a, b) => ORDER[a.pos] - ORDER[b.pos] || (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) || a.name.localeCompare(b.name, 'ko'));
}
