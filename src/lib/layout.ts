import { formationRoles } from '../data/formations';
import type { Pt, TokenSide } from '../types';

const SPAN = [0, 0, 0.28, 0.5, 0.72, 0.8];

/** Roles of the 11 tokens, index 0 is always the goalkeeper. */
export function rolesFor(formation: string): string[] {
  return ['GK', ...(formationRoles[formation] ?? formationRoles['4-2-3-1']).flat()];
}

export function tokenIds(side: TokenSide): string[] {
  const p = side === 'us' ? 'u' : 'o';
  return Array.from({ length: 11 }, (_, i) => `${p}${i}`);
}

/**
 * Formation -> 11 normalized positions. "Us" plays upward from the bottom,
 * the opponent is mirrored. With an opponent on the pitch each side is
 * squeezed into its own half.
 */
export function layoutFormation(formation: string, side: TokenSide, hasOpp: boolean): Pt[] {
  const lines = (formationRoles[formation] ?? formationRoles['4-2-3-1']).map(l => l.length);
  const [gk, defY, atkY] = hasOpp ? [0.925, 0.84, 0.54] : [0.91, 0.78, 0.14];
  const pts: Pt[] = [{ x: 0.5, y: gk }];
  lines.forEach((n, li) => {
    const y = lines.length === 1 ? defY : defY + ((atkY - defY) * li) / (lines.length - 1);
    const span = SPAN[n] ?? 0.8;
    for (let i = 0; i < n; i++) {
      pts.push({ x: n === 1 ? 0.5 : 0.5 - span / 2 + (span * i) / (n - 1), y });
    }
  });
  return side === 'us' ? pts : pts.map(p => ({ x: 1 - p.x, y: 1 - p.y }));
}

/** Token ids grouped by line, defence first; the goalkeeper is kept apart. */
export function lineTokenIds(formation: string, side: TokenSide): { gk: string; lines: string[][] } {
  const prefix = side === 'us' ? 'u' : 'o';
  const sizes = (formationRoles[formation] ?? formationRoles['4-2-3-1']).map(l => l.length);
  let next = 1;
  return { gk: `${prefix}0`, lines: sizes.map(n => Array.from({ length: n }, () => `${prefix}${next++}`)) };
}
