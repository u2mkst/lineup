import type { Frame, Pt } from '../types';

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
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export interface Sample {
  positions: Record<string, Pt>;
  ball: Pt;
  /** frame whose note should be shown */
  noteIndex: number;
  /** frame we are on, or have most recently left */
  frameIndex: number;
}

export function sampleAt(frames: Frame[], ms: number): Sample {
  const last = frames.length - 1;
  const clamped = Math.max(0, Math.min(ms, totalDuration(frames.length)));
  const i = Math.min(Math.floor(clamped / STEP), last);
  const local = clamped - i * STEP;
  if (i >= last || local <= HOLD) {
    return { positions: frames[i].positions, ball: frames[i].ball, noteIndex: i, frameIndex: i };
  }
  const t = ease((local - HOLD) / MOVE);
  const a = frames[i];
  const b = frames[i + 1];
  const positions: Record<string, Pt> = {};
  for (const id of Object.keys(a.positions)) {
    positions[id] = lerp(a.positions[id], b.positions[id] ?? a.positions[id], t);
  }
  return { positions, ball: lerp(a.ball, b.ball, t), noteIndex: i + 1, frameIndex: t > 0.5 ? i + 1 : i };
}
