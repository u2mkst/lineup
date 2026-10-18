import { useState } from 'react';
import { addPlayerRemote, deletePlayerRemote, swapNumbersRemote, updatePlayerRemote } from '../lib/cloud';
import { useStore } from '../lib/store';
import { reloadRoster } from '../lib/sync';
import { toast } from '../lib/toast';
import type { Player, Pos } from '../types';
import { IconSettings, IconTrash } from './Icons';
import { Sheet } from './Sheet';

const POS: Pos[] = ['GK', 'DF', 'MF', 'FW'];

/** Admin-only roster management: add / edit / delete players and swap shirt numbers. */
export function AdminRoster({ onClose }: { onClose: () => void }) {
  const roster = useStore(s => s.roster);
  const [draft, setDraft] = useState({ number: '', name: '', pos: 'MF' as Pos });
  const [swapMode, setSwapMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  /** Runs a server change, then always re-reads the roster so the screen shows the truth. */
  const run = async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      if (success) toast(success);
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    } finally {
      await reloadRoster().catch(() => undefined);
      setBusy(false);
    }
  };

  const add = async () => {
    const number = draft.number.trim();
    const name = draft.name.trim();
    if (!number || !name) { toast('번호와 이름을 모두 입력해 주세요', 'error'); return; }
    if (await run(() => addPlayerRemote({ number, name, pos: draft.pos }), `${name} 선수를 추가했어요`)) {
      setDraft({ number: '', name: '', pos: draft.pos });
    }
  };

  const commit = (p: Player, field: 'number' | 'name', raw: string) => {
    const value = raw.trim();
    if (value === p[field]) return;
    if (!value) { toast(field === 'number' ? '번호를 입력해 주세요' : '이름을 입력해 주세요', 'error'); void reloadRoster(); return; }
    void run(() => updatePlayerRemote(p.id, { [field]: value }), field === 'number' ? `${p.name} 번호를 ${value}번으로 바꿨어요` : undefined);
  };

  const toggle = (id: string) => setPicked(cur => (cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id]));
  const [a, b] = picked.map(id => roster.find(p => p.id === id));

  const swap = async () => {
    if (!a || !b) return;
    if (await run(() => swapNumbersRemote(a.id, b.id), `${a.name}(${b.number})과 ${b.name}(${a.number})의 번호를 서로 바꿨어요`)) {
      setPicked([]); setSwapMode(false);
    }
  };

  return (
    <Sheet title="선수 명단 관리" onClose={onClose}>
      <div className="admin-add">
        <input placeholder="번호" inputMode="numeric" maxLength={3} value={draft.number} aria-label="새 선수 번호"
          onChange={e => setDraft({ ...draft, number: e.target.value })} />
        <input placeholder="새 선수 이름" maxLength={8} value={draft.name} aria-label="새 선수 이름"
          onChange={e => setDraft({ ...draft, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && void add()} />
        <select value={draft.pos} aria-label="새 선수 포지션" onChange={e => setDraft({ ...draft, pos: e.target.value as Pos })}>{POS.map(p => <option key={p}>{p}</option>)}</select>
        <button className="btn primary sm" disabled={busy} onClick={() => void add()}>추가</button>
      </div>

      <div className="btn-row">
        <button className={`btn sm ${swapMode ? 'primary' : 'ghost'}`} aria-pressed={swapMode} onClick={() => { setSwapMode(m => !m); setPicked([]); }}>
          {swapMode ? '번호 교체 끝내기' : '번호 교체'}
        </button>
        <span className="muted small admin-count">{roster.length}명</span>
      </div>

      {swapMode && (
        <div className="swap-bar" role="status">
          {picked.length < 2
            ? <span>번호를 서로 바꿀 선수 두 명을 선택하세요 ({picked.length}/2)</span>
            : <><span><b>{a?.name}</b> {a?.number}번 ↔ <b>{b?.name}</b> {b?.number}번</span><button className="btn sm primary" disabled={busy} onClick={() => void swap()}>서로 바꾸기</button></>}
        </div>
      )}

      <div className="roster-grid head"><span>번호</span><span>이름</span><span>포지션</span><span /></div>
      <div className="roster-scroll">
        {roster.map(p => (
          <div className="player-block" key={p.id}>
            <div className={`roster-grid${picked.includes(p.id) ? ' picked' : ''}${p.out ? ' is-out' : ''}`}>
              {swapMode ? (
                <>
                  <button className={`pick-btn${picked.includes(p.id) ? ' on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={picked.includes(p.id)} aria-label={`${p.name} 선택`}>{p.number}</button>
                  <button className="pick-name" onClick={() => toggle(p.id)}>{p.name}{p.out && <em className="flag danger">부상</em>}</button>
                  <span className="muted small">{p.pos}</span>
                  <span />
                </>
              ) : (
                <>
                  <input defaultValue={p.number} key={`n-${p.id}-${p.number}`} inputMode="numeric" maxLength={3} aria-label={`${p.name} 번호`}
                    onBlur={e => commit(p, 'number', e.target.value)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                  <input defaultValue={p.name} key={`m-${p.id}-${p.name}`} maxLength={8} aria-label={`${p.number}번 이름`}
                    onBlur={e => commit(p, 'name', e.target.value)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                  <select value={p.pos} aria-label={`${p.name} 포지션`} onChange={e => void run(() => updatePlayerRemote(p.id, { pos: e.target.value as Pos, altPos: (p.altPos ?? []).filter(x => x !== e.target.value) }))}>
                    {POS.map(x => <option key={x}>{x}</option>)}
                  </select>
                  <button className={`icon-btn${open === p.id ? ' on' : ''}`} aria-label={`${p.name} 상세`} aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
                    <IconSettings width={18} height={18} />
                  </button>
                </>
              )}
            </div>
            {!swapMode && (p.out || p.altPos?.length) && open !== p.id && (
              <p className="player-meta">
                {p.altPos?.length ? <span>겸임 {p.altPos.join('/')}</span> : null}
                {p.out ? <span className="danger">부상{p.note ? ` · ${p.note}` : ''}</span> : null}
              </p>
            )}
            {open === p.id && !swapMode && (
              <div className="player-extra">
                <div>
                  <span className="muted small">겸임 포지션</span>
                  <div className="chips">
                    {POS.filter(x => x !== p.pos).map(x => {
                      const on = !!p.altPos?.includes(x);
                      return (
                        <button key={x} className={`chip${on ? ' on' : ''}`} aria-pressed={on} disabled={busy}
                          onClick={() => void run(() => updatePlayerRemote(p.id, { altPos: on ? (p.altPos ?? []).filter(y => y !== x) : [...(p.altPos ?? []), x] }))}>{x}</button>
                      );
                    })}
                  </div>
                </div>
                <label className="check">
                  <input type="checkbox" checked={!!p.out} disabled={busy} onChange={e => void run(() => updatePlayerRemote(p.id, { out: e.target.checked, note: e.target.checked ? p.note ?? '' : '' }))} />
                  부상 / 출전 불가
                </label>
                {p.out && (
                  <input className="text-in" maxLength={20} placeholder="사유 (예: 햄스트링)" defaultValue={p.note ?? ''} key={`o-${p.id}-${p.note}`} aria-label={`${p.name} 부상 사유`}
                    onBlur={e => e.target.value.trim() !== (p.note ?? '') && void run(() => updatePlayerRemote(p.id, { note: e.target.value.trim() }))} />
                )}
                <button className="btn sm ghost danger" disabled={busy}
                  onClick={() => confirm(`${p.name} 선수를 명단에서 삭제할까요? 이 선수를 쓰던 전술에서는 자리가 비어 보여요.`) && void run(() => deletePlayerRemote(p.id), `${p.name} 선수를 삭제했어요`)}>
                  <IconTrash width={15} height={15} /> 선수 삭제
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="hint">번호와 이름은 입력 후 다른 곳을 누르면 저장돼요. 등번호는 겹칠 수 없어서, 서로 바꿀 땐 "번호 교체"를 쓰세요.</p>
    </Sheet>
  );
}
