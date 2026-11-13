import { useState } from 'react';
import { deleteMatch, saveMatch } from '../../lib/cloud';
import { KIND_LABEL } from '../../lib/matches';
import { toast } from '../../lib/toast';
import type { EventKind, Match } from '../../types';
import { Sheet } from '../Sheet';

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO -> value for <input type="datetime-local"> in the viewer's time zone. */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const nextSaturday = (hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(hour, 0, 0, 0);
  return toLocalInput(d.toISOString());
};

interface Props {
  match?: Match;
  /** pre-selected day (YYYY-MM-DD) when created from the calendar */
  day?: string;
  onSaved: (m: Match) => void;
  onDeleted?: () => void;
  onClose: () => void;
}

/** Admin: create or edit a calendar entry. */
export function EventForm({ match, day, onSaved, onDeleted, onClose }: Props) {
  const [kind, setKind] = useState<EventKind>(match?.kind ?? 'match');
  const [title, setTitle] = useState(match?.title ?? '');
  const [opponent, setOpponent] = useState(match?.opponent ?? '');
  const [when, setWhen] = useState(match ? toLocalInput(match.kickoff) : day ? `${day}T20:00` : nextSaturday(20));
  const [deadline, setDeadline] = useState(match?.voteDeadline ? toLocalInput(match.voteDeadline) : '');
  const [venue, setVenue] = useState(match?.venue ?? '');
  const [notes, setNotes] = useState(match?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kickoff = new Date(when);
    const closes = deadline ? new Date(deadline) : null;
    const name = title.trim() || (kind === 'match' && opponent.trim() ? `vs ${opponent.trim()}` : '');
    if (!name) { setError('일정 이름을 입력해 주세요.'); return; }
    if (Number.isNaN(kickoff.getTime())) { setError('일시를 입력해 주세요.'); return; }
    if (closes && (Number.isNaN(closes.getTime()) || closes.getTime() > kickoff.getTime())) { setError('투표 마감은 시작 시간보다 앞이어야 해요.'); return; }
    setBusy(true); setError('');
    try {
      const saved = await saveMatch({
        id: match?.id, kind, title: name, opponent: kind === 'match' ? opponent : '', kickoff: kickoff.toISOString(),
        voteDeadline: closes ? closes.toISOString() : null, venue, notes,
      });
      toast(match ? '일정을 수정했어요' : '일정을 등록했어요');
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!match || !confirm(`"${match.title}" 일정을 삭제할까요? 참석 투표와 경기 기록도 함께 지워져요.`)) return;
    setBusy(true);
    try { await deleteMatch(match.id); toast('일정을 삭제했어요'); onDeleted?.(); } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <Sheet title={match ? '일정 수정' : '일정 등록'} onClose={onClose}>
      <form className="form-col" onSubmit={submit}>
        <div className="chips" role="radiogroup" aria-label="종류">
          {(Object.keys(KIND_LABEL) as EventKind[]).map(k => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <label className="field"><span>일정 이름</span>
          <input value={title} maxLength={40} placeholder={kind === 'match' ? '예) 10월 정기전 (비우면 "vs 상대팀")' : '예) 시즌 마감 회식'} onChange={e => setTitle(e.target.value)} /></label>
        {kind === 'match' && (
          <label className="field"><span>상대팀</span>
            <input value={opponent} maxLength={30} onChange={e => setOpponent(e.target.value)} /></label>
        )}
        <label className="field"><span>시작 일시</span>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required /></label>
        <label className="field"><span>투표 마감 (비우면 시작 시간)</span>
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
        <label className="field"><span>장소</span>
          <input value={venue} maxLength={60} onChange={e => setVenue(e.target.value)} /></label>
        <label className="field"><span>메모</span>
          <textarea className="text-in" rows={3} maxLength={300} value={notes} placeholder="집합 시간, 유니폼, 준비물 등" onChange={e => setNotes(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary lg block" type="submit" disabled={busy}>{busy ? '저장 중…' : match ? '저장' : '등록'}</button>
        {match && <button className="btn ghost danger block" type="button" disabled={busy} onClick={() => void remove()}>일정 삭제</button>}
      </form>
    </Sheet>
  );
}
