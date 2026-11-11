import { describe, expect, it } from 'vitest';
import { averageAge, headToHead, playerBoard, seasons, teamStats } from '../stats';
import type { Match, MatchStat, Player } from '../../types';

let n = 0;
const match = (over: Partial<Match> = {}): Match => ({
  id: `m${++n}`, kind: 'match', title: 't', opponent: '강남FC', kickoff: '2026-05-01T10:00:00Z', venue: '', notes: '', tacticId: null,
  status: 'finished', ourScore: 2, oppScore: 1, quarters: [], potmPlayerId: null, voteDeadline: null, ...over,
});
const stat = (matchId: string, playerId: string, goals = 0, assists = 0, played = true): MatchStat => ({ matchId, playerId, played, goals, assists });
const pl = (id: string, pos: Player['pos'], birthYear?: number): Player => ({ id, number: id, name: id, pos, ...(birthYear ? { birthYear } : {}) });

describe('team stats', () => {
  it('counts only finished matches and ignores social events and cancelled games', () => {
    const ms = [
      match({ ourScore: 2, oppScore: 0, quarters: [{ us: 3, opp: 0 }, { us: 0, opp: 0 }] }),
      match({ ourScore: 0, oppScore: 0 }),
      match({ ourScore: 1, oppScore: 4, quarters: [{ us: 0, opp: 3 }] }),
      match({ kind: 'social', ourScore: 9, oppScore: 0 }),
      match({ status: 'cancelled', ourScore: null, oppScore: null }),
      match({ status: 'scheduled', ourScore: null, oppScore: null }),
    ];
    const t = teamStats(ms);
    expect(t).toMatchObject({ games: 3, wins: 1, draws: 1, losses: 1, goalsFor: 3, goalsAgainst: 4, scoreless: 1, cleanSheets: 2, bigQuartersFor: 1, bigQuartersAgainst: 1 });
    expect(t.winRate).toBeCloseTo(1 / 3, 6);
    expect(t.avgFor).toBe(1);
    expect(teamStats([])).toMatchObject({ games: 0, winRate: 0, avgFor: 0 });
  });
  it('lists seasons newest first', () => {
    expect(seasons([match({ kickoff: '2025-03-01T00:00:00Z' }), match({ kickoff: '2026-03-01T00:00:00Z' }), match({ kickoff: '2026-04-01T00:00:00Z' })])).toEqual([2026, 2025]);
  });
});

describe('player leaders', () => {
  const roster = [pl('gk', 'GK'), pl('d1', 'DF'), pl('d2', 'DF'), pl('f1', 'FW'), pl('f2', 'FW')];
  const m1 = match({ ourScore: 3, oppScore: 0, potmPlayerId: 'f1' });
  const m2 = match({ ourScore: 1, oppScore: 1, potmPlayerId: 'f1' });
  const m3 = match({ ourScore: 2, oppScore: 0, potmPlayerId: 'f2' });
  const stats = [
    stat(m1.id, 'f1', 2, 1), stat(m1.id, 'f2', 1, 0), stat(m1.id, 'd1'), stat(m1.id, 'gk'),
    stat(m2.id, 'f1', 1, 0), stat(m2.id, 'f2', 0, 1), stat(m2.id, 'd1'),
    stat(m3.id, 'f2', 2, 0), stat(m3.id, 'd1'), stat(m3.id, 'd2'), stat(m3.id, 'f1', 0, 0, false),
  ];
  const board = playerBoard([m1, m2, m3], stats, roster);
  it('picks scorers, assisters, points and appearances', () => {
    expect(board.goals).toEqual({ playerId: 'f1', value: 3, tied: ['f2'] });   // 3 each -> shared
    expect(board.assists?.value).toBe(1);
    expect(board.assists?.tied).toEqual(['f2']);
    expect(board.points?.value).toBe(4);
    expect(board.appearances?.value).toBe(3);                                      // d1 and f2 both played all three
    expect([board.appearances!.playerId, ...board.appearances!.tied].sort()).toEqual(['d1', 'f2']);
  });
  it('counts POTM and clean sheets only for defenders', () => {
    expect(board.potm).toMatchObject({ playerId: 'f1', value: 2 });
    expect(board.defender).toMatchObject({ playerId: 'd1', value: 2 });         // m1 and m3 were clean sheets; goalkeeper is not a defender
  });
  it('needs a few appearances for per-game averages', () => {
    const lone = playerBoard([m1, m2, m3], [stat(m1.id, 'f1', 5, 0)], roster);
    expect(lone.goalsPerGame).toBeNull();                                          // 1 game < minimum of 3
    const small = playerBoard([m1], [stat(m1.id, 'f1', 2, 0)], roster);
    expect(small.goalsPerGame).toMatchObject({ playerId: 'f1', value: 2 });       // only one game exists, so one is enough
  });
  it('ignores stats from matches that are not finished', () => {
    const open = match({ status: 'scheduled', ourScore: null, oppScore: null });
    expect(playerBoard([open], [stat(open.id, 'f1', 9)], roster).goals).toBeNull();
  });
});

describe('head to head and age', () => {
  it('matches opponents by name ignoring spaces and case', () => {
    const ms = [match({ opponent: 'FC 동네축구단', ourScore: 2, oppScore: 0 }), match({ opponent: 'fc동네축구단', ourScore: 1, oppScore: 1 }), match({ opponent: '다른팀' })];
    expect(headToHead(ms, 'FC동네 축구단')).toEqual({ wins: 1, draws: 1, losses: 0 });
    expect(headToHead(ms, '')).toEqual({ wins: 0, draws: 0, losses: 0 });
  });
  it('averages ages of players with a birth year', () => {
    const now = new Date('2026-06-01');
    expect(averageAge([pl('a', 'FW', 1996), pl('b', 'DF', 1990), pl('c', 'MF')], now)).toBe(33);
    expect(averageAge([pl('c', 'MF')], now)).toBeNull();
  });
});
