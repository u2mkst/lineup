import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { inviteMessage } from '../../lib/pending';
import { go, paths } from '../../lib/route';
import { fetchJoinCode, fetchMembers, regenerateJoinCode, removeMember, renameTeam, setMemberPlayer, setMemberRole } from '../../lib/cloud';
import { useStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { useAsync } from '../../lib/useAsync';
import type { Member } from '../../types';
import { IconKey } from '../Icons';
import { Menu } from '../Menu';
import { Sheet } from '../Sheet';
import { Empty, Loading, PageHeader } from '../ui';

function JoinCodeCard() {
  const code = useAsync(fetchJoinCode, []);
  const teamName = useAuth(s => s.teamName);
  const [busy, setBusy] = useState(false);

  const message = inviteMessage(teamName, code.data ?? '');
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: message });
      else { await navigator.clipboard.writeText(message); toast('합류 안내를 복사했어요. 단체방에 붙여넣어 주세요'); }
    } catch (e) { if ((e as DOMException).name !== 'AbortError') toast('공유하지 못했어요', 'error'); }
  };
  const renew = async () => {
    if (!confirm('합류코드를 새로 만들까요? 이전 코드로는 더 이상 합류할 수 없어요. 이미 합류한 팀원은 그대로예요.')) return;
    setBusy(true);
    try { code.setData(await regenerateJoinCode()); toast('합류코드를 새로 만들었어요'); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <section className="card">
      <div className="card-title"><h3><IconKey width={16} height={16} /> 합류코드</h3></div>
      {code.loading && !code.data ? <Loading /> : <output className="join-code" aria-label="합류코드">{code.data || '-'}</output>}
      <p className="hint">팀원은 가입한 뒤 이 코드를 입력해야 구단 정보를 볼 수 있어요. 코드가 밖으로 퍼졌다면 새로 만드세요.</p>
      <div className="btn-row">
        <button className="btn primary sm" onClick={() => void share()} disabled={!code.data}>합류 안내 보내기</button>
        <button className="btn ghost sm" onClick={async () => { await navigator.clipboard.writeText(code.data ?? '').catch(() => undefined); toast('코드를 복사했어요'); }} disabled={!code.data}>코드 복사</button>
        <button className="btn ghost sm danger" onClick={() => void renew()} disabled={busy}>코드 재발급</button>
      </div>
    </section>
  );
}

function LinkSheet({ member, taken, onClose, onDone }: { member: Member; taken: Set<string>; onClose: () => void; onDone: () => void }) {
  const roster = useStore(s => s.roster);
  const pick = async (id: string | null) => {
    try { await setMemberPlayer(member.userId, id); toast(id ? '선수를 연결했어요' : '연결을 해제했어요'); onDone(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <Sheet title="선수 프로필 연결" onClose={onClose}>
      <div className="picker-list">
        {roster.filter(p => !taken.has(p.id) || p.id === member.playerId).map(p => (
          <button key={p.id} className={`picker-row${p.id === member.playerId ? ' on' : ''}`} onClick={() => void pick(p.id)}>
            <span className="pk-num">{p.number}</span><span className="pk-name">{p.name}</span><span className="pk-pos">{p.pos}</span><span />
          </button>
        ))}
      </div>
      {member.playerId && <button className="btn ghost danger" onClick={() => void pick(null)}>연결 해제</button>}
    </Sheet>
  );
}

export function AdminPage() {
  const teamName = useAuth(s => s.teamName);
  const me = useAuth(s => s.member);
  const refresh = useAuth(s => s.refresh);
  const roster = useStore(s => s.roster);
  const members = useAsync(fetchMembers, []);
  const [name, setName] = useState(teamName);
  const [linking, setLinking] = useState<Member | null>(null);

  const label = (m: Member, i: number) => roster.find(p => p.id === m.playerId)?.name ?? (m.nickname || `팀원 ${i + 1}`);
  const run = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); toast(ok); await members.reload(); await refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const taken = new Set((members.data ?? []).map(m => m.playerId).filter((x): x is string => !!x));

  return (
    <>
      <PageHeader title="구단 관리" back="#/more" />
      <section className="card">
        <div className="card-title"><h3>구단 이름</h3></div>
        <form className="field-row" onSubmit={e => { e.preventDefault(); if (name.trim()) void run(() => renameTeam(name), '구단 이름을 바꿨어요'); }}>
          <input className="text-in" value={name} maxLength={30} onChange={e => setName(e.target.value)} aria-label="구단 이름" />
          <button className="btn primary" type="submit" disabled={!name.trim() || name.trim() === teamName}>저장</button>
        </form>
      </section>

      <JoinCodeCard />

      <section className="card">
        <div className="card-title"><h3>설정 마법사</h3></div>
        <p className="hint">구단 이름, 선수 등록, 첫 일정, 팀원 초대를 한 화면씩 차례로 다시 진행해요.</p>
        <button className="btn ghost sm" onClick={() => go(paths.setup())}>마법사 열기</button>
      </section>

      <section className="card">
        <div className="card-title"><h3>팀원 {members.data ? members.data.length : ''}</h3></div>
        {members.loading && !members.data && <Loading />}
        {members.data?.length === 0 && <Empty title="팀원이 없어요" />}
        <ul className="member-list">
          {members.data?.map((m, i) => {
            const self = m.userId === me?.userId;
            return (
              <li key={m.userId}>
                <span className="member-name"><strong>{label(m, i)}</strong>{self && <em className="badge">나</em>}<em className={`badge ${m.role}`}>{m.role === 'admin' ? '관리자' : '선수'}</em></span>
                <span className="muted small">{m.playerId ? '선수 프로필 연결됨' : '선수 프로필 미연결'}</span>
                <Menu label={`${label(m, i)} 메뉴`} items={[
                  { label: '선수 프로필 연결', onClick: () => setLinking(m) },
                  m.role === 'admin' ? { label: '선수로 변경', onClick: () => confirm('관리자 권한을 내릴까요?') && void run(() => setMemberRole(m.userId, 'player'), '선수로 바꿨어요') } : { label: '관리자로 지정', onClick: () => confirm(`${label(m, i)}님을 관리자로 지정할까요? 선수단·일정·기록을 수정할 수 있게 돼요.`) && void run(() => setMemberRole(m.userId, 'admin'), '관리자로 지정했어요') },
                  ...(self ? [] : [{ label: '구단에서 내보내기', danger: true, onClick: () => confirm(`${label(m, i)}님을 구단에서 내보낼까요?`) && void run(() => removeMember(m.userId), '내보냈어요') }]),
                ]} />
              </li>
            );
          })}
        </ul>
      </section>
      {linking && <LinkSheet member={linking} taken={taken} onClose={() => setLinking(null)} onDone={() => { setLinking(null); void members.reload(); void refresh(); }} />}
    </>
  );
}
