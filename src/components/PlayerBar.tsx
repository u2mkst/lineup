import { frameStart, totalDuration } from '../lib/anim';
import { useStore } from '../lib/store';
import type { Tactic } from '../types';
import { IconPause, IconPlay, IconPlus } from './Icons';

interface Props {
  tactic: Tactic;
  frameIndex: number;
  playing: boolean;
  time: number | null;
  speed: number;
  onSelectFrame: (i: number) => void;
  onTogglePlay: () => void;
  onScrub: (ms: number) => void;
  onSpeed: (s: number) => void;
}

const SPEEDS = [0.5, 1, 2];

/** Frame strip and transport controls, docked under the pitch. */
export function PlayerBar(p: Props) {
  const addFrame = useStore(s => s.addFrame);
  const n = p.tactic.frames.length;
  const total = totalDuration(n);
  const nextSpeed = () => p.onSpeed(SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length]);

  return (
    <div className="player-bar">
      <div className="player-row">
        <button className="play-btn" disabled={n < 2} onClick={p.onTogglePlay} aria-label={p.playing ? '일시정지' : '재생'}>
          {p.playing ? <IconPause width={18} height={18} /> : <IconPlay width={18} height={18} />}
        </button>
        <div className="frames" role="tablist" aria-label="장면">
          {p.tactic.frames.map((f, i) => (
            <button key={f.id} role="tab" aria-selected={i === p.frameIndex && p.time == null} aria-label={`장면 ${i + 1}`}
              className={`frame-chip${i === p.frameIndex ? ' on' : ''}`} onClick={() => p.onSelectFrame(i)}>
              {i + 1}
            </button>
          ))}
          <button className="frame-chip add" onClick={() => p.onSelectFrame(addFrame(p.tactic.id, p.frameIndex))} aria-label="장면 추가"><IconPlus width={16} height={16} /></button>
        </div>
        <button className="speed-btn" onClick={nextSpeed} aria-label={`재생 속도 ${p.speed}배`}>{p.speed}×</button>
      </div>
      <input type="range" className="scrub" min={0} max={Math.max(1, total)} step={10} disabled={n < 2}
        value={p.time ?? frameStart(p.frameIndex)} onChange={e => p.onScrub(Number(e.target.value))} aria-label="재생 위치" />
    </div>
  );
}
