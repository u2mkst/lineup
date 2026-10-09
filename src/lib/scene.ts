import { rolesFor, tokenIds } from './layout';
import type { Player, Pt, Scene, SceneToken, Tactic } from '../types';

export function buildScene(
  tactic: Tactic,
  roster: Player[],
  positions: Record<string, Pt>,
  ball: Pt | null,
  prevPositions?: Record<string, Pt> | null,
): Scene {
  const tokens: SceneToken[] = [];
  const usRoles = rolesFor(tactic.us.formation);
  tokenIds('us').forEach((id, i) => {
    const pl = roster.find(p => p.id === tactic.us.assign[id]);
    const pos = positions[id];
    if (!pos) return;
    tokens.push({
      id, side: 'us', x: pos.x, y: pos.y,
      number: pl?.number ?? '', name: pl?.name ?? '', color: tactic.us.color,
      role: usRoles[i], empty: !pl,
    });
  });
  if (tactic.opp) {
    const opp = tactic.opp;
    const oRoles = rolesFor(opp.formation);
    tokenIds('opp').forEach((id, i) => {
      const pos = positions[id];
      if (!pos) return;
      const lb = opp.labels[id];
      tokens.push({
        id, side: 'opp', x: pos.x, y: pos.y,
        number: lb?.number ?? '', name: lb?.name ?? '', color: opp.color,
        role: oRoles[i], empty: false,
      });
    });
  }
  const trails: Scene['trails'] = [];
  if (prevPositions) {
    for (const tk of tokens) {
      const from = prevPositions[tk.id];
      if (from && Math.hypot(from.x - tk.x, from.y - tk.y) > 0.02) {
        trails.push({ id: tk.id, from, to: { x: tk.x, y: tk.y }, color: tk.color });
      }
    }
  }
  return { tokens, ball, trails };
}

/** Roster players that are not on the pitch -> bench (교체 명단). */
export function benchOf(tactic: Tactic, roster: Player[]): Player[] {
  const onPitch = new Set(Object.values(tactic.us.assign).filter(Boolean));
  return roster.filter(p => !onPitch.has(p.id));
}

/** Readable text colour on top of a token fill. */
export function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? '#0b1f17' : '#ffffff';
}
