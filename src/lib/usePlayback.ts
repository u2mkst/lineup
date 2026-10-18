import { useEffect, useRef, useState } from 'react';
import { frameStart, totalDuration } from './anim';
import type { Frame } from '../types';

/** Playback clock shared by the editor and the read-only viewer. */
export function usePlayback(frames: Frame[] | undefined) {
  const [frameIndex, setFrameIndex] = useState(0);
  /** ms into the animation; `null` while parked on a single frame */
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const clock = useRef({ last: 0, time: 0 });

  const count = frames?.length ?? 0;
  const total = totalDuration(count);
  const current = Math.min(frameIndex, Math.max(0, count - 1));

  useEffect(() => {
    if (!playing || count === 0) return;
    clock.current.last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const c = clock.current;
      c.time += (now - c.last) * speed;
      c.last = now;
      if (c.time >= total) {
        setPlaying(false); setTime(null); setFrameIndex(count - 1);
        return;
      }
      setTime(c.time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total, count]);

  const stop = () => { setPlaying(false); setTime(null); };
  const select = (i: number) => { stop(); setFrameIndex(i); };
  const scrub = (ms: number) => { setPlaying(false); clock.current.time = ms; setTime(ms); };
  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    if (count < 2) return;
    clock.current.time = time != null && time < total ? time : current >= count - 1 ? 0 : frameStart(current);
    setTime(clock.current.time);
    setPlaying(true);
  };

  return { frameIndex: current, time, playing, speed, setSpeed, stop, select, scrub, toggle, total };
}
