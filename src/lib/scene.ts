import { rolesFor, tokenIds } from './layout';
import type { Frame, Player, Pt, Scene, SceneDrawing, SceneToken, Tactic } from '../types';

export interface SceneOpts {
  /** previous frame, to draw movement trails from */
  prev?: Frame | null;
  /** `via` overrides, e.g. while a curve handle is being dragged */
  via?: Record<string, Pt>;
  drawings?: SceneDrawing[];
}

export function buildScene(
  tactic: Tactic,
  roster: Player[],
  positions: Record<string, Pt>,
  ball: Pt | null,
  opts: SceneOpts = {},
  frame?: Frame,
): Scene {
  const { prev = null, drawings = [] } = opts;
  const via = { ...(frame?.via ?? {}), ...(opts.via ?? {}) };
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
  if (prev) {
    const moved = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) > 0.02;
    for (const tk of tokens) {
      const from = prev.positions[tk.id];
      if (from && moved(from, tk)) trails.push({ id: tk.id, from, to: { x: tk.x, y: tk.y }, via: via[tk.id], color: tk.color });
    }
    if (ball && moved(prev.ball, ball)) trails.push({ id: 'ball', from: prev.ball, to: ball, via: via.ball, color: '#ffffff' });
  }
  return { tokens, ball, trails, drawings };
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

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
