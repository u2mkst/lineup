import type { Attend, Match, Player, Pos, Tactic, TacticComment } from '../types';
import { sortRoster } from './roster';
import { supabase } from './supabase';
import { normalizePlayer, normalizeTactic } from './validate';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

const db = () => {
  if (!supabase) throw new Error('서버가 연결되어 있지 않아요');
  return supabase;
};

/** Turns Postgres/PostgREST errors into messages a coach can act on. */
export function explain(e: { code?: string; message?: string } | null | undefined): Error {
  const code = e?.code;
  const msg = e?.message ?? '';
  if (code === '23505') return new Error('이미 사용 중인 등번호예요. 번호를 서로 바꾸려면 "번호 교체"를 이용해 주세요.');
  if (code === '23514') return new Error('번호는 3자 이내, 이름은 1~8자로 입력해 주세요.');
  if (code === '42501' || /row-level security|admin only/i.test(msg)) return new Error('관리자만 할 수 있어요. 로그인했는지 확인해 주세요.');
  if (code === 'P0002') return new Error('선수를 찾을 수 없어요. 새로고침해 주세요.');
  if (/failed to fetch|network|load failed/i.test(msg)) return new Error('인터넷 연결을 확인해 주세요.');
  return new Error(msg || '서버 요청에 실패했어요');
}

// ───────── roster ─────────
const PLAYER_COLS = 'id, number, name, pos, alt_pos, injured, injury_note';
export async function fetchRoster(): Promise<Player[]> {
  const { data, error } = await db().from('players').select(PLAYER_COLS);
  if (error) throw explain(error);
  return sortRoster((data ?? []).flatMap(p => normalizePlayer(p) ?? []));
}

export type PlayerDraft = { number: string; name: string; pos: Pos; altPos?: Pos[]; out?: boolean; note?: string };

/** App field names -> table columns. */
function toColumns(p: Partial<PlayerDraft>) {
  const c: Record<string, unknown> = {};
  if (p.number !== undefined) c.number = p.number;
  if (p.name !== undefined) c.name = p.name;
  if (p.pos !== undefined) c.pos = p.pos;
  if (p.altPos !== undefined) c.alt_pos = p.altPos;
  if (p.out !== undefined) c.injured = p.out;
  if (p.note !== undefined) c.injury_note = p.note || null;
  return c;
}

export async function addPlayerRemote(p: PlayerDraft): Promise<Player> {
  const { data, error } = await db().from('players').insert(toColumns(p)).select(PLAYER_COLS).single();
  if (error) throw explain(error);
  return normalizePlayer(data)!;
}

export async function updatePlayerRemote(id: string, patch: Partial<PlayerDraft>): Promise<void> {
  const { data, error } = await db().from('players').update(toColumns(patch)).eq('id', id).select('id');
  if (error) throw explain(error);
  if (!data || data.length === 0) throw explain({ code: '42501' }); // RLS silently filters rows you may not touch
}

export async function deletePlayerRemote(id: string): Promise<void> {
  const { data, error } = await db().from('players').delete().eq('id', id).select('id');
  if (error) throw explain(error);
  if (!data || data.length === 0) throw explain({ code: '42501' });
}

export async function swapNumbersRemote(a: string, b: string): Promise<void> {
  const { error } = await db().rpc('swap_player_numbers', { a, b });
  if (error) throw explain(error);
}

// ───────── tactics ─────────
interface Row {
  id: string;
  name: string;
  data: unknown;
  is_public: boolean;
}

function fromRow(r: Row): Tactic | null {
  const t = normalizeTactic({ ...(r.data as object), id: r.id });
  return t ? { ...t, id: r.id, name: r.name || t.name, isPublic: r.is_public } : null;
}

const COLS = 'id, name, data, is_public';

export async function fetchMyTactics(userId: string): Promise<Tactic[]> {
  const { data, error } = await db().from('tactics').select(COLS).eq('owner_id', userId);
  if (error) throw explain(error);
  return (data as Row[]).flatMap(r => fromRow(r) ?? []);
}

export async function fetchPublicTactics(): Promise<Tactic[]> {
  const { data, error } = await db().from('tactics').select(COLS).eq('is_public', true).order('updated_at', { ascending: false }).limit(50);
  if (error) throw explain(error);
  return (data as Row[]).flatMap(r => fromRow(r) ?? []);
}

export async function fetchPublicTactic(id: string): Promise<Tactic | null> {
  const { data, error } = await db().from('tactics').select(COLS).eq('id', id).eq('is_public', true).maybeSingle();
  if (error) throw explain(error);
  return data ? fromRow(data as Row) : null;
}

export async function upsertTactic(t: Tactic): Promise<void> {
  const { isPublic, ...data } = t;
  const { error } = await db().from('tactics').upsert({ id: t.id, name: t.name, data, is_public: !!isPublic }, { onConflict: 'id' });
  if (error) throw explain(error);
}

export async function deleteTacticRemote(id: string): Promise<void> {
  const { error } = await db().from('tactics').delete().eq('id', id);
  if (error) throw explain(error);
}

// ───────── matches ─────────
interface MatchRow {
  id: string;
  title: string;
  opponent: string | null;
  kickoff: string;
  venue: string | null;
  notes: string | null;
  tactic_id: string | null;
}
const MATCH_COLS = 'id, title, opponent, kickoff, venue, notes, tactic_id';
const toMatch = (r: MatchRow): Match => ({
  id: r.id, title: r.title, opponent: r.opponent ?? '', kickoff: r.kickoff, venue: r.venue ?? '', notes: r.notes ?? '', tacticId: r.tactic_id,
});

export async function fetchMatches(): Promise<Match[]> {
  const { data, error } = await db().from('matches').select(MATCH_COLS).order('kickoff', { ascending: false }).limit(100);
  if (error) throw explain(error);
  return (data as MatchRow[]).map(toMatch);
}

export async function fetchMatch(id: string): Promise<Match | null> {
  const { data, error } = await db().from('matches').select(MATCH_COLS).eq('id', id).maybeSingle();
  if (error) throw explain(error);
  return data ? toMatch(data as MatchRow) : null;
}

export type MatchDraft = Omit<Match, 'id' | 'tacticId'> & { id?: string };

export async function saveMatch(m: MatchDraft): Promise<Match> {
  const row = { title: m.title.trim(), opponent: m.opponent.trim() || null, kickoff: m.kickoff, venue: m.venue.trim() || null, notes: m.notes.trim() || null };
  const q = m.id ? db().from('matches').update(row).eq('id', m.id) : db().from('matches').insert(row);
  const { data, error } = await q.select(MATCH_COLS).single();
  if (error) throw explain(error);
  return toMatch(data as MatchRow);
}

export async function deleteMatch(id: string): Promise<void> {
  const { error } = await db().from('matches').delete().eq('id', id);
  if (error) throw explain(error);
}

/** Point a match at a (public) tactic, or detach it with `null`. */
export async function linkTactic(matchId: string, tacticId: string | null): Promise<void> {
  const { data, error } = await db().from('matches').update({ tactic_id: tacticId }).eq('id', matchId).select('id');
  if (error) throw explain(error);
  if (!data?.length) throw explain({ code: '42501' });
}

// ───────── attendance ─────────
/** How many players said "참석" for each match. */
export async function fetchVoteCounts(matchIds: string[]): Promise<Record<string, number>> {
  if (matchIds.length === 0) return {};
  const { data, error } = await db().from('attendance').select('match_id').in('match_id', matchIds).eq('status', 'yes');
  if (error) throw explain(error);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.match_id as string] = (out[r.match_id as string] ?? 0) + 1;
  return out;
}

export async function fetchAttendance(matchId: string): Promise<Record<string, Attend>> {
  const { data, error } = await db().from('attendance').select('player_id, status').eq('match_id', matchId);
  if (error) throw explain(error);
  return Object.fromEntries((data ?? []).map(r => [r.player_id as string, r.status as Attend]));
}

export async function setAttendance(matchId: string, playerId: string, status: Attend): Promise<void> {
  const { error } = await db().from('attendance').upsert({ match_id: matchId, player_id: playerId, status }, { onConflict: 'match_id,player_id' });
  if (error) {
    // The policy only lets votes through until a day after kick-off.
    if (error.code === '42501') throw new Error('이미 지난 경기라서 참석 여부를 바꿀 수 없어요.');
    throw explain(error);
  }
}

// ───────── comments ─────────
interface CommentRow {
  id: string;
  tactic_id: string;
  player_id: string | null;
  author: string | null;
  kind: 'comment' | 'ack';
  body: string;
  created_at: string;
}
const COMMENT_COLS = 'id, tactic_id, player_id, author, kind, body, created_at';
const toComment = (r: CommentRow): TacticComment => ({
  id: r.id, tacticId: r.tactic_id, playerId: r.player_id, author: r.author ?? '', kind: r.kind, body: r.body, createdAt: r.created_at,
});

export async function fetchComments(tacticId: string): Promise<TacticComment[]> {
  const { data, error } = await db().from('tactic_comments').select(COMMENT_COLS).eq('tactic_id', tacticId).order('created_at', { ascending: true }).limit(200);
  if (error) throw explain(error);
  return (data as CommentRow[]).map(toComment);
}

export async function addComment(tacticId: string, playerId: string, author: string, body: string): Promise<void> {
  const { error } = await db().from('tactic_comments').insert({ tactic_id: tacticId, player_id: playerId, author, kind: 'comment', body: body.trim() });
  if (error) throw explain(error);
}

export async function setAck(tacticId: string, playerId: string, author: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await db().from('tactic_comments').insert({ tactic_id: tacticId, player_id: playerId, author, kind: 'ack', body: '' });
    if (error && error.code !== '23505') throw explain(error); // already confirmed
  } else {
    const { error } = await db().from('tactic_comments').delete().eq('tactic_id', tacticId).eq('player_id', playerId).eq('kind', 'ack');
    if (error) throw explain(error);
  }
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await db().from('tactic_comments').delete().eq('id', id);
  if (error) throw explain(error);
}
