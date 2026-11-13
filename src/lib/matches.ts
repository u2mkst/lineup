import { useCallback, useEffect, useState } from 'react';
import type { Attend, EventKind, Match } from '../types';
import { fetchAttendance } from './cloud';
import { cloudEnabled } from './supabase';

/** Votes for one match; empty (and never fetched) when the tactic is not tied to a match. */
export function useAttendance(matchId: string | undefined) {
  const [votes, setVotes] = useState<Record<string, Attend>>({});
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!matchId || !cloudEnabled) { setVotes({}); return; }
    setLoading(true);
    try { setVotes(await fetchAttendance(matchId)); } catch { /* keep what we had */ } finally { setLoading(false); }
  }, [matchId]);
  useEffect(() => { void reload(); }, [reload]);
  return { votes, loading, reload, setVotes };
}

export const ATTEND_LABEL: Record<Attend, string> = { yes: '참석', maybe: '미정', no: '불참' };
export const KIND_LABEL: Record<EventKind, string> = { match: '매치', social: '회식', practice: '연습', other: '기타' };
export const KIND_COLOR: Record<EventKind, string> = { match: '#3350e7', social: '#ff7b2e', practice: '#009632', other: '#7d5ef7' };

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "10월 25일 (토) 오후 2:00" */
export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
/** "2026.05.15(금) 20:00" */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}(${WEEKDAY[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const formatTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** When voting closes: the explicit deadline, otherwise kick-off. */
export const deadlineOf = (m: Match) => m.voteDeadline ?? m.kickoff;

/** True while players can still vote (the database enforces the same rule). */
export const votingOpen = (m: Match, now = Date.now()) => m.status === 'scheduled' && new Date(deadlineOf(m)).getTime() > now;

/** Upcoming = not finished/cancelled and not long past. */
export const isUpcoming = (m: Match, now = Date.now()) => m.status === 'scheduled' && new Date(m.kickoff).getTime() > now - 3 * 3600 * 1000;

/** "D-3", "오늘", "마감" for a vote deadline. */
export function deadlineLabel(m: Match, now = Date.now()): string {
  const ms = new Date(deadlineOf(m)).getTime() - now;
  if (ms <= 0) return '마감';
  const days = Math.floor(ms / 86400e3);
  if (days >= 1) return `마감 D-${days}`;
  const hours = Math.floor(ms / 3600e3);
  return hours >= 1 ? `${hours}시간 뒤 마감` : '곧 마감';
}
