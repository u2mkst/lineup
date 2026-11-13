import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { fetchAttendance, fetchPosts, setAttendance } from '../../lib/cloud';
import { ATTEND_LABEL, KIND_COLOR, KIND_LABEL, deadlineLabel, formatStamp, isUpcoming, votingOpen } from '../../lib/matches';
import { paths } from '../../lib/route';
import { useStore } from '../../lib/store';
import { headToHead, isPlayed, seasonOf, teamStats } from '../../lib/stats';
import { useTeamData } from '../../lib/teamData';
import { toast } from '../../lib/toast';
import { useAsync } from '../../lib/useAsync';
import type { Attend } from '../../types';
import { IconChevronRight, IconMapPin, IconPin } from '../Icons';
import { Loading } from '../ui';
import { RecordBar } from './Records';

const ORDER: Attend[] = ['yes', 'maybe', 'no'];

export function HomeDashboard() {
  const teamName = useAuth(s => s.teamName);
  const member = useAuth(s => s.member);
  const roster = useStore(s => s.roster);
  const { matches, loaded, load } = useTeamData();
  const posts = useAsync(fetchPosts, []);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void load(); }, [load]);

  const next = useMemo(() => matches.filter(m => isUpcoming(m)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0], [matches]);
  const last = useMemo(() => matches.filter(isPlayed).sort((a, b) => b.kickoff.localeCompare(a.kickoff))[0], [matches]);
  const season = useMemo(() => teamStats(matches.filter(m => seasonOf(m.kickoff) === new Date().getFullYear())), [matches]);
  const votes = useAsync(() => (next ? fetchAttendance(next.id) : Promise.resolve({} as Record<string, Attend>)), [next?.id]);
  const v = votes.data ?? {};
  const me = member?.playerId ?? null;
  const h2h = next?.kind === 'match' && next.opponent ? headToHead(matches, next.opponent) : null;
  const pinned = (posts.data ?? []).filter(p => p.pinned).slice(0, 2);
  const count = (s: Attend) => roster.filter(p => v[p.id] === s).length;

  const cast = async (status: Attend) => {
    if (!next || !me) return;
    setBusy(true);
    const before = votes.data;
    votes.setData({ ...v, [me]: status });
    try { await setAttendance(next.id, me, status); } catch (e) { votes.setData(before); toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <header className="home-top">
        <div><small className="muted">구단 홈</small><h1>{teamName}</h1></div>
        <a className="avatar" href={paths.me} aria-label="내 프로필">{roster.find(p => p.id === me)?.number ?? '나'}</a>
      </header>

      {!loaded ? <Loading /> : (
        <>
          <section className="card next-card">
            <div className="card-title"><h3>다음 일정</h3>{next && <a className="more-link" href={paths.event(next.id)}>자세히 <IconChevronRight width={14} height={14} /></a>}</div>
            {!next ? <p className="muted small">예정된 일정이 없어요.</p> : (
              <>
                <a className="next-body" href={paths.event(next.id)}>
                  <em className="kind" style={{ background: KIND_COLOR[next.kind] }}>{KIND_LABEL[next.kind]}</em>
                  <strong>{next.title}</strong>
                  <span>{formatStamp(next.kickoff)}</span>
                  {next.venue && <span className="muted"><IconMapPin width={13} height={13} /> {next.venue}</span>}
                </a>
                <div className="next-vote">
                  <span className={`deadline${votingOpen(next) ? '' : ' closed'}`}>{deadlineLabel(next)}</span>
                  <span className="muted small">참석 {count('yes')} · 미정 {count('maybe')} · 불참 {count('no')}</span>
                </div>
                {me ? (
                  <div className="vote-row" role="radiogroup" aria-label="내 참석 여부">
                    {ORDER.map(s => <button key={s} role="radio" aria-checked={v[me] === s} className={`vote-btn ${s}${v[me] === s ? ' on' : ''}`} disabled={busy || !votingOpen(next)} onClick={() => void cast(s)}>{ATTEND_LABEL[s]}</button>)}
                  </div>
                ) : <p className="hint">내 선수 프로필을 연결하면 바로 투표할 수 있어요. <a className="link" href={paths.me}>연결하기</a></p>}
                {h2h && h2h.wins + h2h.draws + h2h.losses > 0 && <p className="h2h">역대 맞대결 {h2h.wins}승 {h2h.draws}무 {h2h.losses}패</p>}
              </>
            )}
          </section>

          <section className="card">
            <div className="card-title"><h3>{new Date().getFullYear()} 시즌</h3><a className="more-link" href={paths.records}>기록 <IconChevronRight width={14} height={14} /></a></div>
            {season.games === 0 ? <p className="muted small">아직 기록된 경기가 없어요.</p> : (
              <>
                <div className="snap-main"><b>{Math.round(season.winRate * 100)}%</b><span>{season.games}전 {season.wins}승 {season.draws}무 {season.losses}패</span></div>
                <RecordBar wins={season.wins} draws={season.draws} losses={season.losses} />
                <p className="muted small" style={{ marginTop: 8 }}>득점 {season.goalsFor} · 실점 {season.goalsAgainst} · 무실점 {season.cleanSheets}경기</p>
              </>
            )}
            {last && (
              <a className="last-game" href={paths.event(last.id)}>
                <span className="muted small">최근 경기</span>
                <strong>{last.title}</strong>
                <span className={`score ${last.ourScore! > last.oppScore! ? 'win' : last.ourScore! < last.oppScore! ? 'lose' : 'draw'}`}>{last.ourScore}:{last.oppScore}</span>
              </a>
            )}
          </section>
        </>
      )}

      <section className="card">
        <div className="card-title"><h3>공지</h3><a className="more-link" href={paths.board}>게시판 <IconChevronRight width={14} height={14} /></a></div>
        {posts.loading && !posts.data ? <Loading /> : pinned.length === 0 ? <p className="muted small">고정된 공지가 없어요.</p> : (
          <ul className="notice-list">{pinned.map(p => <li key={p.id}><a href={paths.post(p.id)}><IconPin width={14} height={14} /> {p.title}</a></li>)}</ul>
        )}
      </section>

      <section className="quick">
        <a href={paths.tactics}>전술 보드</a><a href={paths.roster}>선수단</a><a href={paths.board}>게시판</a>
      </section>
    </>
  );
}
