import type {
  Attend, EventKind, EventStatus, Match, MatchStat, Member, Player, Pos, Post, PostComment, QuarterScore, Rating, Role, Tactic, TacticComment,
} from '../types';
import { RATING_KEYS } from '../types';
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
  if (code === '28P01') return new Error('코드가 맞지 않아요. 다시 확인해 주세요.');
  if (code === '28000') return new Error('먼저 로그인해 주세요.');
  if (code === '23514' && /last admin/i.test(msg)) return new Error('마지막 관리자는 바꾸거나 내보낼 수 없어요.');
  if (code === '23505' && /taken|already linked/i.test(msg)) return new Error('이미 다른 계정에 연결된 선수이거나, 내 계정에 선수가 연결돼 있어요.');
  if (code === '23505') return new Error('이미 사용 중인 등번호예요. 번호를 서로 바꾸려면 "번호 교체"를 이용해 주세요.');
  if (code === '23514') return new Error('번호는 3자 이내, 이름은 1~8자로 입력해 주세요.');
  if (code === '42501' || /row-level security|admin only/i.test(msg)) return new Error('관리자만 할 수 있어요. 로그인했는지 확인해 주세요.');
  if (code === 'P0002') return new Error('선수를 찾을 수 없어요. 새로고침해 주세요.');
  if (/failed to fetch|network|load failed/i.test(msg)) return new Error('인터넷 연결을 확인해 주세요.');
  return new Error(msg || '서버 요청에 실패했어요');
}

// ───────── roster ─────────
const PLAYER_COLS = 'id, number, name, pos, alt_pos, injured, injury_note, birth_year';
export async function fetchRoster(): Promise<Player[]> {
  const { data, error } = await db().from('players').select(PLAYER_COLS);
  if (error) throw explain(error);
  return sortRoster((data ?? []).flatMap(p => normalizePlayer(p) ?? []));
}

export type PlayerDraft = { number: string; name: string; pos: Pos; altPos?: Pos[]; out?: boolean; note?: string; birthYear?: number | null };

/** App field names -> table columns. */
function toColumns(p: Partial<PlayerDraft>) {
  const c: Record<string, unknown> = {};
  if (p.number !== undefined) c.number = p.number;
  if (p.name !== undefined) c.name = p.name;
  if (p.pos !== undefined) c.pos = p.pos;
  if (p.altPos !== undefined) c.alt_pos = p.altPos;
  if (p.out !== undefined) c.injured = p.out;
  if (p.note !== undefined) c.injury_note = p.note || null;
  if (p.birthYear !== undefined) c.birth_year = p.birthYear;
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

// ───────── matches / events ─────────
interface MatchRow {
  id: string;
  kind: EventKind;
  title: string;
  opponent: string | null;
  kickoff: string;
  venue: string | null;
  notes: string | null;
  tactic_id: string | null;
  status: EventStatus;
  our_score: number | null;
  opp_score: number | null;
  quarters: QuarterScore[] | null;
  potm_player_id: string | null;
  vote_deadline: string | null;
}
const MATCH_COLS = 'id, kind, title, opponent, kickoff, venue, notes, tactic_id, status, our_score, opp_score, quarters, potm_player_id, vote_deadline';
const toMatch = (r: MatchRow): Match => ({
  id: r.id, kind: r.kind, title: r.title, opponent: r.opponent ?? '', kickoff: r.kickoff, venue: r.venue ?? '', notes: r.notes ?? '',
  tacticId: r.tactic_id, status: r.status, ourScore: r.our_score, oppScore: r.opp_score,
  quarters: Array.isArray(r.quarters) ? r.quarters.map(q => ({ us: Number(q.us) || 0, opp: Number(q.opp) || 0 })) : [],
  potmPlayerId: r.potm_player_id, voteDeadline: r.vote_deadline,
});

export async function fetchMatches(): Promise<Match[]> {
  const { data, error } = await db().from('matches').select(MATCH_COLS).order('kickoff', { ascending: false }).limit(500);
  if (error) throw explain(error);
  return (data as MatchRow[]).map(toMatch);
}

export async function fetchMatch(id: string): Promise<Match | null> {
  const { data, error } = await db().from('matches').select(MATCH_COLS).eq('id', id).maybeSingle();
  if (error) throw explain(error);
  return data ? toMatch(data as MatchRow) : null;
}

export interface MatchDraft {
  id?: string;
  kind: EventKind;
  title: string;
  opponent: string;
  kickoff: string;
  venue: string;
  notes: string;
  voteDeadline: string | null;
  status?: EventStatus;
}

export async function saveMatch(m: MatchDraft): Promise<Match> {
  const row = {
    kind: m.kind, title: m.title.trim(), opponent: m.opponent.trim() || null, kickoff: m.kickoff, venue: m.venue.trim() || null,
    notes: m.notes.trim() || null, vote_deadline: m.voteDeadline, ...(m.status ? { status: m.status } : {}),
  };
  const q = m.id ? db().from('matches').update(row).eq('id', m.id) : db().from('matches').insert(row);
  const { data, error } = await q.select(MATCH_COLS).single();
  if (error) throw explain(error);
  return toMatch(data as MatchRow);
}

export async function deleteMatch(id: string): Promise<void> {
  const { error } = await db().from('matches').delete().eq('id', id);
  if (error) throw explain(error);
}

/** Point a match at a (shared) tactic, or detach it with `null`. */
export async function linkTactic(matchId: string, tacticId: string | null): Promise<void> {
  const { data, error } = await db().from('matches').update({ tactic_id: tacticId }).eq('id', matchId).select('id');
  if (error) throw explain(error);
  if (!data?.length) throw explain({ code: '42501' });
}

// ───────── match records ─────────
export interface RecordDraft {
  ourScore: number;
  oppScore: number;
  quarters: QuarterScore[];
  potmPlayerId: string | null;
  stats: { playerId: string; played: boolean; goals: number; assists: number }[];
}

/** Stores a result and the per-player numbers; the match becomes "finished". */
export async function saveRecord(matchId: string, r: RecordDraft): Promise<void> {
  const { error } = await db().from('matches').update({
    status: 'finished', our_score: r.ourScore, opp_score: r.oppScore, quarters: r.quarters, potm_player_id: r.potmPlayerId,
  }).eq('id', matchId);
  if (error) throw explain(error);
  const del = await db().from('match_stats').delete().eq('match_id', matchId);
  if (del.error) throw explain(del.error);
  const rows = r.stats.filter(x => x.played || x.goals || x.assists).map(x => ({
    match_id: matchId, player_id: x.playerId, played: x.played || x.goals > 0 || x.assists > 0, goals: x.goals, assists: x.assists,
  }));
  if (rows.length) {
    const ins = await db().from('match_stats').insert(rows);
    if (ins.error) throw explain(ins.error);
  }
}

export async function fetchStats(): Promise<MatchStat[]> {
  const { data, error } = await db().from('match_stats').select('match_id, player_id, played, goals, assists').limit(10000);
  if (error) throw explain(error);
  return (data ?? []).map(r => ({ matchId: r.match_id as string, playerId: r.player_id as string, played: !!r.played, goals: Number(r.goals), assists: Number(r.assists) }));
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
    // The policy only lets a player vote for himself, and only before the deadline.
    if (error.code === '42501') throw new Error('투표가 마감됐거나, 내 선수 프로필이 연결되지 않았어요.');
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
  const { error } = await db().from('tactic_comments').insert({ tactic_id: tacticId, player_id: playerId || null, author, kind: 'comment', body: body.trim() });
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

// ───────── team, members ─────────
export async function fetchTeamName(): Promise<string> {
  const { data, error } = await db().from('team').select('name').maybeSingle();
  if (error) throw explain(error);
  return data?.name ?? '우리 팀';
}

export async function renameTeam(name: string): Promise<void> {
  const { data, error } = await db().from('team').update({ name: name.trim() }).eq('singleton', true).select('name');
  if (error) throw explain(error);
  if (!data?.length) throw explain({ code: '42501' });
}

export async function fetchJoinCode(): Promise<string> {
  const { data, error } = await db().from('team_secret').select('join_code').maybeSingle();
  if (error) throw explain(error);
  return data?.join_code ?? '';
}

export async function regenerateJoinCode(): Promise<string> {
  const { data, error } = await db().rpc('regenerate_join_code');
  if (error) throw explain(error);
  return data as string;
}

export async function joinTeam(code: string): Promise<Role> {
  const { data, error } = await db().rpc('join_team', { code });
  if (error) throw explain(error);
  return data as Role;
}

export async function claimAdmin(code: string): Promise<Role> {
  const { data, error } = await db().rpc('claim_admin', { code });
  if (error) throw explain(error);
  return data as Role;
}

interface MemberRow { user_id: string; role: Role; player_id: string | null; nickname: string | null }
const toMember = (r: MemberRow): Member => ({ userId: r.user_id, role: r.role, playerId: r.player_id, nickname: r.nickname ?? '' });
const MEMBER_COLS = 'user_id, role, player_id, nickname';

export async function fetchMyMember(userId: string): Promise<Member | null> {
  const { data, error } = await db().from('members').select(MEMBER_COLS).eq('user_id', userId).maybeSingle();
  if (error) throw explain(error);
  return data ? toMember(data as MemberRow) : null;
}

export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await db().from('members').select(MEMBER_COLS).order('joined_at', { ascending: true });
  if (error) throw explain(error);
  return (data as MemberRow[]).map(toMember);
}

export async function setMemberRole(userId: string, role: Role): Promise<void> {
  const { data, error } = await db().from('members').update({ role }).eq('user_id', userId).select('user_id');
  if (error) throw explain(error);
  if (!data?.length) throw explain({ code: '42501' });
}

/** Admin: attach (or detach with `null`) a player profile to any member. */
export async function setMemberPlayer(userId: string, playerId: string | null): Promise<void> {
  const { data, error } = await db().from('members').update({ player_id: playerId }).eq('user_id', userId).select('user_id');
  if (error) throw explain(error);
  if (!data?.length) throw explain({ code: '42501' });
}

export async function removeMember(userId: string): Promise<void> {
  const { error } = await db().from('members').delete().eq('user_id', userId);
  if (error) throw explain(error);
}

export async function linkMyPlayer(playerId: string): Promise<void> {
  const { error } = await db().rpc('link_my_player', { pid: playerId });
  if (error) throw explain(error);
}

export async function setMyNickname(n: string): Promise<void> {
  const { error } = await db().rpc('set_nickname', { n });
  if (error) throw explain(error);
}

// ───────── board ─────────
interface PostRow { id: string; author_id: string; author_name: string; title: string; body: string; pinned: boolean; created_at: string; post_comments?: { count: number }[] }
const toPost = (r: PostRow): Post => ({
  id: r.id, authorId: r.author_id, authorName: r.author_name, title: r.title, body: r.body, pinned: r.pinned, createdAt: r.created_at,
  commentCount: r.post_comments?.[0]?.count ?? 0,
});
const POST_COLS = 'id, author_id, author_name, title, body, pinned, created_at, post_comments(count)';

export async function fetchPosts(): Promise<Post[]> {
  const { data, error } = await db().from('posts').select(POST_COLS).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (error) throw explain(error);
  return (data as unknown as PostRow[]).map(toPost);
}

export async function fetchPost(id: string): Promise<Post | null> {
  const { data, error } = await db().from('posts').select(POST_COLS).eq('id', id).maybeSingle();
  if (error) throw explain(error);
  return data ? toPost(data as unknown as PostRow) : null;
}

export async function savePost(p: { id?: string; authorName: string; title: string; body: string; pinned?: boolean }): Promise<Post> {
  const row = { title: p.title.trim(), body: p.body.trim(), ...(p.pinned !== undefined ? { pinned: p.pinned } : {}), ...(p.id ? {} : { author_name: p.authorName }) };
  const q = p.id ? db().from('posts').update(row).eq('id', p.id) : db().from('posts').insert(row);
  const { data, error } = await q.select(POST_COLS).single();
  if (error) throw explain(error);
  return toPost(data as unknown as PostRow);
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await db().from('posts').delete().eq('id', id);
  if (error) throw explain(error);
}

interface PcRow { id: string; post_id: string; author_id: string; author_name: string; body: string; created_at: string }
export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await db().from('post_comments').select('id, post_id, author_id, author_name, body, created_at').eq('post_id', postId).order('created_at', { ascending: true }).limit(300);
  if (error) throw explain(error);
  return (data as PcRow[]).map(r => ({ id: r.id, postId: r.post_id, authorId: r.author_id, authorName: r.author_name, body: r.body, createdAt: r.created_at }));
}

export async function addPostComment(postId: string, authorName: string, body: string): Promise<void> {
  const { error } = await db().from('post_comments').insert({ post_id: postId, author_name: authorName, body: body.trim() });
  if (error) throw explain(error);
}

export async function deletePostComment(id: string): Promise<void> {
  const { error } = await db().from('post_comments').delete().eq('id', id);
  if (error) throw explain(error);
}

// ───────── 감독 비밀 능력치 (관리자만; 서버 RLS가 막아요) ─────────

const RATING_COLS = 'player_id, shooting, passing, dribbling, defending, pace, stamina, physical, keeper, memo';

export async function fetchRatings(): Promise<Record<string, Rating>> {
  const { data, error } = await db().from('player_ratings').select(RATING_COLS);
  if (error) throw explain(error);
  const out: Record<string, Rating> = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const rating = Object.fromEntries(RATING_KEYS.map(k => [k, Number(r[k])])) as unknown as Rating;
    if (typeof r.memo === 'string' && r.memo) rating.memo = r.memo;
    out[r.player_id as string] = rating;
  }
  return out;
}

export async function saveRating(playerId: string, r: Rating): Promise<void> {
  const row = { player_id: playerId, ...Object.fromEntries(RATING_KEYS.map(k => [k, Math.min(10, Math.max(1, Math.round(r[k])))])), memo: r.memo?.trim() || null, updated_at: new Date().toISOString() };
  const { error } = await db().from('player_ratings').upsert(row, { onConflict: 'player_id' });
  if (error) throw explain(error);
}
