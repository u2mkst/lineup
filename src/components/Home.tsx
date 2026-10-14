import { useRef, useState } from 'react';
import { buildScene } from '../lib/scene';
import { useInstall } from '../lib/pwa';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import { IconCopy, IconDownload, IconPlus, IconTrash } from './Icons';
import { Pitch } from './Pitch';
import { RosterEditor } from './RosterEditor';

export function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const tactics = useStore(s => s.tactics);
  const roster = useStore(s => s.roster);
  const add = useStore(s => s.addTactic);
  const dup = useStore(s => s.duplicateTactic);
  const del = useStore(s => s.deleteTactic);
  const importBackup = useStore(s => s.importBackup);
  const [rosterOpen, setRosterOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { mode, install } = useInstall();

  const backup = () => {
    const blob = new Blob([JSON.stringify({ app: 'chukgubang', version: 2, roster, tactics }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `축구방-백업-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    toast('백업 파일을 저장했어요');
  };
  const restore = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = importBackup(JSON.parse(await f.text()));
      toast(n > 0 ? `전술 ${n}개를 불러왔어요` : '새로 추가할 전술이 없어요');
    } catch (e) {
      toast((e as Error).message || '백업 파일을 읽지 못했어요', 'error');
    }
    if (file.current) file.current.value = '';
  };

  return (
    <div className="home">
      <header className="hero">
        <div className="logo" aria-hidden>⚽</div>
        <h1>축구방</h1>
        <p>라인업을 짜고, 전술을 움직여 보세요.</p>
        <div className="row center gap">
          <button className="btn primary lg" onClick={() => onOpen(add())}><IconPlus width={18} height={18} /> 새 전술 만들기</button>
          <button className="btn ghost lg" onClick={() => setRosterOpen(true)}>선수 명단</button>
        </div>
      </header>

      {mode && (
        <div className="install card">
          <div>
            <strong>앱처럼 설치해서 쓰기</strong>
            <p className="muted small">{mode === 'ios' ? '공유 버튼 → "홈 화면에 추가"를 눌러 주세요. 오프라인에서도 열려요.' : '홈 화면에 추가하면 바로 열 수 있고 오프라인에서도 동작해요.'}</p>
          </div>
          {mode === 'native' && <button className="btn sm primary" onClick={install}>설치</button>}
        </div>
      )}

      <section className="list">
        <h2>내 전술</h2>
        {tactics.length === 0 && (
          <div className="empty-msg">
            <p>아직 만든 전술이 없어요.</p>
            <p className="muted small">새 전술을 만들고 라인업을 짠 뒤, 전술 탭에서 장면을 이어 붙여 보세요.</p>
          </div>
        )}
        {tactics.map(t => (
          <div className="tactic-row" key={t.id}>
            <button className="tactic-main" onClick={() => onOpen(t.id)}>
              <span className="thumb" aria-hidden>
                <Pitch mini interactive={false} scene={buildScene(t, roster, t.frames[0].positions, null)} />
              </span>
              <span className="tactic-info">
                <strong>{t.name}</strong>
                <span>
                  {t.us.formation}{t.opp ? ` vs ${t.opp.formation}` : ''} · 장면 {t.frames.length}개
                </span>
                <span>{new Date(t.updatedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 수정</span>
              </span>
            </button>
            <button className="icon-btn" aria-label={`${t.name} 복제`} onClick={() => dup(t.id)}><IconCopy /></button>
            <button className="icon-btn" aria-label={`${t.name} 삭제`} onClick={() => confirm(`"${t.name}"을 삭제할까요?`) && del(t.id)}><IconTrash /></button>
          </div>
        ))}
      </section>

      <footer className="backup">
        <button className="btn sm ghost" onClick={backup} disabled={tactics.length === 0}><IconDownload width={15} height={15} /> 백업 저장</button>
        <button className="btn sm ghost" onClick={() => file.current?.click()}>백업 불러오기</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => restore(e.target.files?.[0])} />
        <p className="muted small">전술은 이 기기의 브라우저에 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지울 땐 백업을 받아 두세요.</p>
      </footer>
      {rosterOpen && <RosterEditor onClose={() => setRosterOpen(false)} />}
    </div>
  );
}
