import { roleGroup } from '../data/formations';
import type { Player } from '../types';

/**
 * Picks a player per role. Preference: natural position, then an alternative position,
 * then anyone who is not a goalkeeper (or a goalkeeper for the GK slot). Injured players are
 * only used as a last resort, so a full squad of "out" players still fills the pitch.
 */
export function autoAssign(roster: Player[], roles: string[]): (string | null)[] {
  const used = new Set<string>();
  const out: (string | null)[] = roles.map(() => null);
  const available = (p: Player) => !used.has(p.id);
  const passes: ((p: Player, role: string) => boolean)[] = [
    (p, r) => !p.out && p.pos === roleGroup(r),
    (p, r) => !p.out && !!p.altPos?.includes(roleGroup(r)),
    (p, r) => !p.out && (r === 'GK' ? p.pos === 'GK' : p.pos !== 'GK'),
    (p, r) => (r === 'GK' ? p.pos === 'GK' : p.pos !== 'GK'),
  ];
  for (const ok of passes) {
    roles.forEach((role, i) => {
      if (out[i]) return;
      const p = roster.find(x => available(x) && ok(x, role));
      if (p) { out[i] = p.id; used.add(p.id); }
    });
  }
  return out;
}
