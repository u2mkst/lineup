import { useMemo, useState } from 'react';
import { ATTEND_LABEL } from '../lib/matches';
import type { Attend, Player, Pos } from '../types';
import { Sheet } from './Sheet';

type Filter = '전체' | Pos | '참석';
const POS_FILTERS: Pos[] = ['GK', 'DF', 'MF', 'FW'];

interface Props {
  role: string;
  title?: string;
  roster: Player[];
  /** player id -> role currently occupying */
  taken: Record<string, string>;
  current: string | null;
  /** votes for the match this line-up is for */
  attendance?: Record<string, Attend>;
  emptyLabel?: string;
  onPick: (playerId: string | null) => void;
  onClose: () => void;
}

export function PlayerPicker({ role, title, roster, taken, current, attendance, emptyLabel = '이 자리 비우기', onPick, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>(attendance && Object.values(attendance).includes('yes') ? '참석' : '전체');
  const [q, setQ] = useState('');
  const list = useMemo(
    () => roster.filter(p => {
      if (filter === '참석' && attendance?.[p.id] !== 'yes') return false;
      if (filter !== '전체' && filter !== '참석' && p.pos !== filter && !p.altPos?.includes(filter)) return false;
      return !q.trim() || p.name.includes(q.trim()) || p.number === q.trim();
    }),
    [roster, filter, q, attendance],
  );
  const filters: Filter[] = ['전체', ...(attendance ? (['참석'] as const) : []), ...POS_FILTERS];

  return (
    <Sheet title={title ?? `${role} 선수 선택`} onClose={onClose}>
      <input className="search-in" placeholder="이름이나 번호로 찾기" value={q} onChange={e => setQ(e.target.value)} aria-label="선수 검색" />
      <div className="chips">
        {filters.map(f => (
          <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f === '참석' ? '참석자만' : f}</button>
        ))}
      </div>
      <div className="picker-list">
        {list.map(p => {
          const vote = attendance?.[p.id];
          return (
            <button key={p.id} className={`picker-row${p.id === current ? ' on' : ''}${p.out ? ' out' : ''}`} onClick={() => onPick(p.id)}>
              <span className="pk-num">{p.number}</span>
              <span className="pk-name">
                {p.name}
                {p.out && <em className="flag danger">부상{p.note ? ` · ${p.note}` : ''}</em>}
                {vote && <em className={`flag vote-${vote}`}>{ATTEND_LABEL[vote]}</em>}
              </span>
              <span className="pk-pos">{[p.pos, ...(p.altPos ?? [])].join('/')}</span>
              {taken[p.id] && p.id !== current && <span className="pk-taken">{taken[p.id]}에 배치됨</span>}
            </button>
          );
        })}
        {list.length === 0 && <p className="muted small">{filter === '참석' ? '아직 참석으로 답한 선수가 없어요.' : '해당하는 선수가 없어요.'}</p>}
      </div>
      {current && <button className="btn ghost danger" onClick={() => onPick(null)}>{emptyLabel}</button>}
    </Sheet>
  );
}
