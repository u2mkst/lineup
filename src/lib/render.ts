import { benchOf, buildScene, inkFor } from './scene';
import type { Player, Pt, Scene, SceneToken, Tactic } from '../types';

export const FONT = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
export const PITCH_ASPECT = 4 / 3; // height / width

interface Rect { x: number; y: number; w: number; h: number }

const px = (r: Rect, p: Pt) => ({ x: r.x + p.x * r.w, y: r.y + p.y * r.h });

/** Draws the pitch in a 600x800 virtual space scaled into `r`. */
export function drawPitch(ctx: CanvasRenderingContext2D, r: Rect) {
  const sx = r.w / 600;
  const sy = r.h / 800;
  const X = (v: number) => r.x + v * sx;
  const Y = (v: number) => r.y + v * sy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 ? '#2d8a4b' : '#31944f';
    ctx.fillRect(r.x, Y((800 / bands) * i), r.w, (r.h / bands) + 1);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, 3 * sx);
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke();
  };
  ctx.strokeRect(X(24), Y(24), 552 * sx, 752 * sy);
  line(24, 400, 576, 400);
  ctx.beginPath(); ctx.ellipse(X(300), Y(400), 76 * sx, 66 * sy, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(300), Y(400), 4 * sx, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  for (const top of [true, false]) {
    const dir = top ? 1 : -1;
    const base = top ? 24 : 776;
    ctx.strokeRect(X(122), top ? Y(base) : Y(base - 126), 356 * sx, 126 * sy);
    ctx.strokeRect(X(220), top ? Y(base) : Y(base - 44), 160 * sx, 44 * sy);
    ctx.beginPath(); ctx.arc(X(300), Y(base + dir * 86), 4 * sx, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(X(300), Y(base + dir * 86), 76 * sx, 66 * sy, 0, top ? 0.64 : Math.PI + 0.64, top ? Math.PI - 0.64 : Math.PI * 2 - 0.64);
    ctx.stroke();
  }
  ctx.restore();
}

export function tokenRadius(r: Rect) {
  return r.w * 0.04;
}

function drawBall(ctx: CanvasRenderingContext2D, c: { x: number; y: number }, rad: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = rad * 0.5; ctx.shadowOffsetY = rad * 0.2;
  ctx.beginPath(); ctx.arc(c.x, c.y, rad, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  ctx.lineWidth = Math.max(1.5, rad * 0.12); ctx.strokeStyle = '#111827'; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = c.x + Math.cos(a) * rad * 0.5; const y = c.y + Math.sin(a) * rad * 0.5;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fillStyle = '#111827'; ctx.fill();
}

function drawArrow(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string, w: number, pad: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < pad * 2.2) return;
  const sx = a.x + Math.cos(ang) * pad; const sy = a.y + Math.sin(ang) * pad;
  const ex = b.x - Math.cos(ang) * pad; const ey = b.y - Math.sin(ang) * pad;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.setLineDash([w * 2.2, w * 1.8]);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]);
  const h = w * 4;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - Math.cos(ang - 0.45) * h, ey - Math.sin(ang - 0.45) * h);
  ctx.lineTo(ex - Math.cos(ang + 0.45) * h, ey - Math.sin(ang + 0.45) * h);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawToken(ctx: CanvasRenderingContext2D, tk: SceneToken, r: Rect) {
  const c = px(r, tk);
  const rad = tokenRadius(r);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = rad * 0.35; ctx.shadowOffsetY = rad * 0.15;
  ctx.beginPath(); ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
  if (tk.empty) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.setLineDash([rad * 0.3, rad * 0.25]); ctx.lineWidth = rad * 0.1; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
  } else {
    ctx.fillStyle = tk.color; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = rad * 0.14; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (tk.empty) {
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `700 ${rad * 0.62}px ${FONT}`;
    ctx.fillText(tk.role, c.x, c.y);
    return;
  }
  ctx.fillStyle = inkFor(tk.color);
  ctx.font = `800 ${rad * (tk.number.length > 2 ? 0.8 : 1.0)}px ${FONT}`;
  ctx.fillText(tk.number, c.x, c.y + rad * 0.04);
  if (tk.name) {
    const fs = rad * 0.66;
    ctx.font = `700 ${fs}px ${FONT}`;
    const tw = ctx.measureText(tk.name).width;
    const bw = tw + fs * 0.9; const bh = fs * 1.5;
    const by = c.y + rad + fs * 0.25;
    ctx.fillStyle = 'rgba(8,20,14,.72)';
    ctx.beginPath(); ctx.roundRect(c.x - bw / 2, by, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(tk.name, c.x, by + bh / 2 + fs * 0.04);
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, r: Rect) {
  drawPitch(ctx, r);
  const rad = tokenRadius(r);
  for (const t of scene.trails) {
    drawArrow(ctx, px(r, t.from), px(r, t.to), 'rgba(255,255,255,.8)', Math.max(2, rad * 0.1), rad * 0.9);
  }
  // Draw back-to-front so lower players overlap upper ones' name tags naturally.
  [...scene.tokens].sort((a, b) => a.y - b.y).forEach(tk => drawToken(ctx, tk, r));
  if (scene.ball) drawBall(ctx, px(r, scene.ball), rad * 0.5);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
    }
    lines.push(cur);
  }
  return lines;
}

function bg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0f2a1e'); g.addColorStop(1, '#08150f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function brand(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, align: CanvasTextAlign = 'right') {
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillText('⚽ 축구방', x, y);
}

/** Static line-up image: pitch + formation + bench list. */
export function renderLineupCard(tactic: Tactic, roster: Player[]): HTMLCanvasElement {
  const W = 1080;
  const pad = 48;
  const canvas = document.createElement('canvas');
  const mctx = canvas.getContext('2d')!;
  const pitchW = W - pad * 2;
  const pitchH = pitchW * PITCH_ASPECT;
  const headH = 190;
  const bench = benchOf(tactic, roster);

  mctx.font = `700 30px ${FONT}`;
  const chipH = 56; const gap = 14; const chips: { label: string; w: number; x: number; y: number }[] = [];
  let cx = 0; let cy = 0;
  for (const p of bench) {
    const label = `${p.number}  ${p.name}`;
    const w = mctx.measureText(label).width + 40;
    if (cx + w > pitchW && cx > 0) { cx = 0; cy += chipH + gap; }
    chips.push({ label, w, x: cx, y: cy }); cx += w + gap;
  }
  const benchH = bench.length ? 70 + cy + chipH : 0;
  const footH = 90;
  const H = Math.ceil(headH + pitchH + (benchH ? benchH + 30 : 0) + footH);

  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  bg(ctx, W, H);

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff'; ctx.font = `800 56px ${FONT}`;
  ctx.fillText(tactic.name, pad, 92, pitchW);
  ctx.font = `600 30px ${FONT}`;
  let sx = pad;
  const sub = (txt: string, color: string) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx + 11, 143, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText(txt, sx + 32, 154);
    sx += 32 + ctx.measureText(txt).width + 36;
  };
  sub(`${tactic.us.name}  ${tactic.us.formation}`, tactic.us.color);
  if (tactic.opp) sub(`${tactic.opp.name}  ${tactic.opp.formation}`, tactic.opp.color);

  const rect = { x: pad, y: headH, w: pitchW, h: pitchH };
  const first = tactic.frames[0];
  drawScene(ctx, buildScene(tactic, roster, first.positions, null), rect);

  let y = headH + pitchH + 30;
  if (bench.length) {
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `700 28px ${FONT}`;
    ctx.fillText('교체 명단', pad, y + 34);
    const top = y + 60;
    ctx.font = `700 30px ${FONT}`; ctx.textBaseline = 'middle';
    for (const c of chips) {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.roundRect(pad + c.x, top + c.y, c.w, chipH, chipH / 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(c.label, pad + c.x + c.w / 2, top + c.y + chipH / 2 + 1);
    }
    y = top + cy + chipH;
  }
  brand(ctx, W - pad, H - 36, 28);
  return canvas;
}

export interface FrameCardOpts {
  width: number;
  label: string;
  note: string;
}

export function frameCardSize(width: number) {
  const s = width / 720;
  const head = Math.round(70 * s);
  const foot = Math.round(110 * s);
  return { width, head, foot, pitchH: Math.round(width * PITCH_ASPECT), height: Math.round(width * PITCH_ASPECT) + head + foot };
}

/** One tactic frame (still or animation step): header + pitch + note. */
export function drawFrameCard(ctx: CanvasRenderingContext2D, tactic: Tactic, scene: Scene, opts: FrameCardOpts) {
  const { width: W, head, pitchH, height: H } = frameCardSize(opts.width);
  const s = W / 720;
  bg(ctx, W, H);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = `800 ${26 * s}px ${FONT}`;
  ctx.fillText(tactic.name, 24 * s, head / 2, W * 0.62);
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `700 ${22 * s}px ${FONT}`;
  ctx.fillText(opts.label, W - 24 * s, head / 2);
  drawScene(ctx, scene, { x: 0, y: head, w: W, h: pitchH });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff'; ctx.font = `600 ${24 * s}px ${FONT}`;
  const lines = wrapText(ctx, opts.note, W - 48 * s).slice(0, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, 24 * s, head + pitchH + 40 * s + i * 32 * s));
  brand(ctx, W - 20 * s, H - 14 * s, 17 * s);
}
