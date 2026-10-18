import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { fetchMatches, fetchVoteCounts } from '../lib/cloud';
import { formatKickoff, isOpen } from '../lib/matches';
import { IconPlus } from './Icons';
import { MatchForm } from './MatchForm';
import type { Match } from '../types';

function Row({ m, votes }: { m: Match; votes: number | undefined }) {
  const d = new Date(m.kickoff);
  return (
    <div className="tactic-row">
      <a className="tactic-main" href={`#/m/${encodeURIComponent(m.id)}`}>
        <span className={`match-row-date${isOpen(m.kickoff) ? '' : ' past'}`} aria-hidden>
          <small>{d.getMonth() + 1}월</small><b>{d.getDate()}</b>
        </span>
        <span className="tactic-info">
          <strong>{m.title}</strong>
          <span>{formatKickoff(m.kickoff)}</span>
          <span className="muted">{[m.opponent && `vs ${m.opponent}`, m.venue, `참석 ${votes ?? 0}명`].filter(Boolean).join(' · ')}</span>
        </span>
      </a>
    </div>
  );
}

/** Home tab: upcoming and past matches; admins can add one. */
export function MatchesTab() {
  const isAdmin = useAuth(s => s.isAdmin);
  const [state, setState] = useState<{ list: Match[]; votes: Record<string, number> } | 'loading' | 'error'>('loading');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const list = await fetchMatches();
        const votes = await fetchVoteCounts(list.map(m => m.id)).catch(() => ({}));
        if (live) setState({ list, votes });
      } catch {
        if (live) setState('error');
      }
    })();
    return () => { live = false; };
  }, []);

  if (state === 'loading') return <p className="muted small empty-msg">불러오는 중…</p>;
  if (state === 'error') return <p className="muted small empty-msg">경기를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>;

  const upcoming = state.list.filter(m => isOpen(m.kickoff)).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const past = state.list.filter(m => !isOpen(m.kickoff));

  return (
    <>
      {isAdmin && <button className="btn block ghost" style={{ marginBottom: 14 }} onClick={() => setCreating(true)}><IconPlus width={16} height={16} /> 경기 등록</button>}
      {state.list.length === 0 && (
        <div className="empty-msg">
          <p>등록된 경기가 없어요</p>
          <p className="muted small">{isAdmin ? '경기를 등록하면 팀원이 참석 여부를 투표할 수 있어요.' : '관리자가 경기를 등록하면 여기에 나타나요.'}</p>
        </div>
      )}
      {upcoming.length > 0 && <h2 className="group-title">다가오는 경기</h2>}
      {upcoming.map(m => <Row key={m.id} m={m} votes={state.votes[m.id]} />)}
      {past.length > 0 && <h2 className="group-title">지난 경기</h2>}
      {past.map(m => <Row key={m.id} m={m} votes={state.votes[m.id]} />)}
      {creating && <MatchForm onClose={() => setCreating(false)} onSaved={m => { setCreating(false); location.hash = `#/m/${encodeURIComponent(m.id)}`; }} />}
    </>
  );
}
