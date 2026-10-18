import { useCallback, useEffect, useState } from 'react';
import type { Attend } from '../types';
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

/** Match time in the viewer's locale, e.g. "10월 25일 (토) 오후 2:00". */
export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/** True while a match can still be voted on (until a day after kick-off, as the database enforces). */
export const isOpen = (iso: string) => new Date(iso).getTime() > Date.now() - 24 * 3600 * 1000;
