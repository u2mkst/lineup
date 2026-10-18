import { controlPoint } from './curve';
import { benchOf, buildScene, inkFor, shade } from './scene';
import type { Player, Pt, Scene, SceneDrawing, SceneToken, Tactic } from '../types';

export const FONT = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
export const PITCH_ASPECT = 4 / 3; // height / width
export const PASS_COLOR = '#fde047';
export const ZONE_COLOR = '#34d399';

interface Rect { x: number; y: number; w: number; h: number }

const px = (r: Rect, p: Pt) => ({ x: r.x + p.x * r.w, y: r.y + p.y * r.h });

export interface Theme {
  id: string;
  label: string;
  bg: [string, string];
  text: string;
  sub: string;
  chip: string;
  brand: string;
}

export const THEMES: Theme[] = [
  { id: 'dark', label: '다크', bg: ['#0f2a1e', '#08150f'], text: '#ffffff', sub: 'rgba(255,255,255,.8)', chip: 'rgba(255,255,255,.12)', brand: 'rgba(255,255,255,.4)' },
  { id: 'light', label: '라이트', bg: ['#f6f9f7', '#e3ece7'], text: '#0b1f17', sub: 'rgba(11,31,23,.7)', chip: 'rgba(11,31,23,.09)', brand: 'rgba(11,31,23,.4)' },
  { id: 'navy', label: '네이비', bg: ['#15245a', '#080f2b'], text: '#ffffff', sub: 'rgba(255,255,255,.8)', chip: 'rgba(255,255,255,.13)', brand: 'rgba(255,255,255,.4)' },
];
export const themeById = (id: string) => THEMES.find(t => t.id === id) ?? THEMES[0];

/** Draws the pitch in a 600x800 virtual space scaled into `r`. */
export function drawPitch(ctx: CanvasRenderingContext2D, r: Rect) {
  const sx = r.w / 600;
  const sy = r.h / 800;
  const X = (v: number) => r.x + v * sx;
  const Y = (v: number) => r.y + v * sy;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 14 * sx);
  ctx.clip();
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 ? '#2b8447' : '#318f4f';
    ctx.fillRect(r.x, Y((800 / bands) * i), r.w, r.h / bands + 1);
  }
  const vg = ctx.createRadialGradient(X(300), Y(400), r.h * 0.25, X(300), Y(400), r.h * 0.75);
  vg.addColorStop(0, 'rgba(255,255,255,.06)'); vg.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = Math.max(2, 3 * sx);
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke();
  };
  ctx.strokeRect(X(24), Y(24), 552 * sx, 752 * sy);
  line(24, 400, 576, 400);
  ctx.beginPath(); ctx.ellipse(X(300), Y(400), 76 * sx, 66 * sy, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(300), Y(400), 4 * sx, 0, Math.PI * 2); ctx.fill();
  for (const top of [true, false]) {
    const dir = top ? 1 : -1;
    const base = top ? 24 : 776;
    ctx.strokeRect(X(122), top ? Y(base) : Y(base - 126), 356 * sx, 126 * sy);
    ctx.strokeRect(X(220), top ? Y(base) : Y(base - 44), 160 * sx, 44 * sy);
    ctx.beginPath(); ctx.arc(X(300), Y(base + dir * 86), 4 * sx, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(X(300), Y(base + dir * 86), 76 * sx, 66 * sy, 0, top ? 0.64 : Math.PI + 0.64, top ? Math.PI - 0.64 : Math.PI * 2 - 0.64);
    ctx.stroke();
    // goal frame behind the line
    ctx.strokeRect(X(262), top ? Y(10) : Y(776), 76 * sx, 14 * sy);
    // corner arcs
    for (const left of [true, false]) {
      const cx = left ? 24 : 576;
      ctx.beginPath();
      ctx.arc(X(cx), Y(base), 10 * sx, left ? (top ? 0 : -Math.PI / 2) : (top ? Math.PI / 2 : Math.PI), left ? (top ? Math.PI / 2 : 0) : (top ? Math.PI : Math.PI * 1.5));
      ctx.stroke();
    }
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

function arrow(
  ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number },
  color: string, w: number, pad: number, dashed: boolean, c?: { x: number; y: number },
) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < pad * 2.2 + w) return;
  // For a curve the path leaves towards the control point and arrives from it.
  const angS = Math.atan2((c ?? b).y - a.y, (c ?? b).x - a.x);
  const angE = Math.atan2(b.y - (c ?? a).y, b.x - (c ?? a).x);
  const h = w * 4;
  const sx = a.x + Math.cos(angS) * pad; const sy = a.y + Math.sin(angS) * pad;
  const ex = b.x - Math.cos(angE) * pad; const ey = b.y - Math.sin(angE) * pad;
  const bx = ex - Math.cos(angE) * h * 0.6; const by = ey - Math.sin(angE) * h * 0.6;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([w * 2.2, w * 1.8]);
  ctx.beginPath(); ctx.moveTo(sx, sy);
  if (c) ctx.quadraticCurveTo(c.x, c.y, bx, by); else ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - Math.cos(angE - 0.45) * h, ey - Math.sin(angE - 0.45) * h);
  ctx.lineTo(ex - Math.cos(angE + 0.45) * h, ey - Math.sin(angE + 0.45) * h);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawDrawing(ctx: CanvasRenderingContext2D, d: SceneDrawing, r: Rect) {
  const a = px(r, d.a); const b = px(r, d.b);
  const k = r.w / 600;
  ctx.save();
  ctx.globalAlpha = d.alpha;
  if (d.kind === 'zone') {
    const rad = Math.hypot((d.b.x - d.a.x) * 600, (d.b.y - d.a.y) * 800) * k;
    ctx.beginPath(); ctx.arc(a.x, a.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(52,211,153,.24)'; ctx.fill();
    ctx.setLineDash([8 * k, 6 * k]); ctx.lineWidth = 3 * k; ctx.strokeStyle = ZONE_COLOR; ctx.stroke();
  } else if (d.kind === 'pass') {
    arrow(ctx, a, b, PASS_COLOR, 4.5 * k, 0, false);
  } else {
    arrow(ctx, a, b, 'rgba(255,255,255,.92)', 4 * k, 0, true);
  }
  ctx.restore();
}

function drawToken(ctx: CanvasRenderingContext2D, tk: SceneToken, r: Rect) {
  const c = px(r, tk);
  const rad = tokenRadius(r);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = rad * 0.45; ctx.shadowOffsetY = rad * 0.18;
  ctx.beginPath(); ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
  if (tk.empty) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.setLineDash([rad * 0.3, rad * 0.25]); ctx.lineWidth = rad * 0.1; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(c.x - rad * 0.35, c.y - rad * 0.4, rad * 0.1, c.x, c.y, rad * 1.05);
    g.addColorStop(0, shade(tk.color, 0.32)); g.addColorStop(0.55, tk.color); g.addColorStop(1, shade(tk.color, -0.22));
    ctx.fillStyle = g; ctx.fill();
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
    ctx.fillStyle = 'rgba(8,20,14,.74)';
    ctx.beginPath(); ctx.roundRect(c.x - bw / 2, by, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(tk.name, c.x, by + bh / 2 + fs * 0.04);
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, r: Rect) {
  drawPitch(ctx, r);
  const rad = tokenRadius(r);
  for (const t of scene.trails) {
    const a = px(r, t.from); const b = px(r, t.to);
    const c = t.via ? controlPoint(a, b, px(r, t.via)) : undefined;
    arrow(ctx, a, b, 'rgba(255,255,255,.75)', Math.max(2, rad * 0.1), t.id === 'ball' ? rad * 0.6 : rad * 0.9, true, c);
  }
  scene.drawings.forEach(d => drawDrawing(ctx, d, r));
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

function bg(ctx: CanvasRenderingContext2D, w: number, h: number, th: Theme) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function brand(ctx: CanvasRenderingContext2D, th: Theme, x: number, y: number, size: number) {
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = th.brand; ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillText('⚽ 축구방', x, y);
}

/** Static line-up image: pitch + formation + bench list. */
export function renderLineupCard(tactic: Tactic, roster: Player[], theme: Theme = THEMES[0]): HTMLCanvasElement {
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
  bg(ctx, W, H, theme);

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = theme.text; ctx.font = `800 56px ${FONT}`;
  ctx.fillText(tactic.name, pad, 92, pitchW);
  ctx.font = `600 30px ${FONT}`;
  let sx = pad;
  const sub = (txt: string, color: string) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx + 11, 143, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = theme.sub; ctx.fillText(txt, sx + 32, 154);
    sx += 32 + ctx.measureText(txt).width + 36;
  };
  sub(`${tactic.us.name}  ${tactic.us.formation}`, tactic.us.color);
  if (tactic.opp) sub(`${tactic.opp.name}  ${tactic.opp.formation}`, tactic.opp.color);

  const rect = { x: pad, y: headH, w: pitchW, h: pitchH };
  drawScene(ctx, buildScene(tactic, roster, tactic.frames[0].positions, null), rect);

  const y = headH + pitchH + 30;
  if (bench.length) {
    ctx.textAlign = 'left'; ctx.fillStyle = theme.sub; ctx.font = `700 28px ${FONT}`;
    ctx.fillText('교체 명단', pad, y + 34);
    const top = y + 60;
    ctx.font = `700 30px ${FONT}`; ctx.textBaseline = 'middle';
    for (const c of chips) {
      ctx.fillStyle = theme.chip;
      ctx.beginPath(); ctx.roundRect(pad + c.x, top + c.y, c.w, chipH, chipH / 2); ctx.fill();
      ctx.fillStyle = theme.text; ctx.textAlign = 'center';
      ctx.fillText(c.label, pad + c.x + c.w / 2, top + c.y + chipH / 2 + 1);
    }
  }
  brand(ctx, theme, W - pad, H - 36, 28);
  return canvas;
}

export interface FrameCardOpts {
  width: number;
  label: string;
  note: string;
  theme?: Theme;
}

export function frameCardSize(width: number) {
  const s = width / 720;
  const head = Math.round(70 * s);
  const foot = Math.round(110 * s);
  return { width, head, foot, pitchH: Math.round(width * PITCH_ASPECT), height: Math.round(width * PITCH_ASPECT) + head + foot };
}

/** One tactic frame (still or animation step): header + pitch + note. */
export function drawFrameCard(ctx: CanvasRenderingContext2D, tactic: Tactic, scene: Scene, opts: FrameCardOpts) {
  const th = opts.theme ?? THEMES[0];
  const { width: W, head, pitchH, height: H } = frameCardSize(opts.width);
  const s = W / 720;
  bg(ctx, W, H, th);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = th.text; ctx.font = `800 ${26 * s}px ${FONT}`;
  ctx.fillText(tactic.name, 24 * s, head / 2, W * 0.62);
  ctx.textAlign = 'right'; ctx.fillStyle = th.sub; ctx.font = `700 ${22 * s}px ${FONT}`;
  ctx.fillText(opts.label, W - 24 * s, head / 2);
  drawScene(ctx, scene, { x: 0, y: head, w: W, h: pitchH });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = th.text; ctx.font = `600 ${24 * s}px ${FONT}`;
  const lines = wrapText(ctx, opts.note, W - 48 * s).slice(0, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, 24 * s, head + pitchH + 40 * s + i * 32 * s));
  brand(ctx, th, W - 20 * s, H - 14 * s, 17 * s);
}
