import type { Match, MatchStat, Player } from '../types';

/** A quarter with at least this many goals counts as "high scoring" / "heavy concede". */
export const BIG_QUARTER = 3;

export const isPlayed = (m: Match) => m.kind === 'match' && m.status === 'finished' && m.ourScore != null && m.oppScore != null;
export const seasonOf = (iso: string) => new Date(iso).getFullYear();

export function seasons(matches: Match[]): number[] {
  return [...new Set(matches.filter(isPlayed).map(m => seasonOf(m.kickoff)))].sort((a, b) => b - a);
}

export interface TeamStats {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** 0..1 */
  winRate: number;
  goalsFor: number;
  goalsAgainst: number;
  avgFor: number;
  avgAgainst: number;
  scoreless: number;
  cleanSheets: number;
  bigQuartersFor: number;
  bigQuartersAgainst: number;
}

export function teamStats(matches: Match[]): TeamStats {
  const ms = matches.filter(isPlayed);
  const n = ms.length;
  const wins = ms.filter(m => m.ourScore! > m.oppScore!).length;
  const draws = ms.filter(m => m.ourScore === m.oppScore).length;
  const goalsFor = ms.reduce((a, m) => a + m.ourScore!, 0);
  const goalsAgainst = ms.reduce((a, m) => a + m.oppScore!, 0);
  const quarters = ms.flatMap(m => m.quarters);
  return {
    games: n, wins, draws, losses: n - wins - draws, winRate: n ? wins / n : 0,
    goalsFor, goalsAgainst, avgFor: n ? goalsFor / n : 0, avgAgainst: n ? goalsAgainst / n : 0,
    scoreless: ms.filter(m => m.ourScore === 0).length,
    cleanSheets: ms.filter(m => m.oppScore === 0).length,
    bigQuartersFor: quarters.filter(q => q.us >= BIG_QUARTER).length,
    bigQuartersAgainst: quarters.filter(q => q.opp >= BIG_QUARTER).length,
  };
}

export interface Leader {
  playerId: string;
  value: number;
  /** others sharing the top value */
  tied: string[];
}

export interface PlayerBoard {
  goals: Leader | null;
  assists: Leader | null;
  points: Leader | null;
  appearances: Leader | null;
  potm: Leader | null;
  /** defenders with the most clean-sheet games played */
  defender: Leader | null;
  goalsPerGame: Leader | null;
  pointsPerGame: Leader | null;
}

export interface PlayerLine {
  playerId: string;
  games: number;
  goals: number;
  assists: number;
  points: number;
  potm: number;
  cleanSheets: number;
}

/** Per-player totals over the given matches. */
export function playerLines(matches: Match[], stats: MatchStat[], roster: Player[]): PlayerLine[] {
  const played = new Map(matches.filter(isPlayed).map(m => [m.id, m]));
  const lines = new Map<string, PlayerLine>();
  const line = (id: string) => {
    let l = lines.get(id);
    if (!l) lines.set(id, (l = { playerId: id, games: 0, goals: 0, assists: 0, points: 0, potm: 0, cleanSheets: 0 }));
    return l;
  };
  const pos = new Map(roster.map(p => [p.id, p.pos]));
  for (const s of stats) {
    const m = played.get(s.matchId);
    if (!m) continue;
    const l = line(s.playerId);
    if (s.played) {
      l.games++;
      if (m.oppScore === 0 && pos.get(s.playerId) === 'DF') l.cleanSheets++;
    }
    l.goals += s.goals;
    l.assists += s.assists;
    l.points = l.goals + l.assists;
  }
  for (const m of played.values()) if (m.potmPlayerId) line(m.potmPlayerId).potm++;
  return [...lines.values()];
}

function top(lines: PlayerLine[], value: (l: PlayerLine) => number, eligible: (l: PlayerLine) => boolean = () => true): Leader | null {
  const pool = lines.filter(eligible).map(l => ({ id: l.playerId, v: value(l) })).filter(x => x.v > 0);
  if (!pool.length) return null;
  const best = Math.max(...pool.map(x => x.v));
  const ids = pool.filter(x => Math.abs(x.v - best) < 1e-9).map(x => x.id);
  return { playerId: ids[0], value: best, tied: ids.slice(1) };
}

export function playerBoard(matches: Match[], stats: MatchStat[], roster: Player[]): PlayerBoard {
  const lines = playerLines(matches, stats, roster);
  const games = matches.filter(isPlayed).length;
  // Per-game averages need a few appearances to mean anything.
  const minGames = Math.min(3, Math.max(1, games));
  const enough = (l: PlayerLine) => l.games >= minGames;
  return {
    goals: top(lines, l => l.goals),
    assists: top(lines, l => l.assists),
    points: top(lines, l => l.points),
    appearances: top(lines, l => l.games),
    potm: top(lines, l => l.potm),
    defender: top(lines, l => l.cleanSheets),
    goalsPerGame: top(lines, l => l.goals / l.games, enough),
    pointsPerGame: top(lines, l => l.points / l.games, enough),
  };
}

/** Record against one opponent (matched by name, ignoring case and spaces). */
export function headToHead(matches: Match[], opponent: string): { wins: number; draws: number; losses: number } {
  const key = opponent.replace(/\s+/g, '').toLowerCase();
  const ms = key ? matches.filter(m => isPlayed(m) && m.opponent.replace(/\s+/g, '').toLowerCase() === key) : [];
  const wins = ms.filter(m => m.ourScore! > m.oppScore!).length;
  const draws = ms.filter(m => m.ourScore === m.oppScore).length;
  return { wins, draws, losses: ms.length - wins - draws };
}

/** Average age of players with a known birth year, rounded to 0.1. */
export function averageAge(roster: Player[], now = new Date()): number | null {
  const ages = roster.filter(p => p.birthYear).map(p => now.getFullYear() - p.birthYear!);
  return ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null;
}
