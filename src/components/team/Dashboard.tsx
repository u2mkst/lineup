import { useMemo, useState } from 'react';
import { OUTCOME_LABEL, form, recentResults, scoreboard, type ScoreKind } from '../../lib/dashboard';
import { formatStamp } from '../../lib/matches';
import { paths } from '../../lib/route';
import { socialLinks } from '../../lib/social';
import { useStore } from '../../lib/store';
import { isPlayed, seasons, teamStats } from '../../lib/stats';
import type { Match, MatchStat } from '../../types';
import { IconChevronRight, IconExternal, IconInstagram, IconYoutube } from '../Icons';
import { Segmented } from '../ui';

interface Props {
  matches: Match[];
  stats: MatchStat[];
  season: number;
  onSeason: (y: number) => void;
}

/** Season at a glance: tiles for the record and goals, plus the last five results as a form strip. */
export function SeasonTiles({ matches, season, onSeason }: Pick<Props, 'matches' | 'season' | 'onSeason'>) {
  const years = useMemo(() => {
    const ys = new Set(seasons(matches.filter(isPlayed)));
    ys.add(season);
    return [...ys].sort((a, b) => b - a);
  }, [matches, season]);
  const t = useMemo(() => teamStats(matches.filter(m => new Date(m.kickoff).getFullYear() === season)), [matches, season]);
  const strip = useMemo(() => form(matches, season), [matches, season]);
  const diff = t.goalsFor - t.goalsAgainst;

  return (
    <section className="card dash-kpi" aria-label={`${season} 시즌 요약`}>
      <div className="card-title">
        <h3>{season} 시즌</h3>
        {years.length > 1 && (
          <select className="season-select" value={season} aria-label="시즌 선택" onChange={e => onSeason(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>
      {t.games === 0 ? <p className="muted small">아직 기록된 경기가 없어요. 경기가 끝나면 여기에 쌓여요.</p> : (
        <>
          <div className="kpi-grid">
            <div><small>경기</small><b>{t.games}</b></div>
            <div><small>승률</small><b>{Math.round(t.winRate * 100)}<span>%</span></b></div>
            <div><small>득점</small><b>{t.goalsFor}</b></div>
            <div><small>실점</small><b>{t.goalsAgainst}</b></div>
          </div>
          <div className="kpi-foot">
            <span className="wdl"><b className="win">{t.wins}승</b> <b className="draw">{t.draws}무</b> <b className="lose">{t.losses}패</b></span>
            <span className="muted small">득실차 {diff > 0 ? `+${diff}` : diff}</span>
            {strip.length > 0 && (
              <span className="form" role="img" aria-label={`최근 ${strip.length}경기 ${strip.map(o => OUTCOME_LABEL[o]).join(' ')}`}>
                {strip.map((o, i) => <i key={i} className={o}>{OUTCOME_LABEL[o]}</i>)}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** The latest finished matches: score, result and who scored. */
export function ResultsCard({ matches, stats, season }: Pick<Props, 'matches' | 'stats' | 'season'>) {
  const roster = useStore(s => s.roster);
  const rows = useMemo(() => recentResults(matches, stats, roster, season, 5), [matches, stats, roster, season]);
  return (
    <section className="card" aria-label="경기 결과">
      <div className="card-title"><h3>경기 결과</h3><a className="more-link" href={paths.records}>전체 <IconChevronRight width={14} height={14} /></a></div>
      {rows.length === 0 ? <p className="muted small">{season}년에 끝난 경기가 아직 없어요.</p> : (
        <ul className="result-list">
          {rows.map(({ match: m, outcome, scorers }) => (
            <li key={m.id}>
              <a href={paths.event(m.id)}>
                <span className={`res-badge ${outcome}`}>{OUTCOME_LABEL[outcome]}</span>
                <span className="res-main">
                  <strong>{m.opponent ? `vs ${m.opponent}` : m.title}</strong>
                  <small className="muted">{formatStamp(m.kickoff).slice(0, 13)}{m.venue ? ` · ${m.venue}` : ''}</small>
                  {scorers.length > 0 && <small className="res-scorers">⚽ {scorers.map(s => (s.goals > 1 ? `${s.name} ${s.goals}` : s.name)).join(' · ')}</small>}
                </span>
                <span className={`score ${outcome}`}>{m.ourScore}:{m.oppScore}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const KIND_LABEL: Record<ScoreKind, string> = { goals: '골', assists: '도움', points: '공격P' };

/** Top scorers / assisters / attacking points of the season. */
export function ScoringCard({ matches, stats, season }: Pick<Props, 'matches' | 'stats' | 'season'>) {
  const roster = useStore(s => s.roster);
  const [kind, setKind] = useState<ScoreKind>('goals');
  const rows = useMemo(() => scoreboard(matches, stats, roster, season, kind, 5), [matches, stats, roster, season, kind]);
  const max = rows[0]?.value ?? 1;
  const player = (id: string) => roster.find(p => p.id === id);
  return (
    <section className="card" aria-label="득점 기록">
      <div className="card-title"><h3>득점 기록</h3><a className="more-link" href={paths.records}>전체 <IconChevronRight width={14} height={14} /></a></div>
      <Segmented<ScoreKind> label="기록 종류" value={kind} onChange={setKind} options={[{ id: 'goals', label: '득점' }, { id: 'assists', label: '도움' }, { id: 'points', label: '공격포인트' }]} />
      {rows.length === 0 ? <p className="muted small">아직 {KIND_LABEL[kind]} 기록이 없어요.</p> : (
        <ol className="rank-list">
          {rows.map(r => {
            const p = player(r.playerId)!;
            return (
              <li key={r.playerId} className={r.rank === 1 ? 'top' : ''}>
                <span className="rk">{r.rank}</span>
                <span className="pn"><b>{p.number}</b> {p.name}</span>
                <span className="rbar" aria-hidden><i style={{ width: `${Math.max(8, (r.value / max) * 100)}%` }} /></span>
                <strong className="rv">{r.value}<small>{KIND_LABEL[kind]}</small></strong>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Links to the club's Instagram and YouTube; the latest uploads play inline when the channel id is configured. */
export function SocialCards() {
  const s = useMemo(() => socialLinks(), []);
  return (
    <section className="social" aria-label="공식 채널">
      <a className="soc ig" href={s.instagram.url} target="_blank" rel="noopener noreferrer">
        <IconInstagram width={26} height={26} />
        <span><strong>Instagram</strong><small>@{s.instagram.handle}</small></span>
        <IconExternal width={16} height={16} />
      </a>
      <a className="soc yt" href={s.youtube.url} target="_blank" rel="noopener noreferrer">
        <IconYoutube width={28} height={28} />
        <span><strong>YouTube</strong><small>@{s.youtube.handle}</small></span>
        <IconExternal width={16} height={16} />
      </a>
      {s.youtube.uploadsEmbed && (
        <div className="yt-embed">
          <iframe src={s.youtube.uploadsEmbed} title={`${s.youtube.handle} 최신 영상`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
            allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        </div>
      )}
    </section>
  );
}
