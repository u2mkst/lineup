import type { Match, MatchStat, Player } from '../types';
import { isPlayed, playerLines, seasonOf, type PlayerLine } from './stats';

export type Outcome = 'win' | 'draw' | 'lose';

export const outcomeOf = (m: Match): Outcome => (m.ourScore! > m.oppScore! ? 'win' : m.ourScore! < m.oppScore! ? 'lose' : 'draw');
export const OUTCOME_LABEL: Record<Outcome, string> = { win: '승', draw: '무', lose: '패' };

export interface ResultRow {
  match: Match;
  outcome: Outcome;
  /** who scored, most goals first */
  scorers: { playerId: string; name: string; goals: number }[];
}

/** Finished matches of the season, newest first, with their scorers. */
export function recentResults(matches: Match[], stats: MatchStat[], roster: Player[], season: number, limit = 5): ResultRow[] {
  const names = new Map(roster.map(p => [p.id, p.name]));
  return matches
    .filter(m => isPlayed(m) && seasonOf(m.kickoff) === season)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, limit)
    .map(match => ({
      match,
      outcome: outcomeOf(match),
      scorers: stats
        .filter(s => s.matchId === match.id && s.goals > 0)
        .map(s => ({ playerId: s.playerId, name: names.get(s.playerId) ?? '(삭제된 선수)', goals: s.goals }))
        .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'ko')),
    }));
}

/** Last results oldest → newest, for the little form strip. */
export function form(matches: Match[], season: number, n = 5): Outcome[] {
  return matches
    .filter(m => isPlayed(m) && seasonOf(m.kickoff) === season)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(-n)
    .map(outcomeOf);
}

export type ScoreKind = 'goals' | 'assists' | 'points';

export interface ScoreRow {
  rank: number;
  playerId: string;
  value: number;
  games: number;
}

/** Leaderboard with shared ranks for ties (1, 1, 3, …). Only players with at least one. */
export function scoreboard(matches: Match[], stats: MatchStat[], roster: Player[], season: number, kind: ScoreKind, limit = 5): ScoreRow[] {
  const lines: PlayerLine[] = playerLines(matches.filter(m => seasonOf(m.kickoff) === season), stats, roster);
  const known = new Set(roster.map(p => p.id));
  const sorted = lines
    .filter(l => known.has(l.playerId) && l[kind] > 0)
    .sort((a, b) => b[kind] - a[kind] || a.games - b.games || a.playerId.localeCompare(b.playerId));
  const rows: ScoreRow[] = [];
  sorted.forEach((l, i) => {
    const rank = i > 0 && sorted[i - 1][kind] === l[kind] ? rows[i - 1].rank : i + 1;
    rows.push({ rank, playerId: l.playerId, value: l[kind], games: l.games });
  });
  return rows.filter(r => r.rank <= limit);
}

/** Season to show first: this year if it has results, otherwise the latest one that does. */
export function defaultSeason(matches: Match[], now = new Date()): number {
  const years = [...new Set(matches.filter(isPlayed).map(m => seasonOf(m.kickoff)))].sort((a, b) => b - a);
  const y = now.getFullYear();
  return years.includes(y) || years.length === 0 ? y : years[0];
}
