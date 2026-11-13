import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { fetchMembers, linkMyPlayer, setMyNickname } from '../../lib/cloud';
import { useStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { useAsync } from '../../lib/useAsync';
import { Loading, PageHeader } from '../ui';

export function MePage() {
  const user = useAuth(s => s.user);
  const member = useAuth(s => s.member);
  const isAdmin = useAuth(s => s.isAdmin);
  const refresh = useAuth(s => s.refresh);
  const signOut = useAuth(s => s.signOut);
  const roster = useStore(s => s.roster);
  const members = useAsync(fetchMembers, []);
  const [nick, setNick] = useState(member?.nickname ?? '');
  const me = roster.find(p => p.id === member?.playerId);
  const taken = new Set((members.data ?? []).map(m => m.playerId).filter(Boolean));

  const link = async (id: string) => {
    try { await linkMyPlayer(id); await refresh(); toast('선수 프로필을 연결했어요'); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <PageHeader title="내 프로필" back="#/more" />
      <section className="card">
        <div className="profile-id"><strong>{user?.email}</strong><em className={`badge ${member?.role}`}>{isAdmin ? '관리자' : '선수'}</em></div>
      </section>

      <section className="card">
        <div className="card-title"><h3>선수 프로필</h3></div>
        {me ? (
          <div className="me-player"><b>{me.number}</b><div><strong>{me.name}</strong><span className="muted small">{me.pos}{me.altPos?.length ? ` · 겸임 ${me.altPos.join('/')}` : ''}</span></div></div>
        ) : members.loading && !members.data ? <Loading /> : (
          <>
            <p className="hint">내 선수 프로필을 연결하면 참석 투표와 댓글이 내 이름으로 남아요. 연결을 바꾸려면 관리자에게 요청해 주세요.</p>
            <div className="picker-list">
              {roster.filter(p => !taken.has(p.id)).map(p => (
                <button key={p.id} className="picker-row" onClick={() => void link(p.id)}>
                  <span className="pk-num">{p.number}</span><span className="pk-name">{p.name}</span><span className="pk-pos">{p.pos}</span><span />
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-title"><h3>닉네임</h3></div>
        <p className="hint">선수 프로필이 없을 때 글과 댓글에 표시돼요.</p>
        <form className="field-row" onSubmit={async e => { e.preventDefault(); try { await setMyNickname(nick); await refresh(); toast('저장했어요'); } catch (err) { toast((err as Error).message, 'error'); } }}>
          <input className="text-in" value={nick} maxLength={20} onChange={e => setNick(e.target.value)} aria-label="닉네임" />
          <button className="btn primary" type="submit">저장</button>
        </form>
      </section>

      <button className="btn ghost danger block" onClick={() => void signOut()}>로그아웃</button>
    </>
  );
}
