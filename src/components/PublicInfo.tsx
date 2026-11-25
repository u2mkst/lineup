import { useEffect, useState } from 'react';
import { fetchPublicOverview } from '../lib/cloud';
import { formatStamp } from '../lib/matches';
import { OUTCOME_LABEL, type Outcome } from '../lib/dashboard';
import { cloudEnabled } from '../lib/supabase';
import type { PublicOverview } from '../types';
import { IconLogo, IconMapPin } from './Icons';
import { SocialCards } from './team/Dashboard';

/** True for /info: the page anyone can open without logging in. */
export const isInfoPath = (pathname = location.pathname) => /^\/info\/?$/.test(pathname);

const outcome = (us: number, opp: number): Outcome => (us > opp ? 'win' : us < opp ? 'lose' : 'draw');

/**
 * Public page: only what the club is happy to show anyone. No player names or stats, no attendance, tactics,
 * members or notes — the database function behind it never returns them.
 */
export function PublicInfo() {
  const [data, setData] = useState<PublicOverview | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    fetchPublicOverview().then(setData).catch(() => setFailed(true));
  };
  useEffect(() => { if (cloudEnabled) load(); }, []);
  useEffect(() => { document.title = data?.name ? `${data.name} 공개 페이지` : '공개 페이지'; }, [data?.name]);

  const rec = data?.record;
  const winRate = rec && rec.games ? Math.round((rec.wins / rec.games) * 100) : 0;
  const diff = rec ? rec.goalsFor - rec.goalsAgainst : 0;

  return (
    <div className="pub">
      <header className="pub-head">
        <IconLogo width={84} height={106} />
        <div>
          <small className="muted">{data?.enabled ? '공개 정보' : '안내'}</small>
          <h1>{data?.name || '연무 FC'}</h1>
        </div>
        <a className="btn primary" href="/">팀원 로그인</a>
      </header>

      {!cloudEnabled && <p className="muted small">서버에 연결돼 있지 않아요.</p>}
      {cloudEnabled && !data && !failed && <p className="muted small empty-msg" role="status">불러오는 중…</p>}
      {failed && (
        <section className="card">
          <p>정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.</p>
          <button className="btn sm" onClick={load}>다시 시도</button>
        </section>
      )}

      {data && !data.enabled && (
        <section className="card"><p className="muted">지금은 공개 정보를 보여주지 않아요.</p></section>
      )}

      {data?.enabled && rec && (
        <>
          <section className="card" aria-label="시즌 전적">
            <div className="card-title"><h3>{rec.year} 시즌</h3></div>
            {rec.games === 0 ? <p className="muted small">아직 끝난 경기가 없어요.</p> : (
              <>
                <div className="kpi-grid">
                  <div><small>경기</small><b>{rec.games}</b></div>
                  <div><small>승률</small><b>{winRate}<span>%</span></b></div>
                  <div><small>득점</small><b>{rec.goalsFor}</b></div>
                  <div><small>실점</small><b>{rec.goalsAgainst}</b></div>
                </div>
                <div className="kpi-foot">
                  <span className="wdl"><b className="win">{rec.wins}승</b> <b className="draw">{rec.draws}무</b> <b className="lose">{rec.losses}패</b></span>
                  <span className="muted small">득실차 {diff > 0 ? `+${diff}` : diff}</span>
                </div>
              </>
            )}
          </section>

          {(data.upcoming?.length ?? 0) > 0 && (
            <section className="card" aria-label="다가오는 경기">
              <div className="card-title"><h3>다가오는 경기</h3></div>
              <ul className="pub-list">
                {data.upcoming!.map((m, i) => (
                  <li key={i}>
                    <strong>vs {m.opponent}</strong>
                    <span>{formatStamp(m.kickoff)}</span>
                    {m.venue && <span className="muted small"><IconMapPin width={13} height={13} /> {m.venue}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card" aria-label="경기 결과">
            <div className="card-title"><h3>경기 결과</h3></div>
            {(data.results?.length ?? 0) === 0 ? <p className="muted small">아직 끝난 경기가 없어요.</p> : (
              <ul className="result-list pub-results">
                {data.results!.map((m, i) => {
                  const o = outcome(m.ourScore, m.oppScore);
                  return (
                    <li key={i}>
                      <div className="pub-row">
                        <span className={`res-badge ${o}`}>{OUTCOME_LABEL[o]}</span>
                        <span className="res-main">
                          <strong>vs {m.opponent}</strong>
                          <small className="muted">{formatStamp(m.kickoff).slice(0, 13)}{m.venue ? ` · ${m.venue}` : ''}</small>
                        </span>
                        <span className={`score ${o}`}>{m.ourScore}:{m.oppScore}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <SocialCards />

      <footer className="pub-foot">
        <p className="muted small">선수 기록·참석 투표·전술 등 팀원 전용 정보는 로그인한 뒤에만 볼 수 있어요.</p>
        <a className="link" href="/">팀원 로그인 · 선수 코드로 가입</a>
      </footer>
    </div>
  );
}
