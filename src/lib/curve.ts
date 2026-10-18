import type { Pt } from '../types';

/** Control point of the quadratic bezier that passes through `via` at t = 0.5. */
export function controlPoint(a: Pt, b: Pt, via: Pt): Pt {
  return { x: 2 * via.x - 0.5 * (a.x + b.x), y: 2 * via.y - 0.5 * (a.y + b.y) };
}

export function bezier(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** Position along a straight or curved path. */
export function along(a: Pt, b: Pt, via: Pt | undefined, t: number): Pt {
  return via ? bezier(a, controlPoint(a, b, via), b, t) : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
