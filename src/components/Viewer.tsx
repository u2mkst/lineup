import { useMemo } from 'react';
import { sampleAt } from '../lib/anim';
import { buildScene } from '../lib/scene';
import { usePlayback } from '../lib/usePlayback';
import type { Player, Tactic } from '../types';
import { Pitch } from './Pitch';
import { PlayerBar } from './PlayerBar';

/** Read-only player for a tactic: pitch + frames + playback. */
export function Viewer({ tactic, roster }: { tactic: Tactic; roster: Player[] }) {
  const pb = usePlayback(tactic.frames);
  const sample = pb.time != null ? sampleAt(tactic.frames, pb.time) : null;
  const scene = useMemo(() => {
    if (sample) return buildScene(tactic, roster, sample.positions, sample.ball, { drawings: sample.drawings });
    const f = tactic.frames[pb.frameIndex];
    const prev = pb.frameIndex > 0 ? tactic.frames[pb.frameIndex - 1] : null;
    return buildScene(tactic, roster, f.positions, f.ball, { prev, drawings: f.drawings.map(d => ({ ...d, alpha: 1 })) }, f);
  }, [tactic, roster, sample, pb.frameIndex]);
  const note = tactic.frames[sample ? sample.noteIndex : pb.frameIndex].note;

  return (
    <div className="viewer">
      <Pitch interactive={false} scene={scene} />
      {tactic.frames.length > 1 && (
        <PlayerBar frames={tactic.frames} frameIndex={pb.frameIndex} playing={pb.playing} time={pb.time} speed={pb.speed}
          onSelectFrame={pb.select} onTogglePlay={pb.toggle} onScrub={pb.scrub} onSpeed={pb.setSpeed} />
      )}
      {note && <p className="board-note"><span>{note}</span></p>}
    </div>
  );
}
