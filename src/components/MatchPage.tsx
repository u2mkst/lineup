import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { fetchAttendance, fetchMatch, fetchPublicTactic, setAttendance } from '../lib/cloud';
import { kakaoEnabled, shareTextCard } from '../lib/kakao';
import { ATTEND_LABEL, formatKickoff, isOpen } from '../lib/matches';
import { useMe } from '../lib/me';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import type { Attend, Match, Tactic } from '../types';
import { IconBack, IconLink } from './Icons';
import { MatchForm } from './MatchForm';
import { MePicker } from './MePicker';
import { TacticComments } from './TacticComments';
import { Viewer } from './Viewer';

const ORDER: Attend[] = ['yes', 'maybe', 'no'];

/** One match: details, attendance voting, the published line-up and its comments. */
export function MatchPage({ id, onHome }: { id: string; onHome: () => void }) {
  const roster = useStore(s => s.roster);
  const isAdmin = useAuth(s => s.isAdmin);
  const meId = useMe(s => s.playerId);
  const me = roster.find(p => p.id === meId);
  const [match, setMatch] = useState<Match | 'missing' | 'error' | null>(null);
  const [votes, setVotes] = useState<Record<string, Attend>>({});
  const [tactic, setTactic] = useState<Tactic | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await fetchMatch(id);
      if (!m) { setMatch('missing'); return; }
      setMatch(m);
      setVotes(await fetchAttendance(id));
      setTactic(m.tacticId ? await fetchPublicTactic(m.tacticId) : null);
    } catch {
      setMatch(prev => prev ?? 'error');
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (match === null) return <div className="empty"><p className="muted">경기를 불러오는 중…</p></div>;
  if (match === 'missing' || match === 'error') {
    return (
      <div className="empty">
        <h2>{match === 'missing' ? '경기를 찾을 수 없어요' : '불러오지 못했어요'}</h2>
        <p className="muted">{match === 'missing' ? '삭제되었거나 잘못된 링크예요.' : '인터넷 연결을 확인하고 다시 시도해 주세요.'}</p>
        <button className="btn primary" onClick={onHome}>처음으로</button>
      </div>
    );
  }

  const open = isOpen(match.kickoff);
  const mine = me ? votes[me.id] : undefined;
  const group = (s: Attend) => roster.filter(p => votes[p.id] === s);
  const silent = roster.filter(p => !votes[p.id]);

  const vote = async (status: Attend) => {
    if (!me) { setPicking(true); return; }
    setBusy(true);
    const before = votes;
    setVotes({ ...votes, [me.id]: status });          // optimistic
    try { await setAttendance(match.id, me.id, status); } catch (e) { setVotes(before); toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const pageUrl = `${location.origin}${location.pathname}#/m/${encodeURIComponent(match.id)}`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(pageUrl); toast('경기 링크를 복사했어요'); } catch { toast('링크를 복사하지 못했어요', 'error'); }
  };
  const kakao = async () => {
    try {
      await shareTextCard({ text: `⚽ ${match.title}\n${formatKickoff(match.kickoff)}${match.venue ? `\n${match.venue}` : ''}\n참석 ${group('yes').length}명`, url: pageUrl, button: '참석 투표하기' });
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="home match">
      <header className="home-bar">
        <button className="icon-btn" onClick={onHome} aria-label="목록으로"><IconBack /></button>
        <div className="home-actions">
          {kakaoEnabled && <button className="btn sm kakao" onClick={() => void kakao()}>카카오톡</button>}
          <button className="icon-btn" aria-label="경기 링크 복사" onClick={() => void copyLink()}><IconLink /></button>
          {isAdmin && <button className="btn sm ghost" onClick={() => setEditing(true)}>수정</button>}
        </div>
      </header>

      <section className="match-head">
        <h1>{match.title}</h1>
        <p className="when">{formatKickoff(match.kickoff)}</p>
        <p className="muted">{[match.opponent && `vs ${match.opponent}`, match.venue].filter(Boolean).join(' · ') || '상대·장소 미정'}</p>
        {match.notes && <p className="match-notes">{match.notes}</p>}
      </section>

      <section className="card-block">
        <h2>참석 투표</h2>
        <div className="me-row">
          {me ? <span>나: <b>{me.number} {me.name}</b></span> : <span className="muted">누구인지 먼저 알려 주세요</span>}
          <button className="link" onClick={() => setPicking(true)}>{me ? '바꾸기' : '내 이름 선택'}</button>
        </div>
        <div className="vote-row" role="radiogroup" aria-label="참석 여부">
          {ORDER.map(s => (
            <button key={s} role="radio" aria-checked={mine === s} className={`vote-btn ${s}${mine === s ? ' on' : ''}`} disabled={busy || !open} onClick={() => void vote(s)}>
              {ATTEND_LABEL[s]}
            </button>
          ))}
        </div>
        {!open && <p className="hint">경기가 끝나서 투표가 닫혔어요.</p>}
        <div className="tally">
          {ORDER.map(s => <span key={s} className={`tally-${s}`}>{ATTEND_LABEL[s]} <b>{group(s).length}</b></span>)}
          <span>미응답 <b>{silent.length}</b></span>
        </div>
        {ORDER.map(s => group(s).length > 0 && (
          <div key={s} className="vote-group">
            <h4>{ATTEND_LABEL[s]}</h4>
            <div className="bench">{group(s).map(p => <span key={p.id} className={`bench-chip${p.out ? ' out' : ''}`}><b>{p.number}</b>{p.name}{p.out ? <em className="flag danger">부상</em> : null}</span>)}</div>
          </div>
        ))}
        {silent.length > 0 && (
          <div className="vote-group">
            <h4>아직 답하지 않은 선수</h4>
            <div className="bench">{silent.map(p => <span key={p.id} className="bench-chip muted-chip"><b>{p.number}</b>{p.name}</span>)}</div>
          </div>
        )}
      </section>

      <section className="card-block">
        <h2>라인업</h2>
        {tactic === undefined && <p className="muted small">불러오는 중…</p>}
        {tactic === null && <p className="muted small">{match.tacticId ? '라인업이 비공개로 바뀌었어요.' : '라인업이 아직 정해지지 않았어요.'}</p>}
        {tactic && (
          <>
            <p className="muted small">{tactic.name} · {tactic.us.formation}{tactic.opp ? ` vs ${tactic.opp.formation}` : ''}</p>
            <Viewer tactic={tactic} roster={roster} />
            <TacticComments tacticId={tactic.id} />
          </>
        )}
      </section>

      {picking && <MePicker onClose={() => setPicking(false)} />}
      {editing && <MatchForm match={match} onClose={() => setEditing(false)} onSaved={m => { setMatch(m); setEditing(false); }} onDeleted={onHome} />}
    </div>
  );
}
