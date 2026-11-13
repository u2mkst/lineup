import { useMemo, useState } from 'react';
import { saveRecord } from '../../lib/cloud';
import { toast } from '../../lib/toast';
import type { Attend, Match, MatchStat, Player, QuarterScore } from '../../types';
import { Sheet } from '../Sheet';
import { Stepper } from '../ui';

interface Props {
  match: Match;
  roster: Player[];
  /** existing per-player numbers when editing */
  stats: MatchStat[];
  /** votes, used to pre-select who played when recording for the first time */
  votes: Record<string, Attend>;
  onSaved: () => void;
  onClose: () => void;
}

interface Row { played: boolean; goals: number; assists: number }

/** Admin: result, quarter scores, Player of the Match and per-player goals / assists. */
export function RecordForm({ match, roster, stats, votes, onSaved, onClose }: Props) {
  const done = match.status === 'finished';
  const [us, setUs] = useState(match.ourScore ?? 0);
  const [opp, setOpp] = useState(match.oppScore ?? 0);
  const [quarters, setQuarters] = useState<QuarterScore[]>(match.quarters);
  const [potm, setPotm] = useState(match.potmPlayerId ?? '');
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const out: Record<string, Row> = {};
    for (const p of roster) {
      const s = stats.find(x => x.playerId === p.id);
      out[p.id] = s ? { played: s.played, goals: s.goals, assists: s.assists } : { played: !done && votes[p.id] === 'yes', goals: 0, assists: 0 };
    }
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (id: string, patch: Partial<Row>) => setRows(r => ({ ...r, [id]: { ...r[id], ...patch } }));
  const goals = Object.values(rows).reduce((a, r) => a + r.goals, 0);
  const qSum = useMemo(() => ({ us: quarters.reduce((a, q) => a + q.us, 0), opp: quarters.reduce((a, q) => a + q.opp, 0) }), [quarters]);
  const mismatch = quarters.length > 0 && (qSum.us !== us || qSum.opp !== opp);
  const played = roster.filter(p => rows[p.id]?.played);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await saveRecord(match.id, {
        ourScore: us, oppScore: opp, quarters, potmPlayerId: potm || null,
        stats: roster.map(p => ({ playerId: p.id, ...rows[p.id] })),
      });
      toast('경기 기록을 저장했어요');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={done ? '경기 기록 수정' : '경기 기록 입력'} onClose={onClose}>
      <div className="record-score">
        <div><small>우리 팀</small><Stepper label="우리 점수" value={us} onChange={setUs} /></div>
        <b>:</b>
        <div><small>{match.opponent || '상대'}</small><Stepper label="상대 점수" value={opp} onChange={setOpp} /></div>
      </div>

      <section className="field-block">
        <div className="field-block-head"><h4>쿼터별 점수</h4>
          <button type="button" className="btn sm ghost" disabled={quarters.length >= 6} onClick={() => setQuarters([...quarters, { us: 0, opp: 0 }])}>＋ 쿼터</button></div>
        {quarters.map((q, i) => (
          <div className="quarter-row" key={i}>
            <span>{i + 1}Q</span>
            <Stepper label={`${i + 1}쿼터 우리`} value={q.us} onChange={v => setQuarters(quarters.map((x, j) => (j === i ? { ...x, us: v } : x)))} />
            <b>:</b>
            <Stepper label={`${i + 1}쿼터 상대`} value={q.opp} onChange={v => setQuarters(quarters.map((x, j) => (j === i ? { ...x, opp: v } : x)))} />
            <button type="button" className="icon-btn" aria-label={`${i + 1}쿼터 삭제`} onClick={() => setQuarters(quarters.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {mismatch && (
          <p className="warn">쿼터 합계({qSum.us}:{qSum.opp})가 최종 점수와 달라요. <button type="button" className="link" onClick={() => { setUs(qSum.us); setOpp(qSum.opp); }}>합계로 맞추기</button></p>
        )}
      </section>

      <section className="field-block">
        <div className="field-block-head"><h4>선수별 기록</h4><span className="muted small">출전 {played.length}명 · 골 {goals}</span></div>
        {goals > us && <p className="warn">선수 골 합계({goals})가 우리 점수({us})보다 많아요.</p>}
        <div className="stat-rows">
          {roster.map(p => {
            const r = rows[p.id];
            return (
              <div key={p.id} className={`stat-row${r.played ? ' on' : ''}`}>
                <label className="stat-name">
                  <input type="checkbox" checked={r.played} onChange={e => set(p.id, { played: e.target.checked })} aria-label={`${p.name} 출전`} />
                  <b>{p.number}</b>{p.name}<small className="muted">{p.pos}</small>
                </label>
                <span className="stat-nums">
                  <small>골</small><Stepper label={`${p.name} 골`} value={r.goals} max={20} onChange={v => set(p.id, { goals: v, played: r.played || v > 0 })} />
                  <small>도움</small><Stepper label={`${p.name} 도움`} value={r.assists} max={20} onChange={v => set(p.id, { assists: v, played: r.played || v > 0 })} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <label className="field"><span>POTM (경기 MVP)</span>
        <select className="text-in" value={potm} onChange={e => setPotm(e.target.value)}>
          <option value="">선택 안 함</option>
          {roster.map(p => <option key={p.id} value={p.id}>{p.number} {p.name}</option>)}
        </select>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary lg block" disabled={busy} onClick={() => void submit()}>{busy ? '저장 중…' : '기록 저장'}</button>
    </Sheet>
  );
}
