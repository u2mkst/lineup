import { roleGroup } from '../data/formations';
import type { Player, Pos, Rating, RatingKey } from '../types';

export const NEUTRAL = 5;

export const ATTRS: { key: RatingKey; label: string; hint: string }[] = [
  { key: 'shooting', label: '슈팅', hint: '골 결정력, 슛 정확도' },
  { key: 'passing', label: '패스', hint: '패스 정확도, 시야' },
  { key: 'dribbling', label: '드리블', hint: '볼 컨트롤, 돌파' },
  { key: 'defending', label: '수비', hint: '태클, 위치 선정, 마킹' },
  { key: 'pace', label: '스피드', hint: '주력, 순간 가속' },
  { key: 'stamina', label: '체력', hint: '끝까지 뛰는 힘' },
  { key: 'physical', label: '피지컬', hint: '몸싸움, 공중볼' },
  { key: 'keeper', label: '골키핑', hint: '선방, 펀칭, 킥' },
];

export const blankRating = (): Rating => ({ shooting: NEUTRAL, passing: NEUTRAL, dribbling: NEUTRAL, defending: NEUTRAL, pace: NEUTRAL, stamina: NEUTRAL, physical: NEUTRAL, keeper: NEUTRAL });

type Weights = Partial<Record<RatingKey, number>>;

/** What each slot asks of a player. Wide slots lean on pace and stamina, centre-backs on defending and strength. */
export function roleWeights(role: string): Weights {
  if (role === 'GK') return { keeper: 6, physical: 1, passing: 1, pace: 0.5 };
  if (/^(LCB|RCB|CB)$/.test(role)) return { defending: 4, physical: 3, pace: 1.5, passing: 1, stamina: 1 };
  if (/^(LB|RB|LWB|RWB)$/.test(role)) return { defending: 3, pace: 2.5, stamina: 2.5, passing: 1, dribbling: 1, physical: 1 };
  if (role === 'CDM') return { defending: 3, passing: 3, stamina: 2.5, physical: 2 };
  if (/^(AM|LAM|RAM)$/.test(role)) return { passing: 3, dribbling: 3, shooting: 2.5, pace: 1 };
  if (/^(LM|RM)$/.test(role)) return { pace: 3, dribbling: 2.5, passing: 2, stamina: 2 };
  if (/^(LW|RW)$/.test(role)) return { pace: 3, dribbling: 3, shooting: 2.5, passing: 1 };
  if (/^(ST|LST|RST)$/.test(role)) return { shooting: 4, physical: 2, pace: 2, dribbling: 1.5 };
  return { passing: 3, stamina: 2.5, dribbling: 2, defending: 1.5, shooting: 1 }; // LCM, CM, RCM
}

const ratingOf = (r: Rating | undefined): Rating => r ?? blankRating();

/** 10–100: weighted average of the attributes a slot needs. */
export function slotScore(r: Rating | undefined, role: string): number {
  const rating = ratingOf(r);
  const w = roleWeights(role);
  let sum = 0;
  let total = 0;
  for (const [k, weight] of Object.entries(w) as [RatingKey, number][]) { sum += rating[k] * weight; total += weight; }
  return total ? (sum / total) * 10 : NEUTRAL * 10;
}

/** How comfortable the player is in that slot: natural 1, secondary 0.92, wrong line lower, field player in goal worst. */
export function fit(p: Player, role: string): number {
  const group: Pos = roleGroup(role);
  if (p.pos === group) return 1;
  if (p.altPos?.includes(group)) return 0.92;
  if (group === 'GK') return 0.25;
  if (p.pos === 'GK') return 0.45;
  return 0.8;
}

/** The score used to compare players for a slot. */
export const playerScore = (p: Player, r: Rating | undefined, role: string): number => slotScore(r, role) * fit(p, role);

/** One number for the player's own position (shown in the rating list). */
export function overall(p: Player, r: Rating | undefined): number {
  const typical: Record<Pos, string> = { GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST' };
  return Math.round(slotScore(r, typical[p.pos]));
}

export interface Pick {
  role: string;
  playerId: string | null;
  score: number;
}

export interface PickResult {
  picks: Pick[];
  /** mean slot score of the filled slots, 0–100 */
  strength: number;
  /** picked players who have no rating yet (counted as an average 5) */
  unrated: string[];
}

/** Minimum-cost assignment (Hungarian). rows ≤ cols. Returns the column chosen for each row. */
function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const m = cost[0]?.length ?? 0;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(m + 1).fill(0);
  const p = new Array<number>(m + 1).fill(0);
  const way = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(m + 1).fill(Infinity);
    const used = new Array<boolean>(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const out = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1;
  return out;
}

export interface PickOptions {
  /** only these players may be chosen (e.g. the ones who voted "참석") */
  pool?: Set<string>;
  /** players the coach struck out by hand */
  exclude?: Set<string>;
}

/**
 * Best eleven for a formation: the assignment of players to slots that maximises the total slot score.
 * Injured players are only used when there are not enough healthy ones.
 */
export function pickBest(players: Player[], ratings: Record<string, Rating>, roles: string[], opts: PickOptions = {}): PickResult {
  const allowed = players.filter(p => (!opts.pool || opts.pool.has(p.id)) && !opts.exclude?.has(p.id));
  const healthy = allowed.filter(p => !p.out);
  const candidates = healthy.length >= roles.length ? healthy : [...healthy, ...allowed.filter(p => p.out)];
  // dummy columns let a short squad leave slots empty instead of failing
  const cols = Math.max(candidates.length, roles.length);
  const cost = roles.map(role => Array.from({ length: cols }, (_, j) => {
    const p = candidates[j];
    return p ? -playerScore(p, ratings[p.id], role) : 0;
  }));
  const chosen = roles.length ? hungarian(cost) : [];
  const picks: Pick[] = roles.map((role, i) => {
    const p = candidates[chosen[i]];
    return p ? { role, playerId: p.id, score: Math.round(playerScore(p, ratings[p.id], role)) } : { role, playerId: null, score: 0 };
  });
  const filled = picks.filter(x => x.playerId);
  return {
    picks,
    strength: filled.length ? Math.round(filled.reduce((a, x) => a + x.score, 0) / filled.length) : 0,
    unrated: filled.map(x => x.playerId!).filter(id => !ratings[id]),
  };
}
