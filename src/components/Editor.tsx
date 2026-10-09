import { useEffect, useMemo, useRef, useState } from 'react';
import { frameStart, sampleAt, totalDuration } from '../lib/anim';
import { rolesFor } from '../lib/layout';
import { buildScene } from '../lib/scene';
import { useStore } from '../lib/store';
import { ExportSheet } from './ExportSheet';
import { LineupPanel } from './LineupPanel';
import { OppEditor } from './OppEditor';
import { Pitch } from './Pitch';
import { PlayerPicker } from './PlayerPicker';
import { RosterEditor } from './RosterEditor';
import { FrameBar, TacticPanel } from './TacticPanel';

type Mode = 'lineup' | 'tactic';

export function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const tactic = useStore(s => s.tactics.find(t => t.id === id));
  const roster = useStore(s => s.roster);
  const store = useStore();

  const [mode, setMode] = useState<Mode>('lineup');
  const [frameIndex, setFrameIndex] = useState(0);
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTrails, setShowTrails] = useState(true);
  const [pick, setPick] = useState<string | null>(null);
  const [oppEdit, setOppEdit] = useState<string | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const frames = tactic?.frames;
  const total = frames ? totalDuration(frames.length) : 0;
  const clampedFrame = frames ? Math.min(frameIndex, frames.length - 1) : 0;

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
      return buildScene(tactic, roster, s.positions, s.ball);
    }
    const f = tactic.frames[clampedFrame];
    const prev = showTrails && clampedFrame > 0 ? tactic.frames[clampedFrame - 1].positions : null;
    return buildScene(tactic, roster, f.positions, f.ball, prev);
  }, [tactic, roster, mode, time, clampedFrame, showTrails]);

  if (!tactic || !scene) return <div className="empty"><p>전술을 찾을 수 없어요.</p><button className="btn" onClick={onBack}>목록으로</button></div>;

  const liveNote = time != null ? tactic.frames[sampleAt(tactic.frames, time).noteIndex].note : mode === 'tactic' ? tactic.frames[clampedFrame].note : '';
  const editable = mode === 'lineup' || (mode === 'tactic' && time == null && !playing);
  const exportFrame = time != null ? sampleAt(tactic.frames, time).frameIndex : clampedFrame;

  const switchMode = (m: Mode) => {
    setMode(m); setPlaying(false); setTime(null);
    if (m === 'lineup') setFrameIndex(0);
  };
  const selectFrame = (i: number) => { setPlaying(false); setTime(null); setFrameIndex(i); };
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    const last = tactic.frames.length - 1;
    clock.current.time = time != null && time < total ? time : clampedFrame >= last ? 0 : frameStart(clampedFrame);
    setTime(clock.current.time);
    setPlaying(true);
  };
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
        <button className="icon-btn" onClick={onBack} aria-label="목록으로">←</button>
        <input className="title-in" value={tactic.name} maxLength={24} aria-label="전술 이름"
          onChange={e => store.edit(id, t => { t.name = e.target.value; })} />
        <button className="btn sm primary" onClick={() => setExportOpen(true)}>내보내기</button>
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'lineup'} className={mode === 'lineup' ? 'on' : ''} onClick={() => switchMode('lineup')}>라인업 짜기</button>
        <button role="tab" aria-selected={mode === 'tactic'} className={mode === 'tactic' ? 'on' : ''} onClick={() => switchMode('tactic')}>전술 짜기</button>
      </div>

      <div className="workspace">
        <div className="board">
          <Pitch
            scene={scene}
            interactive={editable}
            ballDraggable={mode === 'tactic'}
            selectedId={pick ?? oppEdit}
            onTapToken={onTapToken}
            onMoveToken={(tk, pt) => store.moveToken(id, mode === 'lineup' ? 0 : clampedFrame, tk, pt)}
            onMoveBall={pt => store.moveBall(id, clampedFrame, pt)}
          />
          {mode === 'tactic' && <FrameBar tactic={tactic} frameIndex={clampedFrame} time={time} onSelectFrame={selectFrame} />}
          {mode === 'tactic' && (
            <div className="board-note">
              <span className="board-step">{time != null ? `장면 ${sampleAt(tactic.frames, time).noteIndex + 1}` : `장면 ${clampedFrame + 1}`} / {tactic.frames.length}</span>
              {liveNote && <span>{liveNote}</span>}
            </div>
          )}
        </div>
        <div className="panel">
          {mode === 'lineup'
            ? <LineupPanel tactic={tactic} roster={roster} onOpenRoster={() => setRosterOpen(true)} />
            : <TacticPanel tactic={tactic} frameIndex={clampedFrame} playing={playing} time={time} speed={speed}
                showTrails={showTrails} onSelectFrame={selectFrame} onTogglePlay={togglePlay} onScrub={scrub}
                onSpeed={setSpeed} onTrails={setShowTrails} />}
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
      {exportOpen && <ExportSheet tactic={tactic} roster={roster} frameIndex={exportFrame} speed={speed} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
