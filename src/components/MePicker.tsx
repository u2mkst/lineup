import { useState } from 'react';
import { useMe } from '../lib/me';
import { useStore } from '../lib/store';
import { Sheet } from './Sheet';

/** "Who are you?" - remembered on this device so voting and commenting need no account. */
export function MePicker({ onClose }: { onClose: () => void }) {
  const roster = useStore(s => s.roster);
  const me = useMe();
  const [q, setQ] = useState('');
  const list = roster.filter(p => !q.trim() || p.name.includes(q.trim()) || p.number === q.trim());
  return (
    <Sheet title="내 이름 선택" onClose={onClose}>
      <p className="hint">이 기기에서 참석 투표와 댓글을 남길 때 쓰는 이름이에요. 언제든 바꿀 수 있어요.</p>
      <input className="search-in" placeholder="이름이나 번호로 찾기" value={q} onChange={e => setQ(e.target.value)} aria-label="선수 검색" />
      <div className="picker-list">
        {list.map(p => (
          <button key={p.id} className={`picker-row${p.id === me.playerId ? ' on' : ''}`} onClick={() => { me.set(p.id); onClose(); }}>
            <span className="pk-num">{p.number}</span><span className="pk-name">{p.name}</span><span className="pk-pos">{p.pos}</span><span />
          </button>
        ))}
        {list.length === 0 && <p className="muted small">해당하는 선수가 없어요.</p>}
      </div>
    </Sheet>
  );
}
