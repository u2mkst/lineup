import type { Player, Pos, Tactic } from '../types';
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
export async function fetchRoster(): Promise<Player[]> {
  const { data, error } = await db().from('players').select('id, number, name, pos');
  if (error) throw explain(error);
  return sortRoster((data ?? []).flatMap(p => normalizePlayer(p) ?? []));
}

export type PlayerDraft = { number: string; name: string; pos: Pos };

export async function addPlayerRemote(p: PlayerDraft): Promise<Player> {
  const { data, error } = await db().from('players').insert(p).select('id, number, name, pos').single();
  if (error) throw explain(error);
  return normalizePlayer(data)!;
}

export async function updatePlayerRemote(id: string, patch: Partial<PlayerDraft>): Promise<void> {
  const { data, error } = await db().from('players').update(patch).eq('id', id).select('id');
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
