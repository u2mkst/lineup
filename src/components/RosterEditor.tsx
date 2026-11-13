import { useState } from 'react';
import { uid } from '../lib/id';
import { useStore } from '../lib/store';
import { IconTrash } from './Icons';
import { Sheet } from './Sheet';
import type { Player, Pos } from '../types';

const POS: Pos[] = ['GK', 'DF', 'MF', 'FW'];

export function RosterEditor({ onClose }: { onClose: () => void }) {
  const roster = useStore(s => s.roster);
  const setRoster = useStore(s => s.setRoster);
  const resetRoster = useStore(s => s.resetRoster);
  const [draft, setDraft] = useState<Player>({ id: '', number: '', name: '', pos: 'MF' });

  const patch = (id: string, p: Partial<Player>) => setRoster(roster.map(x => (x.id === id ? { ...x, ...p } : x)));
  const add = () => {
    if (!draft.number.trim() && !draft.name.trim()) return;
    setRoster([...roster, { ...draft, id: uid(), number: draft.number.trim(), name: draft.name.trim() }]);
    setDraft({ id: '', number: '', name: '', pos: draft.pos });
  };

  return (
    <Sheet title="선수 명단" onClose={onClose}>
      <p className="muted small">우리 팀 선수를 등록해 두면 라인업에서 골라 쓸 수 있어요. 변경 내용은 이 기기에 자동 저장돼요.</p>
      <div className="roster-grid head"><span>번호</span><span>이름</span><span>포지션</span><span /></div>
      <div className="roster-grid">
        <input placeholder="번호" inputMode="numeric" maxLength={3} value={draft.number} onChange={e => setDraft({ ...draft, number: e.target.value })} />
        <input placeholder="새 선수 이름" maxLength={8} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && add()} />
        <select value={draft.pos} onChange={e => setDraft({ ...draft, pos: e.target.value as Pos })}>{POS.map(p => <option key={p}>{p}</option>)}</select>
        <button className="btn primary sm" onClick={add}>추가</button>
      </div>
      <div className="roster-scroll">
        {roster.map(p => (
          <div className="roster-grid" key={p.id}>
            <input value={p.number} inputMode="numeric" maxLength={3} onChange={e => patch(p.id, { number: e.target.value })} />
            <input value={p.name} maxLength={8} onChange={e => patch(p.id, { name: e.target.value })} />
            <select value={p.pos} onChange={e => patch(p.id, { pos: e.target.value as Pos })}>{POS.map(x => <option key={x}>{x}</option>)}</select>
            <button className="icon-btn" aria-label={`${p.name} 삭제`} onClick={() => setRoster(roster.filter(x => x.id !== p.id))}><IconTrash width={18} height={18} /></button>
          </div>
        ))}
      </div>
      <button className="btn ghost" onClick={() => confirm('명단을 수원삼성 기본 명단으로 되돌릴까요?') && resetRoster()}>기본 명단으로 되돌리기</button>
    </Sheet>
  );
}
