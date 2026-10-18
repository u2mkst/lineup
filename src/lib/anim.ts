import type { Frame, Pt, SceneDrawing } from '../types';
import { along } from './curve';

/** ms spent standing still on a frame, and ms spent travelling to the next. */
export const HOLD = 700;
export const MOVE = 1500;
const STEP = HOLD + MOVE;

/** Total unscaled length of the animation. */
export function totalDuration(frameCount: number): number {
  return Math.max(0, frameCount - 1) * STEP + HOLD;
}

export function frameStart(index: number): number {
  return index * STEP;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface Sample {
  positions: Record<string, Pt>;
  ball: Pt;
  /** frame whose note should be shown */
  noteIndex: number;
  /** frame we are on, or have most recently left */
  frameIndex: number;
  /** annotations to show, cross-fading while players travel */
  drawings: SceneDrawing[];
  /** who has the ball right now */
  holder: string | null;
}

const withAlpha = (f: Frame | undefined, alpha: number): SceneDrawing[] =>
  alpha <= 0.01 || !f ? [] : f.drawings.map(d => ({ ...d, alpha }));

export function sampleAt(frames: Frame[], ms: number): Sample {
  const last = frames.length - 1;
  const clamped = Math.max(0, Math.min(ms, totalDuration(frames.length)));
  const i = Math.min(Math.floor(clamped / STEP), last);
  const local = clamped - i * STEP;
  if (i >= last || local <= HOLD) {
    return { positions: frames[i].positions, ball: frames[i].ball, noteIndex: i, frameIndex: i, drawings: withAlpha(frames[i], 1), holder: frames[i].holder };
  }
  const raw = (local - HOLD) / MOVE;
  const a = frames[i];
  const b = frames[i + 1];
  // Each player (and the ball) can start later / arrive earlier than the rest.
  const progress = (id: string) => {
    const [s, e] = b.timing[id] ?? [0, 1];
    return ease(Math.min(1, Math.max(0, (raw - s) / (e - s))));
  };
  const positions: Record<string, Pt> = {};
  for (const id of Object.keys(a.positions)) {
    positions[id] = along(a.positions[id], b.positions[id] ?? a.positions[id], b.via?.[id], progress(id));
  }
  const t = ease(raw);
  // Old annotations fade out in the first third of the move, new ones fade in during the last third.
  const drawings = [...withAlpha(a, 1 - t * 3), ...withAlpha(b, t * 3 - 2)];
  return {
    positions, ball: along(a.ball, b.ball, b.via?.ball, progress('ball')), noteIndex: i + 1,
    frameIndex: t > 0.5 ? i + 1 : i, drawings, holder: t > 0.5 ? b.holder : a.holder,
  };
}
