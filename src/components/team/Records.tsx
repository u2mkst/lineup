import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { KIND_LABEL, formatStamp } from '../../lib/matches';
import { go, paths } from '../../lib/route';
import { useStore } from '../../lib/store';
import { headToHead, isPlayed, playerBoard, seasonOf, seasons, teamStats, type Leader } from '../../lib/stats';
import { useTeamData } from '../../lib/teamData';
import { Empty, Loading, PageHeader, Segmented } from '../ui';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const one = (n: number) => n.toFixed(1);
const two = (n: number) => n.toFixed(2);

/** Season record bar: wins / draws / losses. */
export function RecordBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const n = wins + draws + losses;
  const w = (v: number) => (n ? `${(v / n) * 100}%` : '0%');
  return (
    <div className="record-bar" role="img" aria-label={`${n}전 ${wins}승 ${draws}무 ${losses}패`}>
      <i className="win" style={{ width: w(wins) }} /><i className="draw" style={{ width: w(draws) }} /><i className="lose" style={{ width: w(losses) }} />
    </div>
  );
}

function StatCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="stat-card">
      <small>{label}</small>
      <b>{value}{unit && <span>{unit}</span>}</b>
      {sub && <em>{sub}</em>}
    </div>
  );
}

export function RecordsPage() {
  const roster = useStore(s => s.roster);
  const isAdmin = useAuth(s => s.isAdmin);
  const { matches, stats, loaded, error, load } = useTeamData();
  const [tab, setTab] = useState<'team' | 'player' | 'games'>('team');
  const [season, setSeason] = useState<number | 'all'>(new Date().getFullYear());
  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => seasons(matches), [matches]);
  const inSeason = useMemo(() => matches.filter(m => season === 'all' || seasonOf(m.kickoff) === season), [matches, season]);
  const team = useMemo(() => teamStats(inSeason), [inSeason]);
  const board = useMemo(() => playerBoard(inSeason, stats, roster), [inSeason, stats, roster]);
  const played = inSeason.filter(isPlayed).sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  const nameOf = (id: string) => { const p = roster.find(x => x.id === id); return p ? p.name : '(삭제된 선수)'; };

  const leader = (label: string, l: Leader | null, unit: string, fmt: (v: number) => string = v => String(v)) => (
    <StatCard key={label} label={label} value={l ? nameOf(l.playerId) : '-'} sub={l ? `${fmt(l.value)}${unit}${l.tied.length ? ` · 공동 ${l.tied.length + 1}명` : ''}` : '기록 없음'} />
  );

  return (
    <>
      <PageHeader title="기록" right={
        <select className="season-select" value={season} onChange={e => setSeason(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="시즌">
          {[...new Set([new Date().getFullYear(), ...years])].sort((a, b) => b - a).map(y => <option key={y} value={y}>{y} 시즌</option>)}
          <option value="all">전체</option>
        </select>
      } />
      {!loaded && !error && <Loading />}
      {error && !loaded && <Empty title="기록을 불러오지 못했어요" action={<button className="btn sm" onClick={() => void load()}>다시 시도</button>} />}
      {loaded && (
        <>
          <section className="card snapshot">
            <small>시즌 승률</small>
            <div className="snap-main"><b>{team.games ? pct(team.winRate) : '-'}</b><span>{team.games}전 {team.wins}승 {team.draws}무 {team.losses}패</span></div>
            <RecordBar wins={team.wins} draws={team.draws} losses={team.losses} />
            <div className="snap-legend"><span><i className="win" />승 {team.wins}</span><span><i className="draw" />무 {team.draws}</span><span><i className="lose" />패 {team.losses}</span></div>
          </section>

          <Segmented<'team' | 'player' | 'games'> label="기록 보기" value={tab} onChange={setTab} options={[{ id: 'team', label: '팀 기록' }, { id: 'player', label: '개인 기록' }, { id: 'games', label: '경기 목록' }]} />

          {tab === 'team' && (
            team.games === 0 ? <Empty title="아직 기록된 경기가 없어요" hint={isAdmin ? '일정에서 매치를 열고 "경기 기록 입력"을 눌러 보세요.' : '관리자가 경기 기록을 입력하면 여기에 쌓여요.'} /> : (
              <div className="stat-grid">
                <StatCard label="경기당 득점 🎯" value={one(team.avgFor)} unit="골" />
                <StatCard label="경기당 실점 😵" value={one(team.avgAgainst)} unit="골" />
                <StatCard label="무실점 경기 🛡️" value={String(team.cleanSheets)} unit="경기" />
                <StatCard label="무득점 경기 🤐" value={String(team.scoreless)} unit="경기" />
                <StatCard label="다득점 쿼터 🔥" value={String(team.bigQuartersFor)} unit="쿼터" sub="한 쿼터 3골 이상" />
                <StatCard label="다실점 쿼터 ⚠️" value={String(team.bigQuartersAgainst)} unit="쿼터" sub="한 쿼터 3실점 이상" />
                <StatCard label="총 득점" value={String(team.goalsFor)} unit="골" />
                <StatCard label="총 실점" value={String(team.goalsAgainst)} unit="골" />
              </div>
            )
          )}

          {tab === 'player' && (
            <div className="stat-grid">
              {leader('득점왕 🔥', board.goals, '골')}
              {leader('도움왕 🎩', board.assists, '도움')}
              {leader('최다 공격 포인트 🚀', board.points, '점')}
              {leader('최고수비수 🧊', board.defender, '회', v => String(v))}
              {leader('경기당 득점 🔥', board.goalsPerGame, '골', two)}
              {leader('경기당 득점포인트 🚀', board.pointsPerGame, '점', two)}
              {leader('POTM 👑', board.potm, '회')}
              {leader('최다 출전 💪', board.appearances, '경기')}
              <p className="hint stat-note">최고수비수는 무실점 경기에 출전한 수비수 수예요. 경기당 기록은 3경기 이상 뛴 선수만 집계돼요.</p>
            </div>
          )}

          {tab === 'games' && (
            played.length === 0 ? <Empty title="기록된 경기가 없어요" /> : (
              <div className="list-stack">
                {played.map(m => {
                  const h = headToHead(played.filter(x => x.id !== m.id && x.kickoff < m.kickoff), m.opponent);
                  const cls = m.ourScore! > m.oppScore! ? 'win' : m.ourScore! < m.oppScore! ? 'lose' : 'draw';
                  return (
                    <button key={m.id} className="event-row" onClick={() => go(paths.event(m.id))}>
                      <span className={`score ${cls}`}>{m.ourScore}:{m.oppScore}</span>
                      <span className="event-info"><strong>{m.title}</strong><span className="muted small">{formatStamp(m.kickoff)} · {KIND_LABEL[m.kind]}{m.opponent && (h.wins + h.draws + h.losses > 0) ? ` · 이전 맞대결 ${h.wins}승 ${h.draws}무 ${h.losses}패` : ''}</span></span>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </>
      )}
    </>
  );
}
