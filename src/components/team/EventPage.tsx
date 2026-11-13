import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { deleteMatch, fetchAttendance, fetchMatch, fetchPublicTactic, saveMatch, setAttendance } from '../../lib/cloud';
import { kakaoEnabled, shareTextCard } from '../../lib/kakao';
import { ATTEND_LABEL, KIND_COLOR, KIND_LABEL, deadlineLabel, deadlineOf, formatKickoff, formatStamp, votingOpen } from '../../lib/matches';
import { go, paths } from '../../lib/route';
import { useStore } from '../../lib/store';
import { useTeamData } from '../../lib/teamData';
import { toast } from '../../lib/toast';
import { useAsync } from '../../lib/useAsync';
import type { Attend, Match, Tactic } from '../../types';
import { IconLink, IconMapPin } from '../Icons';
import { Menu } from '../Menu';
import { QuickPick } from '../QuickPick';
import { RatingsSheet } from '../RatingsSheet';
import { Sheet } from '../Sheet';
import { TacticComments } from '../TacticComments';
import { Loading, PageHeader } from '../ui';
import { Viewer } from '../Viewer';
import { EventForm } from './EventForm';
import { RecordForm } from './RecordForm';

const ORDER: Attend[] = ['yes', 'maybe', 'no'];

export function EventPage({ id }: { id: string }) {
  const roster = useStore(s => s.roster);
  const isAdmin = useAuth(s => s.isAdmin);
  const member = useAuth(s => s.member);
  const loadTeam = useTeamData(s => s.load);
  const allStats = useTeamData(s => s.stats);
  const match = useAsync(() => fetchMatch(id), [id]);
  const votes = useAsync(() => fetchAttendance(id), [id]);
  const [tactic, setTactic] = useState<Tactic | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quick, setQuick] = useState(false);
  const [rating, setRating] = useState(false);
  const [proxy, setProxy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const m = match.data;
  useEffect(() => { void loadTeam(); }, [loadTeam]);
  useEffect(() => {
    if (m === undefined) return;
    let live = true;
    setTactic(undefined);
    if (!m?.tacticId) { setTactic(null); return; }
    fetchPublicTactic(m.tacticId).then(t => live && setTactic(t)).catch(() => live && setTactic(null));
    return () => { live = false; };
  }, [m?.tacticId, m === undefined, m === null]);

  if (match.loading && m === undefined) return <><PageHeader title="일정" back={paths.schedule} /><Loading /></>;
  if (!m) return <><PageHeader title="일정" back={paths.schedule} /><div className="empty-msg"><p>일정을 찾을 수 없어요</p></div></>;

  const v = votes.data ?? {};
  const me = member?.playerId ?? null;
  const open = votingOpen(m);
  const isMatch = m.kind === 'match';
  const by = (s: Attend) => roster.filter(p => v[p.id] === s);
  const silent = roster.filter(p => !v[p.id]);
  const matchStats = allStats.filter(s => s.matchId === m.id);
  const potm = roster.find(p => p.id === m.potmPlayerId);

  const cast = async (playerId: string, status: Attend) => {
    setBusy(true);
    const before = votes.data;
    votes.setData({ ...v, [playerId]: status });
    try { await setAttendance(m.id, playerId, status); } catch (e) { votes.setData(before); toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const reloadAll = () => { void match.reload(); void votes.reload(); void loadTeam(); };
  const setStatus = async (status: Match['status']) => {
    try { await saveMatch({ id: m.id, kind: m.kind, title: m.title, opponent: m.opponent, kickoff: m.kickoff, venue: m.venue, notes: m.notes, voteDeadline: m.voteDeadline, status }); reloadAll(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  const pageUrl = `${location.origin}${location.pathname}${paths.event(m.id)}`;
  const kakao = async () => {
    try { await shareTextCard({ text: `⚽ ${m.title}\n${formatKickoff(m.kickoff)}${m.venue ? `\n${m.venue}` : ''}\n참석 ${by('yes').length}명`, url: pageUrl, button: '참석 투표하기' }); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(pageUrl); toast('일정 링크를 복사했어요'); } catch { toast('링크를 복사하지 못했어요', 'error'); } };

  const voteTotal = roster.length;
  const voted = voteTotal - silent.length;

  return (
    <>
      <PageHeader title="일정 상세" back={paths.schedule} right={
        <>
          {kakaoEnabled && <button className="btn sm kakao" onClick={() => void kakao()}>카카오톡</button>}
          <button className="icon-btn" aria-label="일정 링크 복사" onClick={() => void copy()}><IconLink /></button>
          {isAdmin && <Menu label="일정 메뉴" items={[
            { label: '수정', onClick: () => setEditing(true) },
            ...(isMatch && m.status !== 'finished' ? [{ label: '⚡ 빠른 선발로 라인업 만들기', onClick: () => setQuick(true) }] : []),
            ...(isMatch ? [{ label: m.status === 'finished' ? '경기 기록 수정' : '경기 기록 입력', onClick: () => setRecording(true) }] : []),
            m.status === 'cancelled' ? { label: '취소 해제', onClick: () => void setStatus('scheduled') } : { label: '일정 취소 처리', onClick: () => void setStatus('cancelled') },
            { label: '삭제', danger: true, onClick: () => confirm(`"${m.title}" 일정을 삭제할까요?`) && void deleteMatch(m.id).then(() => { void loadTeam(); go(paths.schedule); }).catch(e => toast((e as Error).message, 'error')) },
          ]} />}
        </>
      } />

      <section className="card event-head">
        <div className="event-badges"><em className="kind" style={{ background: KIND_COLOR[m.kind] }}>{KIND_LABEL[m.kind]}</em>{m.status === 'cancelled' && <em className="kind off">취소됨</em>}{m.status === 'finished' && <em className="kind done">종료</em>}</div>
        <h2>{m.title}</h2>
        <p className="when">{formatStamp(m.kickoff)}</p>
        {m.venue && <p className="muted"><IconMapPin width={14} height={14} /> {m.venue}</p>}
        {m.opponent && <p className="muted">상대 {m.opponent}</p>}
        {m.notes && <p className="match-notes">{m.notes}</p>}
      </section>

      {m.status === 'finished' && m.ourScore != null && (
        <section className="card">
          <h3>경기 결과</h3>
          <div className="result-score"><b>{m.ourScore}</b><span>:</span><b>{m.oppScore}</b></div>
          <p className={`result-tag ${m.ourScore > (m.oppScore ?? 0) ? 'win' : m.ourScore < (m.oppScore ?? 0) ? 'lose' : 'draw'}`}>{m.ourScore > (m.oppScore ?? 0) ? '승리' : m.ourScore < (m.oppScore ?? 0) ? '패배' : '무승부'}</p>
          {m.quarters.length > 0 && (
            <table className="quarters"><thead><tr><th /> {m.quarters.map((_, i) => <th key={i}>{i + 1}Q</th>)}</tr></thead>
              <tbody><tr><th>우리</th>{m.quarters.map((q, i) => <td key={i}>{q.us}</td>)}</tr><tr><th>상대</th>{m.quarters.map((q, i) => <td key={i}>{q.opp}</td>)}</tr></tbody></table>
          )}
          {potm && <p className="potm">👑 POTM <b>{potm.number} {potm.name}</b></p>}
          {matchStats.some(s => s.goals || s.assists) && (
            <ul className="scorers">{matchStats.filter(s => s.goals || s.assists).map(s => {
              const p = roster.find(x => x.id === s.playerId);
              return <li key={s.playerId}><b>{p ? `${p.number} ${p.name}` : '(삭제된 선수)'}</b><span>{s.goals ? `골 ${s.goals}` : ''}{s.goals && s.assists ? ' · ' : ''}{s.assists ? `도움 ${s.assists}` : ''}</span></li>;
            })}</ul>
          )}
        </section>
      )}

      {m.status !== 'cancelled' && (
        <section className="card">
          <div className="card-title"><h3>참석 투표</h3><span className={`deadline${open ? '' : ' closed'}`}>{m.status === 'finished' ? '종료' : deadlineLabel(m)}</span></div>
          <p className="muted small">마감 {formatStamp(deadlineOf(m))}</p>
          {me ? (
            <div className="vote-row" role="radiogroup" aria-label="내 참석 여부">
              {ORDER.map(s => (
                <button key={s} role="radio" aria-checked={v[me] === s} className={`vote-btn ${s}${v[me] === s ? ' on' : ''}`} disabled={busy || !open} onClick={() => void cast(me, s)}>{ATTEND_LABEL[s]}</button>
              ))}
            </div>
          ) : (
            <p className="hint">내 선수 프로필을 연결하면 투표할 수 있어요. <a className="link" href={paths.me}>프로필 연결하기</a></p>
          )}
          {!open && m.status === 'scheduled' && <p className="hint">투표가 마감됐어요.{isAdmin ? ' 관리자는 마감 후에도 대신 입력할 수 있어요.' : ''}</p>}
          <div className="rates">
            <div><small>참석률</small><b>{voteTotal ? Math.round((by('yes').length / voteTotal) * 100) : 0}%</b><span className="muted small">{by('yes').length}/{voteTotal}</span></div>
            <div><small>투표율</small><b>{voteTotal ? Math.round((voted / voteTotal) * 100) : 0}%</b><span className="muted small">{voted}/{voteTotal}</span></div>
          </div>
          {ORDER.map(s => by(s).length > 0 && (
            <div key={s} className="vote-group">
              <h4>{ATTEND_LABEL[s]} {by(s).length}</h4>
              <div className="bench">{by(s).map(p => (
                <button key={p.id} className={`bench-chip${p.out ? ' out' : ''}`} onClick={() => isAdmin && setProxy(p.id)} disabled={!isAdmin}><b>{p.number}</b>{p.name}{p.out ? <em className="flag danger">부상</em> : null}</button>
              ))}</div>
            </div>
          ))}
          {silent.length > 0 && (
            <div className="vote-group"><h4>미응답 {silent.length}</h4>
              <div className="bench">{silent.map(p => <button key={p.id} className="bench-chip muted-chip" onClick={() => isAdmin && setProxy(p.id)} disabled={!isAdmin}><b>{p.number}</b>{p.name}</button>)}</div></div>
          )}
          {isAdmin && <p className="hint">관리자는 이름을 눌러 대신 입력할 수 있어요.</p>}
        </section>
      )}

      {isMatch && (
        <section className="card">
          <h3>라인업</h3>
          {tactic === undefined && <p className="muted small">불러오는 중…</p>}
          {tactic === null && <p className="muted small">{m.tacticId ? '라인업이 비공개로 바뀌었어요.' : '라인업이 아직 정해지지 않았어요.'}</p>}
          {tactic && (<><p className="muted small">{tactic.name} · {tactic.us.formation}{tactic.opp ? ` vs ${tactic.opp.formation}` : ''}</p><Viewer tactic={tactic} roster={roster} /><TacticComments tacticId={tactic.id} /></>)}
        </section>
      )}

      {proxy && (
        <Sheet title={`${roster.find(p => p.id === proxy)?.name ?? ''} 대신 투표`} onClose={() => setProxy(null)}>
          <div className="vote-row">{ORDER.map(s => <button key={s} className={`vote-btn ${s}${v[proxy] === s ? ' on' : ''}`} onClick={() => { void cast(proxy, s); setProxy(null); }}>{ATTEND_LABEL[s]}</button>)}</div>
        </Sheet>
      )}
      {editing && <EventForm match={m} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reloadAll(); }} onDeleted={() => { void loadTeam(); go(paths.schedule); }} />}
      {quick && <QuickPick matchId={m.id} onClose={() => setQuick(false)} onRate={() => { setQuick(false); setRating(true); }} onDone={tid => go(paths.editor(tid))} />}
      {rating && <RatingsSheet onClose={() => setRating(false)} />}
      {recording && <RecordForm match={m} roster={roster} stats={matchStats} votes={v} onClose={() => setRecording(false)} onSaved={() => { setRecording(false); reloadAll(); }} />}
    </>
  );
}
