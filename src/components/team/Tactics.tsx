import { useState } from 'react';
import { fetchPublicTactics } from '../../lib/cloud';
import { buildScene } from '../../lib/scene';
import { go, paths } from '../../lib/route';
import { useAuth } from '../../lib/auth';
import { useStore } from '../../lib/store';
import { useAsync } from '../../lib/useAsync';
import type { Player, Tactic } from '../../types';
import { IconPlus } from '../Icons';
import { Menu } from '../Menu';
import { Pitch } from '../Pitch';
import { Empty, Loading, PageHeader, Segmented } from '../ui';

export function Thumb({ t, roster }: { t: Tactic; roster: Player[] }) {
  return (
    <span className="thumb" aria-hidden>
      <Pitch mini interactive={false} scene={buildScene(t, roster, t.frames[0].positions, null)} />
    </span>
  );
}

const when = (t: Tactic) => new Date(t.updatedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

export function TacticsPage() {
  const isAdmin = useAuth(s => s.isAdmin);
  const tactics = useStore(s => s.tactics);
  const roster = useStore(s => s.roster);
  const add = useStore(s => s.addTactic);
  const dup = useStore(s => s.duplicateTactic);
  const del = useStore(s => s.deleteTactic);
  const shared = useAsync(fetchPublicTactics, []);
  const [tab, setTab] = useState<'team' | 'mine'>('team');

  return (
    <>
      <PageHeader title="전술 보드" right={<button className="btn sm primary" onClick={() => go(paths.editor(add()))}><IconPlus width={15} height={15} /> 새 전술</button>} />
      <Segmented<'team' | 'mine'> label="전술 목록" value={tab} onChange={setTab} options={[{ id: 'team', label: '팀 공유' }, { id: 'mine', label: isAdmin ? '내 전술' : '내 복사본' }]} />

      {tab === 'team' && (
        <>
          {shared.loading && !shared.data && <Loading />}
          {shared.error && !shared.data && <Empty title="불러오지 못했어요" action={<button className="btn sm" onClick={() => void shared.reload()}>다시 시도</button>} />}
          {shared.data?.length === 0 && <Empty title="공유된 전술이 없어요" hint="관리자가 전술을 팀에 공유하면 여기에 나타나요." />}
          <div className="list-stack">
            {shared.data?.map(t => (
              <a key={t.id} className="tactic-row link" href={paths.shared(t.id)}>
                <span className="tactic-main"><Thumb t={t} roster={roster} />
                  <span className="tactic-info"><strong>{t.name}</strong><span>{t.us.formation}{t.opp ? ` vs ${t.opp.formation}` : ''} · 장면 {t.frames.length}</span><span className="muted">{when(t)} 수정</span></span></span>
              </a>
            ))}
          </div>
        </>
      )}

      {tab === 'mine' && (
        <>
          {tactics.length === 0 && <Empty title={isAdmin ? '아직 만든 전술이 없어요' : '복사해 둔 전술이 없어요'} hint={isAdmin ? '새 전술을 만들고 "팀 공유"로 바꾸면 팀원이 볼 수 있어요.' : '팀 공유 전술을 열어 "내 전술로 복사"하면 여기서 마음대로 고쳐 볼 수 있어요.'} />}
          <div className="list-stack">
            {tactics.map(t => (
              <div className="tactic-row" key={t.id}>
                <button className="tactic-main" onClick={() => go(paths.editor(t.id))}>
                  <Thumb t={t} roster={roster} />
                  <span className="tactic-info"><strong>{t.name}{t.isPublic && <em className="badge">팀 공유</em>}</strong><span>{t.us.formation}{t.opp ? ` vs ${t.opp.formation}` : ''} · 장면 {t.frames.length}</span><span className="muted">{when(t)} 수정</span></span>
                </button>
                <Menu label={`${t.name} 메뉴`} items={[
                  { label: '복제', onClick: () => dup(t.id) },
                  { label: '삭제', danger: true, onClick: () => confirm(`"${t.name}"을 삭제할까요?${isAdmin ? ' 서버에서도 삭제돼요.' : ''}`) && del(t.id) },
                ]} />
              </div>
            ))}
          </div>
          {!isAdmin && <p className="hint">복사본은 이 기기에만 저장돼요.</p>}
        </>
      )}
    </>
  );
}
