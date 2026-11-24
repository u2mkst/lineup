import type { Attend, Match, Member, Player } from '../types';

export type AdminSection = 'overview' | 'members' | 'players' | 'codes' | 'ratings' | 'events' | 'settings';

export interface Todo {
  id: string;
  text: string;
  count: number;
  section: AdminSection;
}

export interface TodoInput {
  members: Member[];
  roster: Player[];
  matches: Match[];
  /** ids of players that already have a rating (null = not loaded) */
  rated: Set<string> | null;
  /** votes for the next upcoming event (null = none / not loaded) */
  nextVotes: Record<string, Attend> | null;
  /** players who have not signed up yet (null = not loaded) */
  unjoined?: number | null;
  now?: number;
}

/** The first upcoming, not cancelled event. */
export function nextEvent(matches: Match[], now = Date.now()): Match | undefined {
  return matches
    .filter(m => m.status === 'scheduled' && new Date(m.kickoff).getTime() >= now)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
}

/** Matches whose kickoff has passed but whose result was never entered. */
export function needsRecord(matches: Match[], now = Date.now()): Match[] {
  return matches.filter(m => m.kind === 'match' && m.status === 'scheduled' && new Date(m.kickoff).getTime() < now - 2 * 3600e3);
}

/** What the admin should look at next, most important first. Empty when everything is in order. */
export function adminTodos({ members, roster, matches, rated, nextVotes, unjoined = null, now = Date.now() }: TodoInput): Todo[] {
  const todos: Todo[] = [];
  if (roster.length === 0) todos.push({ id: 'no-players', text: '선수를 등록해 주세요', count: 1, section: 'players' });

  const records = needsRecord(matches, now);
  if (records.length) todos.push({ id: 'records', text: '경기가 끝났는데 기록을 입력하지 않은 경기', count: records.length, section: 'events' });

  const upcoming = nextEvent(matches, now);
  if (upcoming && nextVotes) {
    const silent = roster.filter(p => !nextVotes[p.id]).length;
    if (silent > 0) todos.push({ id: 'silent', text: `“${upcoming.title}”에 아직 투표하지 않은 선수`, count: silent, section: 'events' });
  }

  if (unjoined) todos.push({ id: 'unjoined', text: '아직 가입하지 않은 선수 (개인 코드를 보내 주세요)', count: unjoined, section: 'codes' });

  const unlinked = members.filter(m => !m.playerId && m.role !== 'admin').length;
  if (unlinked) todos.push({ id: 'unlinked', text: '선수 프로필이 연결되지 않은 팀원', count: unlinked, section: 'members' });

  if (rated && roster.length) {
    const unrated = roster.filter(p => !rated.has(p.id)).length;
    if (unrated) todos.push({ id: 'unrated', text: '능력치를 평가하지 않은 선수 (빠른 선발에 쓰여요)', count: unrated, section: 'ratings' });
  }
  return todos;
}
