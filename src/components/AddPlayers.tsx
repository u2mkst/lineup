import { useMemo, useState } from 'react';
import { addPlayerRemote } from '../lib/cloud';
import { parsePlayers } from '../lib/bulkPlayers';
import { useStore } from '../lib/store';
import { reloadRoster } from '../lib/sync';
import { toast } from '../lib/toast';
import type { Pos } from '../types';
import { Sheet } from './Sheet';
import { Segmented } from './ui';

const POS_CHOICES: { id: Pos; label: string }[] = [{ id: 'GK', label: '골키퍼' }, { id: 'DF', label: '수비수' }, { id: 'MF', label: '미드필더' }, { id: 'FW', label: '공격수' }];

const nextFreeNumber = (taken: string[]) => { for (let n = 1; n < 100; n++) if (!taken.includes(String(n))) return String(n); return ''; };

/** Paste a list (one player per line) and add everyone at once. */
export function BulkAddForm({ onDone, submitLabel = '추가' }: { onDone: (added: number) => void; submitLabel?: string }) {
  const roster = useStore(s => s.roster);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => parsePlayers(text, roster), [text, roster]);
  const good = rows.filter(r => !r.error);
  const bad = rows.length - good.length;

  const submit = async () => {
    setBusy(true);
    let added = 0;
    const failed: string[] = [];
    for (const r of good) {
      try { await addPlayerRemote({ number: r.number, name: r.name, pos: r.pos }); added++; } catch (e) { failed.push(`${r.name}: ${(e as Error).message}`); }
    }
    await reloadRoster().catch(() => undefined);
    setBusy(false);
    if (failed.length) toast(`${added}명 추가, ${failed.length}명 실패 — ${failed[0]}`, 'error');
    else toast(`${added}명을 추가했어요`);
    if (added) onDone(added);
  };

  return (
    <div className="bulk">
      <textarea className="text-in bulk-text" rows={7} value={text} aria-label="선수 목록" autoFocus spellCheck={false}
        placeholder={'한 줄에 한 명씩 적어요\n7 김철수 MF\n10 이영희 공격수\n1 박골키 GK'} onChange={e => setText(e.target.value)} />
      <p className="hint">순서는 상관없어요. 포지션(GK/DF/MF/FW 또는 골키퍼·수비·미드·공격)을 빼면 미드필더로 넣어요. 단체방 명단을 그대로 붙여넣어도 돼요.</p>
      {rows.length > 0 && (
        <ul className="bulk-preview" aria-label="미리보기">
          {rows.map(r => (
            <li key={r.line} className={r.error ? 'bad' : ''}>
              <b>{r.number || '?'}</b><span>{r.name || '?'}</span><small>{r.pos}</small>
              {r.error && <em className="error">{r.error}</em>}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn primary lg block" disabled={busy || good.length === 0} onClick={() => void submit()}>
        {busy ? '추가하는 중…' : `${good.length}명 ${submitLabel}${bad ? ` (${bad}줄은 제외)` : ''}`}
      </button>
    </div>
  );
}

/** One player: name, number, position. Stays open so the next one can follow right away. */
function SingleAdd({ onAdded }: { onAdded: () => void }) {
  const roster = useStore(s => s.roster);
  const [name, setName] = useState('');
  const [number, setNumber] = useState(() => nextFreeNumber(roster.map(p => p.number)));
  const [pos, setPos] = useState<Pos>('MF');
  const [busy, setBusy] = useState(false);
  const owner = roster.find(p => p.number === number.trim());
  const ok = name.trim().length > 0 && name.trim().length <= 8 && number.trim().length > 0 && !owner;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      await addPlayerRemote({ number: number.trim(), name: name.trim(), pos });
      toast(`${name.trim()} 선수를 추가했어요`);
      await reloadRoster().catch(() => undefined);
      const taken = [...useStore.getState().roster.map(p => p.number), number.trim()];
      setName(''); setNumber(nextFreeNumber(taken)); onAdded();
    } catch (err) { toast((err as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <form className="form-col" onSubmit={submit}>
      <label className="field"><span>이름 (8자 이내)</span>
        <input className="text-in" value={name} maxLength={8} autoFocus aria-label="선수 이름" onChange={e => setName(e.target.value)} /></label>
      <label className="field"><span>등번호</span>
        <input className="text-in" inputMode="numeric" maxLength={3} value={number} aria-label="등번호" onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} /></label>
      {owner && <p className="error" role="alert">{owner.name} 선수가 이미 쓰는 번호예요.</p>}
      <div className="chips" role="radiogroup" aria-label="포지션">
        {POS_CHOICES.map(c => <button key={c.id} type="button" role="radio" aria-checked={pos === c.id} className={`chip${pos === c.id ? ' on' : ''}`} onClick={() => setPos(c.id)}>{c.label}</button>)}
      </div>
      <button className="btn primary lg block" type="submit" disabled={!ok || busy}>{busy ? '추가하는 중…' : '추가하고 다음 선수'}</button>
    </form>
  );
}

/** Admin: add players one at a time or paste a whole list. */
export function AddPlayersSheet({ onClose, start = 'one' }: { onClose: () => void; start?: 'one' | 'many' }) {
  const [tab, setTab] = useState<'one' | 'many'>(start);
  const [count, setCount] = useState(0);
  const total = useStore(s => s.roster.length);
  return (
    <Sheet title="선수 추가" onClose={onClose}>
      <Segmented<'one' | 'many'> label="추가 방식" value={tab} onChange={setTab} options={[{ id: 'one', label: '한 명씩' }, { id: 'many', label: '여러 명 한꺼번에' }]} />
      {tab === 'one' ? <SingleAdd onAdded={() => setCount(c => c + 1)} /> : <BulkAddForm onDone={onClose} />}
      <p className="muted small">현재 명단 {total}명{count ? ` · 방금 ${count}명 추가` : ''}</p>
      <button className="btn ghost block" onClick={onClose}>{count ? '다 됐어요' : '닫기'}</button>
    </Sheet>
  );
}
