import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { deleteMatch, fetchAttendance, fetchMembers, fetchPlayerCodes, fetchPublicPageFlag, reissuePlayerCode, setPublicPageFlag } from '../../lib/cloud';
import { playerLink, playerMessage } from '../../lib/pending';
import { adminTodos, needsRecord, nextEvent, type AdminSection } from '../../lib/adminTodos';
import { KIND_COLOR, KIND_LABEL, formatStamp } from '../../lib/matches';
import { socialLinks } from '../../lib/social';
import { useRatings } from '../../lib/ratingsStore';
import { useStore } from '../../lib/store';
import { useTeamData } from '../../lib/teamData';
import { toast } from '../../lib/toast';
import { useAsync } from '../../lib/useAsync';
import type { Attend, Match, MatchStat } from '../../types';
import { AddPlayersSheet } from '../AddPlayers';
import { AdminRosterBody } from '../AdminRoster';
import { IconPlus } from '../Icons';
import { RatingsBody } from '../RatingsSheet';
import { EventForm } from '../team/EventForm';
import { RecordForm } from '../team/RecordForm';
import { JoinCodeCard, MembersCard, TeamNameCard } from '../team/Admin';
import { Empty, Loading } from '../ui';

const goTo = (s: AdminSection) => { location.hash = s === 'overview' ? '#/' : `#/${s}`; };

function Heading({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="adm-head">
      <div><h2>{title}</h2>{sub && <p className="muted small">{sub}</p>}</div>
      {right}
    </div>
  );
}

/** Numbers at a glance, what needs doing, and the invite code. */
export function OverviewSection() {
  const roster = useStore(s => s.roster);
  const teamName = useAuth(s => s.teamName);
  const { matches, loaded, load } = useTeamData();
  const ratings = useRatings();
  const members = useAsync(fetchMembers, []);
  const codes = useAsync(fetchPlayerCodes, []);
  const next = useMemo(() => nextEvent(matches), [matches]);
  const votes = useAsync(() => (next ? fetchAttendance(next.id) : Promise.resolve(null as Record<string, Attend> | null)), [next?.id]);
  useEffect(() => { void load(); ratings.load().catch(() => undefined); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = loaded && !!members.data && ratings.loaded && !!codes.data;
  const unjoined = useMemo(() => {
    if (!codes.data || !members.data) return null;
    const linked = new Set(members.data.map(m => m.playerId).filter(Boolean));
    return roster.filter(p => !codes.data![p.id]?.claimed && !linked.has(p.id)).length;
  }, [codes.data, members.data, roster]);
  const todos = useMemo(() => adminTodos({
    members: members.data ?? [], roster, matches,
    rated: ratings.loaded ? new Set(Object.keys(ratings.data)) : null,
    nextVotes: votes.data ?? null, unjoined,
  }), [members.data, roster, matches, ratings.loaded, ratings.data, votes.data, unjoined]);
  const upcoming = matches.filter(m => m.status === 'scheduled' && new Date(m.kickoff).getTime() >= Date.now()).length;
  const admins = (members.data ?? []).filter(m => m.role === 'admin').length;

  return (
    <>
      <Heading title="개요" sub={`${teamName} 운영 현황`} />
      <div className="adm-tiles">
        <button className="adm-tile" onClick={() => goTo('members')}><small>팀원</small><b>{members.data?.length ?? '–'}</b><span>관리자 {admins}</span></button>
        <button className="adm-tile" onClick={() => goTo('players')}><small>선수</small><b>{roster.length}</b><span>부상 {roster.filter(p => p.out).length}</span></button>
        <button className="adm-tile" onClick={() => goTo('events')}><small>예정 일정</small><b>{loaded ? upcoming : '–'}</b><span>전체 {matches.length}</span></button>
        <button className="adm-tile" onClick={() => goTo('ratings')}><small>능력치 평가</small><b>{ratings.loaded ? Object.keys(ratings.data).length : '–'}<i>/{roster.length}</i></b><span>비공개</span></button>
      </div>

      <section className="card">
        <div className="card-title"><h3>할 일</h3></div>
        {!ready ? <Loading /> : todos.length === 0 ? <p className="muted small" role="status">지금 챙길 일이 없어요. 👍</p> : (
          <ul className="todo-list">
            {todos.map(t => (
              <li key={t.id}>
                <button onClick={() => goTo(t.section)}><b>{t.count}</b><span>{t.text}</span><i aria-hidden>›</i></button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <JoinCodeCard />
    </>
  );
}

export function MembersSection() {
  return (
    <>
      <Heading title="팀원·권한" sub="누가 들어와 있는지, 관리자 권한과 선수 프로필 연결을 관리해요" />
      <MembersCard />
    </>
  );
}

export function PlayersSection() {
  const [adding, setAdding] = useState<'one' | 'many' | null>(null);
  return (
    <>
      <Heading title="선수 관리" sub="등번호·포지션·부상·출생연도, 번호 교체, 선수 삭제"
        right={<div className="btn-row"><button className="btn sm" onClick={() => setAdding('many')}>여러 명 한꺼번에</button><button className="btn sm primary" onClick={() => setAdding('one')}><IconPlus width={15} height={15} /> 선수 추가</button></div>} />
      <section className="card adm-wide"><AdminRosterBody /></section>
      {adding && <AddPlayersSheet start={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

export function CodesSection() {
  const roster = useStore(s => s.roster);
  const teamName = useAuth(s => s.teamName);
  const codes = useAsync(fetchPlayerCodes, []);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useMemo(() => [...roster].sort((a, b) => Number(a.number) - Number(b.number)), [roster]);
  const joined = rows.filter(p => codes.data?.[p.id]?.claimed).length;

  const copy = async (text: string, done: string) => { try { await navigator.clipboard.writeText(text); toast(done); } catch { toast('복사하지 못했어요', 'error'); } };
  const send = async (name: string, code: string) => {
    const text = playerMessage(teamName, name, code);
    try {
      if (navigator.share) await navigator.share({ text });
      else await copy(text, `${name} 선수에게 보낼 안내를 복사했어요`);
    } catch (e) { if ((e as DOMException).name !== 'AbortError') toast('공유하지 못했어요', 'error'); }
  };
  const reissue = async (id: string, name: string, claimed: boolean) => {
    const msg = claimed ? `${name} 선수는 이미 가입했어요. 새 코드를 만들면 그 코드로 비밀번호를 다시 정할 수 있어요. 발급할까요?` : `${name} 선수의 코드를 새로 만들까요? 이전 코드는 쓸 수 없게 돼요.`;
    if (!confirm(msg)) return;
    setBusy(id);
    try { await reissuePlayerCode(id); await codes.reload(); toast('새 코드를 만들었어요'); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  };

  return (
    <>
      <Heading title="선수 코드" sub="선수마다 개인 코드가 있어요. 코드를 입력하고 아이디·비밀번호를 정하면 그 선수로 가입돼요"
        right={codes.data && <span className="adm-score">가입 {joined}/{rows.length}</span>} />
      <p className="warn" role="note">코드는 <b>해당 선수에게만</b> 따로 보내세요. 단체방에 올리면 다른 사람이 그 선수 대신 가입할 수 있어요. 가입 후에는 이 기기에서 자동으로 로그인 상태가 유지돼요.</p>
      {codes.loading && !codes.data && <Loading />}
      {codes.error && !codes.data && <Empty title="코드를 불러오지 못했어요" action={<button className="btn sm" onClick={() => void codes.reload()}>다시 시도</button>} />}
      {rows.length === 0 && <Empty title="선수가 없어요" hint="선수 관리에서 먼저 선수를 추가해 주세요." />}
      <ul className="code-list">
        {codes.data && rows.map(p => {
          const c = codes.data![p.id];
          const state = !c ? '코드 없음' : c.claimed && c.used ? `가입 완료${c.username ? ` · ${c.username}` : ''}` : c.claimed ? '비밀번호 재설정 대기' : '미가입';
          const usable = c && !c.used;
          return (
            <li key={p.id} className="card code-row">
              <div className="code-who"><b>{p.number}</b><strong>{p.name}</strong><em className={`code-state${c?.claimed && c.used ? ' done' : ''}`}>{state}</em></div>
              {usable ? <output className="code-val" aria-label={`${p.name} 코드`}>{c.code}</output> : <span className="muted small code-val none">{c ? '사용 완료' : '–'}</span>}
              <div className="btn-row">
                {usable && <button className="btn sm primary" onClick={() => void send(p.name, c.code)}>보내기</button>}
                {usable && <button className="btn sm ghost" onClick={() => void copy(c.code, '코드를 복사했어요')}>코드 복사</button>}
                {usable && <button className="btn sm ghost" onClick={() => void copy(playerLink(c.code), '가입 링크를 복사했어요')}>링크 복사</button>}
                <button className="btn sm ghost" disabled={busy === p.id} onClick={() => void reissue(p.id, p.name, !!c?.claimed)}>{c?.claimed ? '비밀번호 재설정 코드' : c ? '새 코드' : '코드 만들기'}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function RatingsSection() {
  return (
    <>
      <Heading title="능력치 평가 (비공개)" sub="관리자만 볼 수 있어요. 빠른 선발이 이 점수를 써요" />
      <section className="card adm-wide"><RatingsBody /></section>
    </>
  );
}

type Filter = 'all' | 'upcoming' | 'record' | 'done' | 'cancelled';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' }, { id: 'upcoming', label: '예정' }, { id: 'record', label: '기록 필요' }, { id: 'done', label: '종료' }, { id: 'cancelled', label: '취소' },
];

export function EventsSection() {
  const roster = useStore(s => s.roster);
  const { matches, stats, loaded, error, load } = useTeamData();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Match | 'new' | null>(null);
  const [recording, setRecording] = useState<{ match: Match; votes: Record<string, Attend> } | null>(null);
  useEffect(() => { void load(); }, [load]);

  const owing = useMemo(() => new Set(needsRecord(matches).map(m => m.id)), [matches]);
  const rows = useMemo(() => matches
    .filter(m => filter === 'all' || (filter === 'upcoming' && m.status === 'scheduled' && !owing.has(m.id) && new Date(m.kickoff).getTime() >= Date.now())
      || (filter === 'record' && owing.has(m.id)) || (filter === 'done' && m.status === 'finished') || (filter === 'cancelled' && m.status === 'cancelled'))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff)), [matches, filter, owing]);

  const record = async (m: Match) => {
    const votes = await fetchAttendance(m.id).catch(() => ({} as Record<string, Attend>));
    setRecording({ match: m, votes });
  };
  const remove = async (m: Match) => {
    if (!confirm(`"${m.title}" 일정을 삭제할까요? 참석 투표와 경기 기록도 함께 지워져요.`)) return;
    try { await deleteMatch(m.id); toast('일정을 삭제했어요'); void load(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <Heading title="일정·경기 기록" sub="일정 등록·수정, 경기 결과와 득점 기록 입력"
        right={<button className="btn sm primary" onClick={() => setEditing('new')}><IconPlus width={15} height={15} /> 새 일정</button>} />
      <div className="chips" role="radiogroup" aria-label="보기">
        {FILTERS.map(f => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={`chip${filter === f.id ? ' on' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}{f.id === 'record' && owing.size > 0 ? ` ${owing.size}` : ''}
          </button>
        ))}
      </div>
      {!loaded && !error && <Loading />}
      {error && !loaded && <Empty title="일정을 불러오지 못했어요" action={<button className="btn sm" onClick={() => void load()}>다시 시도</button>} />}
      {loaded && rows.length === 0 && <Empty title="해당하는 일정이 없어요" />}
      <div className="adm-events">
        {rows.map(m => (
          <article key={m.id} className="adm-event card">
            <div className="adm-ev-main">
              <em className="kind" style={{ background: KIND_COLOR[m.kind] }}>{KIND_LABEL[m.kind]}</em>
              {m.status === 'cancelled' && <em className="kind off">취소됨</em>}
              {m.status === 'finished' && <em className="kind done">종료</em>}
              {owing.has(m.id) && <em className="kind warnk">기록 필요</em>}
              <strong>{m.title}</strong>
              <span className="muted small">{formatStamp(m.kickoff)}{m.venue ? ` · ${m.venue}` : ''}</span>
              {m.status === 'finished' && m.ourScore != null && <span className="adm-score">{m.ourScore} : {m.oppScore}</span>}
            </div>
            <div className="btn-row">
              {m.kind === 'match' && m.status !== 'cancelled' && <button className={`btn sm${owing.has(m.id) ? ' primary' : ''}`} onClick={() => void record(m)}>{m.status === 'finished' ? '기록 수정' : '기록 입력'}</button>}
              <button className="btn sm ghost" onClick={() => setEditing(m)}>수정</button>
              <a className="btn sm ghost" href={`/#/m/${encodeURIComponent(m.id)}`}>앱에서 보기</a>
              <button className="btn sm ghost danger" onClick={() => void remove(m)}>삭제</button>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <EventForm match={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }} onDeleted={() => { setEditing(null); void load(); }} />
      )}
      {recording && (
        <RecordForm match={recording.match} roster={roster} stats={stats.filter((s: MatchStat) => s.matchId === recording.match.id)} votes={recording.votes}
          onClose={() => setRecording(null)} onSaved={() => { setRecording(null); void load(); }} />
      )}
    </>
  );
}

/** Switch for /info and a plain list of what it does and does not show. */
function PublicPageCard() {
  const flag = useAsync(fetchPublicPageFlag, []);
  const [busy, setBusy] = useState(false);
  const url = `${location.origin}/info`;
  const toggle = async (on: boolean) => {
    const before = flag.data;
    flag.setData(on); // flips at once; put back if saving fails
    setBusy(true);
    try { await setPublicPageFlag(on); toast(on ? '공개 페이지를 켰어요' : '공개 페이지를 껐어요'); } catch (e) { flag.setData(before ?? !on); toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  return (
    <section className="card">
      <div className="card-title">
        <h3>공개 페이지</h3>
        <label className="switch">
          <input type="checkbox" aria-label="공개 페이지 사용" checked={flag.data ?? true} disabled={busy || flag.data === undefined || flag.data === null} onChange={e => void toggle(e.target.checked)} />
          <i />
        </label>
      </div>
      <p className="hint">로그인 없이 누구나 볼 수 있는 페이지예요. 링크를 SNS 프로필 등에 올려도 돼요.</p>
      <p><b className="small">보여주는 것</b> <span className="muted small">팀 이름, 올해 전적(경기·승률·득실점), 최근 경기 결과(스코어·상대·날짜·장소), 다가오는 경기(상대·날짜·장소), 인스타·유튜브 링크</span></p>
      <p><b className="small">보여주지 않는 것</b> <span className="muted small">선수 이름과 기록, 참석 투표, 전술, 팀원, 게시판, 능력치, 일정 메모, 회식·연습 일정</span></p>
      <div className="btn-row">
        <a className="btn sm primary" href="/info" target="_blank" rel="noopener noreferrer">열어보기</a>
        <button className="btn sm ghost" onClick={async () => { try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요'); } catch { toast('복사하지 못했어요', 'error'); } }}>링크 복사</button>
        <span className="muted small pub-url">{url}</span>
      </div>
    </section>
  );
}

export function SettingsSection() {
  const user = useAuth(s => s.user);
  const signOut = useAuth(s => s.signOut);
  const social = socialLinks();
  return (
    <>
      <Heading title="구단 설정" />
      <TeamNameCard />
      <JoinCodeCard />
      <PublicPageCard />
      <section className="card">
        <div className="card-title"><h3>설정 마법사</h3></div>
        <p className="hint">구단 이름, 선수 등록, 첫 일정, 팀원 초대를 한 화면씩 차례로 다시 진행해요.</p>
        <a className="btn ghost sm" href="/#/setup">마법사 열기</a>
      </section>
      <section className="card">
        <div className="card-title"><h3>공식 채널</h3></div>
        <p className="hint">홈 화면의 바로가기 카드에 쓰이는 주소예요. 바꾸려면 배포 환경변수(VITE_INSTAGRAM_HANDLE, VITE_YOUTUBE_HANDLE, 유튜브 최신 영상은 VITE_YOUTUBE_CHANNEL_ID)를 수정해요.</p>
        <ul className="adm-links">
          <li><b>Instagram</b> <a className="link" href={social.instagram.url} target="_blank" rel="noopener noreferrer">@{social.instagram.handle}</a></li>
          <li><b>YouTube</b> <a className="link" href={social.youtube.url} target="_blank" rel="noopener noreferrer">@{social.youtube.handle}</a>{social.youtube.uploadsEmbed ? ' · 최신 영상 재생 켜짐' : ''}</li>
        </ul>
      </section>
      <section className="card">
        <div className="card-title"><h3>내 계정</h3></div>
        <p className="muted small">{user?.email}</p>
        <button className="btn ghost sm" onClick={() => void signOut()}>로그아웃</button>
      </section>
    </>
  );
}
