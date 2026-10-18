import { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import type { Player, Pos } from '../types';

const FILTERS: ('전체' | Pos)[] = ['전체', 'GK', 'DF', 'MF', 'FW'];

interface Props {
  role: string;
  roster: Player[];
  /** player id -> role currently occupying */
  taken: Record<string, string>;
  current: string | null;
  onPick: (playerId: string | null) => void;
  onClose: () => void;
}

export function PlayerPicker({ role, roster, taken, current, onPick, onClose }: Props) {
  const [filter, setFilter] = useState<'전체' | Pos>('전체');
  const [q, setQ] = useState('');
  const list = useMemo(
    () => roster.filter(p => (filter === '전체' || p.pos === filter) && (!q.trim() || p.name.includes(q.trim()) || p.number === q.trim())),
    [roster, filter, q],
  );
  return (
    <Sheet title={`${role} 선수 선택`} onClose={onClose}>
      <input className="search-in" placeholder="이름이나 번호로 찾기" value={q} onChange={e => setQ(e.target.value)} aria-label="선수 검색" />
      <div className="chips">
        {FILTERS.map(f => (
          <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="picker-list">
        {list.map(p => (
          <button key={p.id} className={`picker-row${p.id === current ? ' on' : ''}`} onClick={() => onPick(p.id)}>
            <span className="pk-num">{p.number}</span>
            <span className="pk-name">{p.name}</span>
            <span className="pk-pos">{p.pos}</span>
            {taken[p.id] && p.id !== current && <span className="pk-taken">{taken[p.id]}에 배치됨</span>}
          </button>
        ))}
        {list.length === 0 && <p className="muted small">해당하는 선수가 없어요.</p>}
      </div>
      {current && <button className="btn ghost danger" onClick={() => onPick(null)}>이 자리 비우기</button>}
    </Sheet>
  );
}
