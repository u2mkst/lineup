import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_FORMATION, formationGroups } from '../data/formations';
import { fetchAttendance, fetchMatches } from '../lib/cloud';
import { rolesFor } from '../lib/layout';
import { formatKickoff } from '../lib/matches';
import { attachTactic } from '../lib/matchLink';
import { pickBest } from '../lib/ratings';
import { useRatings } from '../lib/ratingsStore';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import type { Attend, Match } from '../types';
import { Sheet } from './Sheet';

type Pool = 'all' | 'yes' | 'yesmaybe';

interface Props {
  /** apply to this tactic (its formation stays); otherwise a new tactic is created */
  tacticId?: string;
  /** pre-select this match (and attach the new tactic to it) */
  matchId?: string;
  onRate: () => void;
  onClose: () => void;
  onDone?: (tacticId: string) => void;
}

/** Admin: picks the best eleven from the coach's private ratings, optionally only from those who said they are coming. */
export function QuickPick({ tacticId, matchId, onRate, onClose, onDone }: Props) {
  const roster = useStore(s => s.roster);
  const tactics = useStore(s => s.tactics);
  const { addTactic, setFormation, applyPicks, edit } = useStore.getState();
  const { data: ratings, loaded, load } = useRatings();
  const base = tacticId ? tactics.find(t => t.id === tacticId) : undefined;

  const [formation, setFormationState] = useState(base?.us.formation ?? DEFAULT_FORMATION);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState(matchId ?? base?.matchId ?? '');
  const [votes, setVotes] = useState<Record<string, Attend>>({});
  const [pool, setPool] = useState<Pool>('all');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => { load().catch(e => toast((e as Error).message, 'error')); }, [load]);
  useEffect(() => {
    let live = true;
    fetchMatches().then(all => {
      if (!live) return;
      const list = all.filter(m => m.kind === 'match' && m.status === 'scheduled').sort((a, b) => a.kickoff.localeCompare(b.kickoff));
      const now = Date.now();
      setMatches(list.filter(m => new Date(m.kickoff).getTime() > now - 6 * 3600e3));
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!selected) { setVotes({}); return; }
    let live = true;
    fetchAttendance(selected).then(v => live && setVotes(v)).catch(() => live && setVotes({}));
    return () => { live = false; };
  }, [selected]);
  // choosing a match is usually about who is coming
  useEffect(() => { if (selected && pool === 'all') setPool('yes'); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const roles = rolesFor(formation);
  const poolIds = useMemo(() => {
    if (pool === 'all' || !selected) return undefined;
    return new Set(roster.filter(p => votes[p.id] === 'yes' || (pool === 'yesmaybe' && votes[p.id] === 'maybe')).map(p => p.id));
  }, [pool, selected, votes, roster]);
  const result = useMemo(() => pickBest(roster, ratings, roles, { pool: poolIds, exclude: excluded }), [roster, ratings, roles, poolIds, excluded]);
  const name = (id: string | null) => { const p = roster.find(x => x.id === id); return p ? `${p.number} ${p.name}` : '비어 있음'; };
  const filled = result.picks.filter(x => x.playerId).length;
  const ratedCount = roster.filter(p => ratings[p.id]).length;
  const match = matches.find(m => m.id === selected);

  const apply = async () => {
    const ids = result.picks.map(x => x.playerId);
    setBusy(true);
    try {
      if (tacticId) {
        applyPicks(tacticId, ids);
        toast('빠른 선발을 적용했어요');
        onDone?.(tacticId);
      } else {
        const id = addTactic();
        setFormation(id, 'us', formation);
        applyPicks(id, ids);
        edit(id, t => { t.name = (match ? `${match.title} 선발` : '빠른 선발').slice(0, 24); });
        const made = useStore.getState().tactics.find(t => t.id === id);
        if (match && made) await attachTactic(made, match.id).catch(e => toast(`경기 연결은 못 했어요: ${(e as Error).message}`, 'error'));
        toast('선발 라인업을 만들었어요');
        onDone?.(id);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="빠른 선발" onClose={onClose}>
      <p className="hint">🔒 감독이 매긴 비공개 능력치로 최적의 11명을 골라요. 점수는 이 화면에서만 보이고, 적용되는 건 선수 배치뿐이에요.</p>

      {loaded && ratedCount === 0 && (
        <div className="notice"><div><strong>아직 평가한 선수가 없어요</strong><p>모두 평범(5점)으로 계산돼서 포지션만 맞춰 뽑아요.</p></div><button className="btn sm primary" onClick={onRate}>능력치 평가</button></div>
      )}

      <div className="field-row">
        {!tacticId && (
          <label className="field"><span>포메이션</span>
            <select value={formation} onChange={e => { setFormationState(e.target.value); setExcluded(new Set()); }}>
              {formationGroups.map(g => <optgroup key={g.label} label={g.label}>{g.items.map(f => <option key={f}>{f}</option>)}</optgroup>)}
            </select></label>
        )}
        <label className="field"><span>어느 경기?</span>
          <select value={selected} onChange={e => { setSelected(e.target.value); if (!e.target.value) setPool('all'); }} aria-label="경기 선택">
            <option value="">선택 안 함 (전체 선수)</option>
            {matches.map(m => <option key={m.id} value={m.id}>{m.title} · {formatKickoff(m.kickoff)}</option>)}
          </select></label>
      </div>

      {selected && (
        <div className="chips" role="radiogroup" aria-label="뽑을 대상">
          {([['yes', '참석자만'], ['yesmaybe', '참석 + 미정'], ['all', '전체 선수']] as [Pool, string][]).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={pool === id} className={`chip${pool === id ? ' on' : ''}`} onClick={() => setPool(id)}>{label}</button>
          ))}
        </div>
      )}
      {poolIds && <p className="muted small">대상 {poolIds.size}명{poolIds.size < roles.length ? ' · 11명이 안 돼서 빈 자리가 있어요' : ''}</p>}

      <div className="pick-head"><strong>추천 선발</strong><span className="strength" aria-label="팀 전력">전력 {result.strength}</span></div>
      <ol className="pick-list">
        {result.picks.map((x, i) => (
          <li key={i} className={x.playerId ? '' : 'vacant'}>
            <em className="role">{x.role}</em>
            <span className="pname">{name(x.playerId)}{x.playerId && result.unrated.includes(x.playerId) && <small className="muted"> 미평가</small>}</span>
            <span className="bar" aria-hidden><i style={{ width: `${x.score}%` }} /></span>
            <b>{x.playerId ? x.score : '-'}</b>
            {x.playerId && <button type="button" className="icon-btn" aria-label={`${name(x.playerId)} 빼기`} onClick={() => setExcluded(s => new Set(s).add(x.playerId!))}>✕</button>}
          </li>
        ))}
      </ol>
      {excluded.size > 0 && <button className="btn ghost sm" onClick={() => setExcluded(new Set())}>뺀 선수 {excluded.size}명 되돌리기</button>}
      <p className="hint">마음에 안 드는 선수는 ✕로 빼면 나머지로 다시 계산해요. 적용한 뒤에도 자유롭게 바꿀 수 있어요.</p>

      <button className="btn primary lg block" disabled={busy || filled === 0} onClick={() => void apply()}>
        {tacticId ? `이 선발로 적용 (${filled}명)` : '이 선발로 라인업 만들기'}
      </button>
    </Sheet>
  );
}
