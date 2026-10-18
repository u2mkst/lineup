import { useState } from 'react';
import { deleteMatch, saveMatch } from '../lib/cloud';
import { toast } from '../lib/toast';
import type { Match } from '../types';
import { Sheet } from './Sheet';

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO -> value for <input type="datetime-local"> in the viewer's time zone. */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const defaultKickoff = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); // next Saturday
  d.setHours(14, 0, 0, 0);
  return toLocalInput(d.toISOString());
};

interface Props {
  match?: Match;
  onSaved: (m: Match) => void;
  onDeleted?: () => void;
  onClose: () => void;
}

/** Admin: create or edit a match. */
export function MatchForm({ match, onSaved, onDeleted, onClose }: Props) {
  const [title, setTitle] = useState(match?.title ?? '');
  const [opponent, setOpponent] = useState(match?.opponent ?? '');
  const [when, setWhen] = useState(match ? toLocalInput(match.kickoff) : defaultKickoff());
  const [venue, setVenue] = useState(match?.venue ?? '');
  const [notes, setNotes] = useState(match?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kickoff = new Date(when);
    if (!title.trim()) { setError('경기 이름을 입력해 주세요.'); return; }
    if (Number.isNaN(kickoff.getTime())) { setError('일시를 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try {
      const saved = await saveMatch({ id: match?.id, title, opponent, kickoff: kickoff.toISOString(), venue, notes });
      toast(match ? '경기를 수정했어요' : '경기를 등록했어요');
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!match || !confirm(`"${match.title}" 경기를 삭제할까요? 참석 투표도 함께 지워져요.`)) return;
    setBusy(true);
    try { await deleteMatch(match.id); toast('경기를 삭제했어요'); onDeleted?.(); } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <Sheet title={match ? '경기 수정' : '경기 등록'} onClose={onClose}>
      <form className="form-col" onSubmit={submit}>
        <label className="field"><span>경기 이름</span>
          <input value={title} maxLength={40} placeholder="예) 10월 정기전" onChange={e => setTitle(e.target.value)} required /></label>
        <label className="field"><span>상대팀 (선택)</span>
          <input value={opponent} maxLength={30} onChange={e => setOpponent(e.target.value)} /></label>
        <label className="field"><span>킥오프 일시</span>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required /></label>
        <label className="field"><span>장소 (선택)</span>
          <input value={venue} maxLength={60} onChange={e => setVenue(e.target.value)} /></label>
        <label className="field"><span>메모 (선택)</span>
          <textarea className="text-in" rows={3} maxLength={300} value={notes} placeholder="집합 시간, 유니폼, 준비물 등" onChange={e => setNotes(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary lg" type="submit" disabled={busy}>{busy ? '저장 중…' : match ? '저장' : '등록'}</button>
        {match && <button className="btn ghost danger" type="button" disabled={busy} onClick={() => void remove()}>경기 삭제</button>}
      </form>
    </Sheet>
  );
}
