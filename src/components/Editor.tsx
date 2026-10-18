import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { frameStart, sampleAt, totalDuration } from '../lib/anim';
import { rolesFor } from '../lib/layout';
import { buildScene } from '../lib/scene';
import { useStore } from '../lib/store';
import { IconBack, IconRedo, IconUndo } from './Icons';
import { LineupPanel } from './LineupPanel';
import { OppEditor } from './OppEditor';
import { Pitch, type Tool } from './Pitch';
import { PlayerPicker } from './PlayerPicker';
import { RosterEditor } from './RosterEditor';
import { PlayerBar } from './PlayerBar';
import { TacticPanel } from './TacticPanel';

const ExportSheet = lazy(() => import('./ExportSheet').then(m => ({ default: m.ExportSheet })));

type Mode = 'lineup' | 'tactic';

export function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const tactic = useStore(s => s.tactics.find(t => t.id === id));
  const roster = useStore(s => s.roster);
  const canUndo = useStore(s => (s.history[id]?.past.length ?? 0) > 0);
  const canRedo = useStore(s => (s.history[id]?.future.length ?? 0) > 0);
  const store = useStore();

  const [mode, setMode] = useState<Mode>('lineup');
  const [frameIndex, setFrameIndex] = useState(0);
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTrails, setShowTrails] = useState(true);
  const [tool, setTool] = useState<Tool>('move');
  const [pick, setPick] = useState<string | null>(null);
  const [oppEdit, setOppEdit] = useState<string | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const frames = tactic?.frames;
  const total = frames ? totalDuration(frames.length) : 0;
  const clampedFrame = frames ? Math.min(frameIndex, frames.length - 1) : 0;
  const modalOpen = !!pick || !!oppEdit || rosterOpen || exportOpen;

  // Playback clock.
  const clock = useRef({ last: 0, time: 0 });
  useEffect(() => {
    if (!playing || !frames) return;
    clock.current.last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const c = clock.current;
      c.time += (now - c.last) * speed;
      c.last = now;
      if (c.time >= total) {
        setPlaying(false); setTime(null); setFrameIndex(frames.length - 1);
        return;
      }
      setTime(c.time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total, frames]);

  const scene = useMemo(() => {
    if (!tactic) return null;
    if (mode === 'lineup') return buildScene(tactic, roster, tactic.frames[0].positions, null);
    if (time != null) {
      const s = sampleAt(tactic.frames, time);
      return buildScene(tactic, roster, s.positions, s.ball, { drawings: s.drawings });
    }
    const f = tactic.frames[clampedFrame];
    const prev = showTrails && clampedFrame > 0 ? tactic.frames[clampedFrame - 1] : null;
    return buildScene(tactic, roster, f.positions, f.ball, { prev, drawings: f.drawings.map(d => ({ ...d, alpha: 1 })) }, f);
  }, [tactic, roster, mode, time, clampedFrame, showTrails]);

  const togglePlay = () => {
    if (!tactic) return;
    if (playing) { setPlaying(false); return; }
    const last = tactic.frames.length - 1;
    clock.current.time = time != null && time < total ? time : clampedFrame >= last ? 0 : frameStart(clampedFrame);
    setTime(clock.current.time);
    setTool('move');
    setPlaying(true);
  };

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

  const liveNote = time != null ? tactic.frames[sampleAt(tactic.frames, time).noteIndex].note : mode === 'tactic' ? tactic.frames[clampedFrame].note : '';
  const editable = mode === 'lineup' || (mode === 'tactic' && time == null && !playing);
  const exportFrame = time != null ? sampleAt(tactic.frames, time).frameIndex : clampedFrame;

  const switchMode = (m: Mode) => {
    setMode(m); setPlaying(false); setTime(null); setTool('move');
    if (m === 'lineup') setFrameIndex(0);
  };
  const selectFrame = (i: number) => { setPlaying(false); setTime(null); setFrameIndex(i); };
  const scrub = (ms: number) => { setPlaying(false); clock.current.time = ms; setTime(ms); };

  const onTapToken = (tokenId: string) => {
    if (mode !== 'lineup') return;
    if (tokenId.startsWith('u')) setPick(tokenId);
    else setOppEdit(tokenId);
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
            onMoveToken={(tk, pt) => store.moveToken(id, mode === 'lineup' ? 0 : clampedFrame, tk, pt)}
            onMoveBall={pt => store.moveBall(id, clampedFrame, pt)}
            onDraw={d => store.addDrawing(id, clampedFrame, d)}
            onErase={did => store.removeDrawing(id, clampedFrame, did)}
            onVia={(tk, pt) => store.setVia(id, clampedFrame, tk, pt)}
          />
          {mode === 'tactic' && (
            <>
              <PlayerBar tactic={tactic} frameIndex={clampedFrame} playing={playing} time={time} speed={speed}
                onSelectFrame={selectFrame} onTogglePlay={togglePlay} onScrub={scrub} onSpeed={setSpeed} />
              <p className="board-note">
                <span className="board-step">장면 {(time != null ? sampleAt(tactic.frames, time).noteIndex : clampedFrame) + 1}/{tactic.frames.length}</span>
                {liveNote ? <span>{liveNote}</span> : <span className="muted">설명 없음</span>}
              </p>
            </>
          )}
        </div>
        <div className="panel">
          {mode === 'lineup'
            ? <LineupPanel tactic={tactic} roster={roster} canEditRoster onOpenRoster={() => setRosterOpen(true)} />
            : <TacticPanel tactic={tactic} frameIndex={clampedFrame} locked={playing || time != null} showTrails={showTrails}
                tool={tool} onTool={setTool} onSelectFrame={selectFrame} onTrails={setShowTrails} />}
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
      {rosterOpen && <RosterEditor onClose={() => setRosterOpen(false)} />}
      {exportOpen && (
        <Suspense fallback={null}>
          <ExportSheet tactic={tactic} roster={roster} frameIndex={exportFrame} speed={speed} onClose={() => setExportOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
