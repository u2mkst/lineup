import { useEffect, useState } from 'react';
import { fetchMatches } from '../lib/cloud';
import { formatKickoff } from '../lib/matches';
import { attachTactic, detachTactic } from '../lib/matchLink';
import { toast } from '../lib/toast';
import type { Match, Tactic } from '../types';
import { Sheet } from './Sheet';

/** Admin: choose which match this line-up is for. */
export function MatchLinkSheet({ tactic, onClose }: { tactic: Tactic; onClose: () => void }) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchMatches().then(m => live && setMatches(m)).catch(e => { toast((e as Error).message, 'error'); onClose(); });
    return () => { live = false; };
  }, [onClose]);

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try { await fn(); toast(done); onClose(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Sheet title="경기에 연결" onClose={onClose}>
      <p className="hint">연결하면 이 라인업이 팀 공개로 바뀌고, 경기 페이지에서 팀원이 볼 수 있어요.</p>
      {matches === null && <p className="muted small">불러오는 중…</p>}
      {matches?.length === 0 && <p className="muted small">등록된 경기가 없어요. 홈의 "경기" 탭에서 먼저 경기를 등록해 주세요.</p>}
      <div className="picker-list">
        {matches?.map(m => (
          <button key={m.id} className={`picker-row stack${m.id === tactic.matchId ? ' on' : ''}`} disabled={busy}
            onClick={() => run(() => attachTactic(tactic, m.id), `"${m.title}" 경기에 연결했어요`)}>
            <strong>{m.title}</strong>
            <span className="muted small">{formatKickoff(m.kickoff)}{m.venue ? ` · ${m.venue}` : ''}</span>
          </button>
        ))}
      </div>
      {tactic.matchId && <button className="btn ghost danger" disabled={busy} onClick={() => run(() => detachTactic(tactic), '경기 연결을 해제했어요')}>연결 해제</button>}
    </Sheet>
  );
}
