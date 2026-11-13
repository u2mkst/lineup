import { useEffect, useRef, useState } from 'react';
import { ATTRS, blankRating, overall } from '../lib/ratings';
import { useRatings } from '../lib/ratingsStore';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import type { Player, Pos, Rating, RatingKey } from '../types';
import { Sheet } from './Sheet';

const GROUPS: { pos: Pos; label: string }[] = [
  { pos: 'GK', label: '골키퍼' }, { pos: 'DF', label: '수비수' }, { pos: 'MF', label: '미드필더' }, { pos: 'FW', label: '공격수' },
];

/** Admin only: the coach's private 1–10 ratings. Saved a moment after each change. */
export function RatingsSheet({ onClose }: { onClose: () => void }) {
  const roster = useStore(s => s.roster);
  const { data, loaded, load, set, persist } = useRatings();
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const timers = useRef(new Map<string, number>());

  useEffect(() => { load().catch(e => { setFailed(true); toast((e as Error).message, 'error'); }); }, [load]);
  // flush edits that are still waiting for their timer when the sheet closes
  useEffect(() => () => {
    for (const [id, t] of timers.current) { window.clearTimeout(t); void persist(id).catch(() => undefined); }
    timers.current.clear();
  }, [persist]);

  const change = (p: Player, patch: Partial<Rating>) => {
    set(p.id, { ...(useRatings.getState().data[p.id] ?? blankRating()), ...patch });
    window.clearTimeout(timers.current.get(p.id));
    timers.current.set(p.id, window.setTimeout(() => {
      timers.current.delete(p.id);
      persist(p.id).catch(e => toast((e as Error).message, 'error'));
    }, 500));
  };

  const rated = roster.filter(p => data[p.id]).length;

  return (
    <Sheet title="선수 능력치 (비공개)" onClose={onClose}>
      <p className="hint">🔒 감독(관리자)만 볼 수 있어요. 선수들에게는 보이지 않고, 전술이나 공유 링크에도 들어가지 않아요. 빠른 선발이 이 점수로 최적의 11명을 골라요.</p>
      {!loaded && !failed && <p className="muted small" role="status">불러오는 중…</p>}
      {failed && <p className="error" role="alert">능력치를 불러오지 못했어요. 관리자 계정인지 확인해 주세요.</p>}
      {loaded && <p className="muted small">평가한 선수 {rated}/{roster.length}명 · 평가하지 않은 선수는 모든 능력을 5점으로 계산해요</p>}
      {loaded && GROUPS.map(g => {
        const list = roster.filter(p => p.pos === g.pos);
        if (!list.length) return null;
        return (
          <div key={g.pos} className="rate-group">
            <h4>{g.label}</h4>
            {list.map(p => {
              const r = data[p.id];
              const isOpen = open === p.id;
              return (
                <div key={p.id} className="rate-block">
                  <button type="button" className="rate-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                    <b>{p.number}</b><span>{p.name}</span>
                    {r ? <em className="ovr">{overall(p, r)}</em> : <em className="ovr none">미평가</em>}
                  </button>
                  {isOpen && (
                    <div className="rate-edit">
                      {ATTRS.filter(a => p.pos === 'GK' || a.key !== 'keeper').map(a => {
                        const v = (r ?? blankRating())[a.key as RatingKey];
                        return (
                          <label key={a.key} className="rate-slider" title={a.hint}>
                            <span>{a.label}</span>
                            <input type="range" min={1} max={10} step={1} value={v} aria-label={`${p.name} ${a.label}`}
                              onChange={e => change(p, { [a.key]: Number(e.target.value) })} />
                            <b>{v}</b>
                          </label>
                        );
                      })}
                      <input className="text-in" maxLength={200} placeholder="메모 (예: 왼발잡이, 후반 체력 떨어짐)" aria-label={`${p.name} 메모`}
                        defaultValue={r?.memo ?? ''} onBlur={e => { if ((e.target.value.trim()) !== (r?.memo ?? '')) change(p, { memo: e.target.value }); }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </Sheet>
  );
}
