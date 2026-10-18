import { useEffect, useState } from 'react';
import { fetchPublicTactic } from '../lib/cloud';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import type { Tactic } from '../types';
import { Viewer } from './Viewer';

/** A team-public tactic, readable without signing in. */
export function PublicView({ id, onOpen, onHome }: { id: string; onOpen: (id: string) => void; onHome: () => void }) {
  const [state, setState] = useState<Tactic | 'missing' | 'error' | null>(null);
  const roster = useStore(s => s.roster);
  const importTactic = useStore(s => s.importTactic);

  useEffect(() => {
    let live = true;
    fetchPublicTactic(id).then(t => live && setState(t ?? 'missing')).catch(() => live && setState('error'));
    return () => { live = false; };
  }, [id]);

  if (state === null) return <div className="empty"><p className="muted">전술을 불러오는 중…</p></div>;
  if (state === 'missing' || state === 'error') {
    return (
      <div className="empty">
        <h2>{state === 'missing' ? '볼 수 없는 전술이에요' : '불러오지 못했어요'}</h2>
        <p className="muted">{state === 'missing' ? '비공개로 바뀌었거나 삭제된 전술이에요.' : '인터넷 연결을 확인하고 다시 시도해 주세요.'}</p>
        <button className="btn primary" onClick={onHome}>처음으로</button>
      </div>
    );
  }
  return (
    <div className="home shared">
      <header className="home-hero">
        <p className="muted small">팀 공개 전술</p>
        <h1>{state.name}</h1>
        <p className="muted">{state.us.formation}{state.opp ? ` vs ${state.opp.formation}` : ''} · 장면 {state.frames.length}개</p>
      </header>
      <Viewer tactic={state} roster={roster} />
      <div className="btn-row center" style={{ marginTop: 20 }}>
        <button className="btn primary lg" onClick={() => { onOpen(importTactic(state, [])); toast('내 전술로 복사했어요'); }}>내 전술로 복사</button>
        <button className="btn ghost lg" onClick={onHome}>목록으로</button>
      </div>
    </div>
  );
}
