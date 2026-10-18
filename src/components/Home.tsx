import { useRef, useState } from 'react';
import { buildScene } from '../lib/scene';
import { useInstall } from '../lib/pwa';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import { IconDownload, IconLogo, IconPlus, IconSettings, IconUsers } from './Icons';
import { Menu } from './Menu';
import { Pitch } from './Pitch';
import { RosterEditor } from './RosterEditor';
import { Sheet } from './Sheet';

export function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const tactics = useStore(s => s.tactics);
  const roster = useStore(s => s.roster);
  const add = useStore(s => s.addTactic);
  const dup = useStore(s => s.duplicateTactic);
  const del = useStore(s => s.deleteTactic);
  const importBackup = useStore(s => s.importBackup);
  const [settings, setSettings] = useState(false);
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
      setSettings(false);
    } catch (e) {
      toast((e as Error).message || '백업 파일을 읽지 못했어요', 'error');
    }
    if (file.current) file.current.value = '';
  };

  return (
    <div className="home">
      <header className="home-bar">
        <div className="brand"><IconLogo /><span>축구방</span></div>
        <button className="icon-btn" aria-label="설정" onClick={() => setSettings(true)}><IconSettings /></button>
      </header>

      <section className="home-hero">
        <h1>오늘은 어떤 전술을<br />준비할까요?</h1>
        <button className="btn primary lg block" onClick={() => onOpen(add())}><IconPlus width={18} height={18} /> 새 전술 만들기</button>
      </section>

      {mode && (
        <div className="notice">
          <div>
            <strong>앱처럼 설치해서 쓰기</strong>
            <p>{mode === 'ios' ? '공유 버튼 → "홈 화면에 추가"를 눌러 주세요.' : '홈 화면에 추가하면 바로 열 수 있고 오프라인에서도 동작해요.'}</p>
          </div>
          {mode === 'native' && <button className="btn sm primary" onClick={install}>설치</button>}
        </div>
      )}

      <section className="list">
        <h2>내 전술 <span className="count">{tactics.length}</span></h2>
        {tactics.length === 0 && (
          <div className="empty-msg">
            <p>아직 만든 전술이 없어요</p>
            <p className="muted small">라인업을 짜고, 전술 탭에서 장면을 이어 붙여 보세요.</p>
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
                <span>{t.us.formation}{t.opp ? ` vs ${t.opp.formation}` : ''} · 장면 {t.frames.length}</span>
                <span className="muted">{new Date(t.updatedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 수정</span>
              </span>
            </button>
            <Menu label={`${t.name} 메뉴`} items={[
              { label: '복제', onClick: () => dup(t.id) },
              { label: '삭제', danger: true, onClick: () => confirm(`"${t.name}"을 삭제할까요?`) && del(t.id) },
            ]} />
          </div>
        ))}
      </section>

      {settings && (
        <Sheet title="설정" onClose={() => setSettings(false)}>
          <div className="menu-rows">
            <button className="row-btn" onClick={() => { setSettings(false); setRosterOpen(true); }}><IconUsers /> 선수 명단</button>
            <button className="row-btn" onClick={backup} disabled={tactics.length === 0}><IconDownload /> 백업 저장 (JSON)</button>
            <button className="row-btn" onClick={() => file.current?.click()}><IconDownload style={{ transform: 'rotate(180deg)' }} /> 백업 불러오기</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => restore(e.target.files?.[0])} />
          </div>
          <p className="hint">전술은 이 기기의 브라우저에 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지울 땐 백업을 받아 두세요.</p>
        </Sheet>
      )}
      {rosterOpen && <RosterEditor onClose={() => setRosterOpen(false)} />}
    </div>
  );
}
