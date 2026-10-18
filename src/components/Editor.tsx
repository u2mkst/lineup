import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { sampleAt } from '../lib/anim';
import { useAuth } from '../lib/auth';
import { rolesFor } from '../lib/layout';
import { buildScene } from '../lib/scene';
import { useStore } from '../lib/store';
import { cloudEnabled } from '../lib/supabase';
import { useSync } from '../lib/sync';
import { usePlayback } from '../lib/usePlayback';
import { IconBack, IconRedo, IconUndo } from './Icons';
import { LineupPanel } from './LineupPanel';
import { OppEditor } from './OppEditor';
import { Pitch, type Tool } from './Pitch';
import { PlayerBar } from './PlayerBar';
import { PlayerPicker } from './PlayerPicker';
import { RosterManager } from './RosterManager';
import { TacticPanel } from './TacticPanel';

const ExportSheet = lazy(() => import('./ExportSheet').then(m => ({ default: m.ExportSheet })));

type Mode = 'lineup' | 'tactic';

const SYNC_LABEL = { idle: '', saving: '저장 중…', saved: '서버에 저장됨', error: '저장 실패' } as const;

export function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const tactic = useStore(s => s.tactics.find(t => t.id === id));
  const roster = useStore(s => s.roster);
  const canUndo = useStore(s => (s.history[id]?.past.length ?? 0) > 0);
  const canRedo = useStore(s => (s.history[id]?.future.length ?? 0) > 0);
  const store = useStore();
  const user = useAuth(s => s.user);
  const syncStatus = useSync(s => s.status);

  const [mode, setMode] = useState<Mode>('lineup');
  const [showTrails, setShowTrails] = useState(true);
  const [tool, setTool] = useState<Tool>('move');
  const [pick, setPick] = useState<string | null>(null);
  const [oppEdit, setOppEdit] = useState<string | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const pb = usePlayback(tactic?.frames);
  const modalOpen = !!pick || !!oppEdit || rosterOpen || exportOpen;

  const scene = useMemo(() => {
    if (!tactic) return null;
    if (mode === 'lineup') return buildScene(tactic, roster, tactic.frames[0].positions, null);
    if (pb.time != null) {
      const s = sampleAt(tactic.frames, pb.time);
      return buildScene(tactic, roster, s.positions, s.ball, { drawings: s.drawings });
    }
    const f = tactic.frames[pb.frameIndex];
    const prev = showTrails && pb.frameIndex > 0 ? tactic.frames[pb.frameIndex - 1] : null;
    return buildScene(tactic, roster, f.positions, f.ball, { prev, drawings: f.drawings.map(d => ({ ...d, alpha: 1 })) }, f);
  }, [tactic, roster, mode, pb.time, pb.frameIndex, showTrails]);

  const togglePlay = () => { setTool('move'); pb.toggle(); };

  // Keyboard shortcuts (desktop): undo/redo, space to play.
  const shortcuts = useRef({ undo: () => {}, redo: () => {}, play: () => {} });
  shortcuts.current = {
    undo: () => canUndo && store.undo(id),
    redo: () => canRedo && store.redo(id),
    play: () => mode === 'tactic' && (tactic?.frames.length ?? 0) > 1 && togglePlay(),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (modalOpen || el.closest('input, textarea, select, [contenteditable]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? shortcuts.current.redo : shortcuts.current.undo)(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); shortcuts.current.redo(); }
      else if (e.key === ' ' && el === document.body) { e.preventDefault(); shortcuts.current.play(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  if (!tactic || !scene) return <div className="empty"><p>전술을 찾을 수 없어요.</p><button className="btn" onClick={onBack}>목록으로</button></div>;

  const sample = pb.time != null ? sampleAt(tactic.frames, pb.time) : null;
  const liveNote = sample ? tactic.frames[sample.noteIndex].note : mode === 'tactic' ? tactic.frames[pb.frameIndex].note : '';
  const editable = mode === 'lineup' || (pb.time == null && !pb.playing);
  const exportFrame = sample ? sample.frameIndex : pb.frameIndex;

  const switchMode = (m: Mode) => {
    setMode(m); pb.stop(); setTool('move');
    if (m === 'lineup') pb.select(0);
  };

  const onTapToken = (tokenId: string) => {
    if (mode !== 'lineup') return;
    if (tokenId.startsWith('u')) setPick(tokenId);
    else setOppEdit(tokenId);
  };

  const togglePublic = () => {
    if (!tactic.isPublic && !confirm('팀 공개로 바꾸면 로그인하지 않은 사람도 이 전술을 볼 수 있어요. 공개할까요?')) return;
    store.edit(id, t => { t.isPublic = !t.isPublic; });
  };

  const taken: Record<string, string> = {};
  const usRoles = rolesFor(tactic.us.formation);
  Object.entries(tactic.us.assign).forEach(([k, pid]) => { if (pid) taken[pid] = usRoles[Number(k.slice(1))]; });

  return (
    <div className="editor">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="목록으로"><IconBack /></button>
        <input className="title-in" value={tactic.name} maxLength={24} aria-label="전술 이름"
          onChange={e => store.edit(id, t => { t.name = e.target.value; }, 'name')} />
        <button className="icon-btn" onClick={() => store.undo(id)} disabled={!canUndo} aria-label="되돌리기" title="되돌리기 (Ctrl+Z)"><IconUndo /></button>
        <button className="icon-btn" onClick={() => store.redo(id)} disabled={!canRedo} aria-label="다시 실행" title="다시 실행 (Ctrl+Shift+Z)"><IconRedo /></button>
        <button className="btn sm primary" onClick={() => setExportOpen(true)}>내보내기</button>
      </header>

      {cloudEnabled && user && (
        <div className="cloud-bar">
          <button className={`chip${tactic.isPublic ? ' on' : ''}`} onClick={togglePublic} aria-pressed={!!tactic.isPublic}>
            {tactic.isPublic ? '팀 공개 중' : '비공개'}
          </button>
          <span className={`sync ${syncStatus}`} role="status">{SYNC_LABEL[syncStatus]}</span>
        </div>
      )}

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={mode === 'lineup'} className={mode === 'lineup' ? 'on' : ''} onClick={() => switchMode('lineup')}>라인업</button>
        <button role="tab" aria-selected={mode === 'tactic'} className={mode === 'tactic' ? 'on' : ''} onClick={() => switchMode('tactic')}>전술</button>
      </div>

      <div className="workspace">
        <div className={`board ${mode}`}>
          <Pitch
            scene={scene}
            interactive={editable}
            tool={mode === 'tactic' ? tool : 'move'}
            ballDraggable={mode === 'tactic'}
            selectedId={pick ?? oppEdit}
            onTapToken={onTapToken}
            onMoveToken={(tk, pt) => store.moveToken(id, mode === 'lineup' ? 0 : pb.frameIndex, tk, pt)}
            onMoveBall={pt => store.moveBall(id, pb.frameIndex, pt)}
            onDraw={d => store.addDrawing(id, pb.frameIndex, d)}
            onErase={did => store.removeDrawing(id, pb.frameIndex, did)}
            onVia={(tk, pt) => store.setVia(id, pb.frameIndex, tk, pt)}
          />
          {mode === 'tactic' && (
            <>
              <PlayerBar frames={tactic.frames} frameIndex={pb.frameIndex} playing={pb.playing} time={pb.time} speed={pb.speed}
                onSelectFrame={pb.select} onTogglePlay={togglePlay} onScrub={pb.scrub} onSpeed={pb.setSpeed}
                onAddFrame={() => pb.select(store.addFrame(id, pb.frameIndex))} />
              <p className="board-note">
                <span className="board-step">장면 {(sample ? sample.noteIndex : pb.frameIndex) + 1}/{tactic.frames.length}</span>
                {liveNote ? <span>{liveNote}</span> : <span className="muted">설명 없음</span>}
              </p>
            </>
          )}
        </div>
        <div className="panel">
          {mode === 'lineup'
            ? <LineupPanel tactic={tactic} roster={roster} onOpenRoster={() => setRosterOpen(true)} />
            : <TacticPanel tactic={tactic} frameIndex={pb.frameIndex} locked={pb.playing || pb.time != null} showTrails={showTrails}
                tool={tool} onTool={setTool} onSelectFrame={pb.select} onTrails={setShowTrails} />}
        </div>
      </div>

      {pick && (
        <PlayerPicker
          role={usRoles[Number(pick.slice(1))]} roster={roster} taken={taken} current={tactic.us.assign[pick]}
          onPick={pid => { store.assignPlayer(id, pick, pid); setPick(null); }} onClose={() => setPick(null)}
        />
      )}
      {oppEdit && tactic.opp && (
        <OppEditor
          role={rolesFor(tactic.opp.formation)[Number(oppEdit.slice(1))]}
          value={tactic.opp.labels[oppEdit] ?? { number: '', name: '' }}
          onSave={v => { store.edit(id, t => { if (t.opp) t.opp.labels[oppEdit] = v; }); setOppEdit(null); }}
          onClose={() => setOppEdit(null)}
        />
      )}
      {rosterOpen && <RosterManager onClose={() => setRosterOpen(false)} />}
      {exportOpen && (
        <Suspense fallback={null}>
          <ExportSheet tactic={tactic} roster={roster} frameIndex={exportFrame} speed={pb.speed} onClose={() => setExportOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
