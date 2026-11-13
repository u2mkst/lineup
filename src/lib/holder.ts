import type { Pt } from '../types';

/** Where the ball sits relative to the player who has it (at his feet, bottom-right). */
export const BALL_OFFSET: Pt = { x: 0.046, y: 0.024 };
/** How close (in 600x800 pitch units) a dropped ball must be to a player to stick to him. */
export const SNAP_DISTANCE = 38;

export const ballAt = (p: Pt): Pt => ({ x: Math.min(0.97, p.x + BALL_OFFSET.x), y: Math.min(0.97, p.y + BALL_OFFSET.y) });

/** The player closest to `pt` within snapping range, or null. */
export function nearestHolder(tokens: { id: string; x: number; y: number }[], pt: Pt): string | null {
  let best: string | null = null;
  let bestD = SNAP_DISTANCE;
  for (const t of tokens) {
    // the ball rests at the player's feet, so measure to the offset position too
    const d = Math.min(Math.hypot((t.x - pt.x) * 600, (t.y - pt.y) * 800), Math.hypot((t.x + BALL_OFFSET.x - pt.x) * 600, (t.y + BALL_OFFSET.y - pt.y) * 800));
    if (d < bestD) { bestD = d; best = t.id; }
  }
  return best;
}
