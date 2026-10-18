import { useState } from 'react';
import { useStore } from '../lib/store';
import { Sheet } from './Sheet';

const GROUPS = [['GK', '골키퍼'], ['DF', '수비수'], ['MF', '미드필더'], ['FW', '공격수']] as const;

/** Read-only roster for people who are not signed in. */
export function RosterView({ onClose }: { onClose: () => void }) {
  const roster = useStore(s => s.roster);
  const [q, setQ] = useState('');
  const match = (p: { name: string; number: string }) => !q.trim() || p.name.includes(q.trim()) || p.number === q.trim();
  return (
    <Sheet title="선수 명단" onClose={onClose}>
      <input className="search-in" placeholder="이름이나 번호로 찾기" value={q} onChange={e => setQ(e.target.value)} aria-label="선수 검색" />
      {GROUPS.map(([pos, label]) => {
        const list = roster.filter(p => p.pos === pos && match(p));
        if (list.length === 0) return null;
        return (
          <div key={pos} className="formation-group">
            <h4>{label} · {list.length}</h4>
            <div className="bench">
              {list.map(p => (
                <span key={p.id} className={`bench-chip${p.out ? ' out' : ''}`}><b>{p.number}</b>{p.name}
                  {p.altPos?.length ? <small>+{p.altPos.join('/')}</small> : null}{p.out ? <em className="flag danger">부상</em> : null}</span>
              ))}
            </div>
          </div>
        );
      })}
      {roster.length === 0 && <p className="muted small">등록된 선수가 없어요.</p>}
      <p className="hint">명단은 관리자가 관리해요. 변경하려면 관리자에게 요청해 주세요.</p>
    </Sheet>
  );
}
