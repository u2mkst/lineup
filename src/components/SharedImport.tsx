import { useEffect, useState } from 'react';
import { decodePayload } from '../lib/share';
import { buildScene } from '../lib/scene';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import type { Player, Tactic } from '../types';
import { Pitch } from './Pitch';

type Res = { tactic: Tactic; players: Player[] } | 'bad' | null;

/** Landing page for a share link: preview first, add to the list on confirm. */
export function SharedImport({ code, onOpen, onHome }: { code: string; onOpen: (id: string) => void; onHome: () => void }) {
  const [res, setRes] = useState<Res>(null);
  const importTactic = useStore(s => s.importTactic);

  useEffect(() => {
    let live = true;
    decodePayload(code).then(r => live && setRes(r ?? 'bad'));
    return () => { live = false; };
  }, [code]);

  if (res === null) return <div className="empty"><p className="muted">전술을 불러오는 중…</p></div>;
  if (res === 'bad') {
    return (
      <div className="empty">
        <h2>열 수 없는 링크예요</h2>
        <p className="muted">링크가 잘렸거나 올바르지 않아요. 보낸 사람에게 다시 받아 보세요.</p>
        <button className="btn primary" onClick={onHome}>처음으로</button>
      </div>
    );
  }
  const { tactic, players } = res;
  const roster = players;
  return (
    <div className="home shared">
      <header className="home-hero">
        <p className="muted small">공유받은 전술</p>
        <h1>{tactic.name}</h1>
        <p className="muted">{tactic.us.formation}{tactic.opp ? ` vs ${tactic.opp.formation}` : ''} · 장면 {tactic.frames.length}개</p>
      </header>
      <div className="shared-pitch">
        <Pitch interactive={false} scene={buildScene(tactic, roster, tactic.frames[0].positions, null)} />
      </div>
      <div className="btn-row center">
        <button className="btn primary lg" onClick={() => { onOpen(importTactic(tactic, players)); toast('내 전술에 추가했어요'); }}>내 전술로 열기</button>
        <button className="btn ghost lg" onClick={onHome}>취소</button>
      </div>
    </div>
  );
}
