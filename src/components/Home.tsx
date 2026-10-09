import { useState } from 'react';
import { useStore } from '../lib/store';
import { RosterEditor } from './RosterEditor';

export function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const tactics = useStore(s => s.tactics);
  const add = useStore(s => s.addTactic);
  const dup = useStore(s => s.duplicateTactic);
  const del = useStore(s => s.deleteTactic);
  const [roster, setRoster] = useState(false);

  return (
    <div className="home">
      <header className="hero">
        <div className="logo" aria-hidden>⚽</div>
        <h1>축구방</h1>
        <p>라인업을 짜고, 전술을 움직여 보세요.</p>
        <div className="row center gap">
          <button className="btn primary lg" onClick={() => onOpen(add())}>＋ 새 전술 만들기</button>
          <button className="btn ghost lg" onClick={() => setRoster(true)}>선수 명단</button>
        </div>
      </header>

      <section className="list">
        <h2>내 전술</h2>
        {tactics.length === 0 && <p className="muted empty-msg">아직 만든 전술이 없어요. 새 전술을 만들어 보세요.</p>}
        {tactics.map(t => (
          <div className="tactic-row" key={t.id}>
            <button className="tactic-main" onClick={() => onOpen(t.id)}>
              <strong>{t.name}</strong>
              <span>
                {t.us.formation}{t.opp ? ` vs ${t.opp.formation}` : ''} · 장면 {t.frames.length}개 ·{' '}
                {new Date(t.updatedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              </span>
            </button>
            <button className="icon-btn" aria-label="복제" onClick={() => dup(t.id)}>⧉</button>
            <button className="icon-btn" aria-label="삭제" onClick={() => confirm(`"${t.name}"을 삭제할까요?`) && del(t.id)}>🗑</button>
          </div>
        ))}
      </section>
      {roster && <RosterEditor onClose={() => setRoster(false)} />}
    </div>
  );
}
