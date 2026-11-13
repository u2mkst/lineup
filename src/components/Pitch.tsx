import { useRef, useState } from 'react';
import { controlPoint, mid } from '../lib/curve';
import { inkFor, shade } from '../lib/scene';
import type { DrawKind, Pt, Scene, SceneToken, SceneTrail } from '../types';

const W = 600;
const H = 800;
const R = 24;
const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v));
export const PASS_COLOR = '#fde047';

export type Tool = 'move' | 'select' | DrawKind | 'erase';

interface Props {
  scene: Scene;
  interactive: boolean;
  tool?: Tool;
  /** ball can be dragged (tactic mode only) */
  ballDraggable?: boolean;
  selectedId?: string | null;
  /** players picked with the select tool */
  selectedIds?: string[];
  mini?: boolean;
  onMoveToken?: (id: string, pt: Pt) => void;
  onMoveBall?: (pt: Pt) => void;
  onTapToken?: (id: string) => void;
  onDraw?: (d: { kind: DrawKind; a: Pt; b: Pt }) => void;
  onErase?: (id: string) => void;
  /** bend a movement trail; `null` straightens it again */
  onVia?: (id: string, pt: Pt | null) => void;
  onSelect?: (ids: string[]) => void;
  /** group drag with the select tool */
  onMoveMany?: (moves: Record<string, Pt>) => void;
}

type Drag = { id: string; pt: Pt; start: Pt; sx: number; sy: number; moved: boolean; group: string[] };
type Draft = { kind: DrawKind; a: Pt; b: Pt };
type Marquee = { a: Pt; b: Pt };

function PitchLines() {
  const stroke = { stroke: 'rgba(255,255,255,.85)', strokeWidth: 3, fill: 'none' } as const;
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={0} y={i * 80} width={W} height={80} fill={i % 2 ? '#2b8447' : '#318f4f'} />
      ))}
      <rect width={W} height={H} fill="url(#vignette)" />
      <rect x={24} y={24} width={552} height={752} {...stroke} />
      <line x1={24} y1={400} x2={576} y2={400} {...stroke} />
      <ellipse cx={300} cy={400} rx={76} ry={66} {...stroke} />
      <circle cx={300} cy={400} r={4} fill="rgba(255,255,255,.85)" />
      <rect x={122} y={24} width={356} height={126} {...stroke} />
      <rect x={220} y={24} width={160} height={44} {...stroke} />
      <rect x={122} y={650} width={356} height={126} {...stroke} />
      <rect x={220} y={732} width={160} height={44} {...stroke} />
      <rect x={262} y={10} width={76} height={14} {...stroke} />
      <rect x={262} y={776} width={76} height={14} {...stroke} />
      <circle cx={300} cy={110} r={4} fill="rgba(255,255,255,.85)" />
      <circle cx={300} cy={690} r={4} fill="rgba(255,255,255,.85)" />
      <path d="M 244 150 A 76 66 0 0 0 356 150" {...stroke} />
      <path d="M 244 650 A 76 66 0 0 1 356 650" {...stroke} />
      <path d="M 24 34 A 10 10 0 0 0 34 24" {...stroke} />
      <path d="M 566 24 A 10 10 0 0 0 576 34" {...stroke} />
      <path d="M 24 766 A 10 10 0 0 1 34 776" {...stroke} />
      <path d="M 576 766 A 10 10 0 0 0 566 776" {...stroke} />
    </g>
  );
}

/** Straight arrow in the 600x800 space: shaft end is pulled back so the head tip sits on `b`. */
function arrowGeom(a: Pt, b: Pt, w: number) {
  const ax = a.x * W; const ay = a.y * H; const bx = b.x * W; const by = b.y * H;
  const ang = Math.atan2(by - ay, bx - ax);
  const h = w * 4;
  const pt = (rot: number) => `${bx - Math.cos(ang + rot) * h},${by - Math.sin(ang + rot) * h}`;
  return {
    x1: ax, y1: ay, x2: bx - Math.cos(ang) * h * 0.6, y2: by - Math.sin(ang) * h * 0.6,
    head: `${bx},${by} ${pt(-0.45)} ${pt(0.45)}`,
    len: Math.hypot(bx - ax, by - ay),
  };
}

/** SVG path for a movement trail, pulled back so it does not run under the markers. */
function trailGeom(t: SceneTrail, via: Pt | undefined) {
  const pad = (t.id === 'ball' ? 14 : R) + 4;
  const a = { x: t.from.x * W, y: t.from.y * H };
  const b = { x: t.to.x * W, y: t.to.y * H };
  const c = via ? controlPoint(a, b, { x: via.x * W, y: via.y * H }) : null;
  const unit = (p: Pt, q: Pt) => { const d = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: (q.x - p.x) / d, y: (q.y - p.y) / d }; };
  const s0 = unit(a, c ?? b);
  const e0 = unit(c ?? a, b);
  const S = { x: a.x + s0.x * pad, y: a.y + s0.y * pad };
  const E = { x: b.x - e0.x * (pad + 4), y: b.y - e0.y * (pad + 4) };
  const handle = via ? { x: via.x * W, y: via.y * H } : mid(a, b);
  return { d: c ? `M${S.x} ${S.y} Q${c.x} ${c.y} ${E.x} ${E.y}` : `M${S.x} ${S.y} L${E.x} ${E.y}`, handle, len: Math.hypot(b.x - a.x, b.y - a.y) };
}

function DrawingShape({ kind, a, b, alpha = 1 }: { kind: DrawKind; a: Pt; b: Pt; alpha?: number }) {
  if (kind === 'zone') {
    const r = Math.hypot((b.x - a.x) * W, (b.y - a.y) * H);
    return <circle cx={a.x * W} cy={a.y * H} r={r} fill="rgba(52,211,153,.24)" stroke="#34d399" strokeWidth={3} strokeDasharray="8 6" opacity={alpha} />;
  }
  const color = kind === 'pass' ? PASS_COLOR : 'rgba(255,255,255,.92)';
  const g = arrowGeom(a, b, kind === 'pass' ? 4.5 : 4);
  if (g.len < 14) return null;
  return (
    <g opacity={alpha}>
      <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={color} strokeWidth={kind === 'pass' ? 4.5 : 4} strokeLinecap="round" strokeDasharray={kind === 'run' ? '9 7' : undefined} />
      <polygon points={g.head} fill={color} />
    </g>
  );
}

export function Pitch({
  scene, interactive, tool = 'move', ballDraggable, selectedId, selectedIds = [], mini,
  onMoveToken, onMoveBall, onTapToken, onDraw, onErase, onVia, onSelect, onMoveMany,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const drawing = interactive && (tool === 'run' || tool === 'pass' || tool === 'zone');
  const selecting = interactive && tool === 'select';
  const moving = interactive && (tool === 'move' || tool === 'select');

  const toPt = (e: React.PointerEvent): Pt => {
    const b = svg.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) };
  };

  const down = (id: string) => (e: React.PointerEvent) => {
    if (!moving) return;
    e.preventDefault();
    e.stopPropagation(); // keep the pitch background (marquee) out of it
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const pt = toPt(e);
    // With the select tool a selected player drags the whole selection along.
    const group = selecting && selectedIds.includes(id) ? selectedIds : [id];
    setDrag({ id, pt, start: pt, sx: e.clientX, sy: e.clientY, moved: false, group });
  };
  const svgDown = (e: React.PointerEvent) => {
    if (!interactive || tool === 'move' || tool === 'erase') return;
    e.preventDefault();
    svg.current!.setPointerCapture(e.pointerId);
    const p = toPt(e);
    if (tool === 'select') setMarquee({ a: p, b: p });
    else setDraft({ kind: tool, a: p, b: p });
  };
  const move = (e: React.PointerEvent) => {
    if (marquee) { setMarquee({ ...marquee, b: toPt(e) }); return; }
    if (draft) { setDraft({ ...draft, b: toPt(e) }); return; }
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6;
    setDrag({ ...drag, pt: toPt(e), moved });
  };
  /** where each dragged player ends up: everyone shifts by the same amount, kept inside the pitch */
  const groupMoves = (d: Drag): Record<string, Pt> => {
    const dx = d.pt.x - d.start.x;
    const dy = d.pt.y - d.start.y;
    const out: Record<string, Pt> = {};
    for (const tk of scene.tokens) if (d.group.includes(tk.id)) out[tk.id] = { x: clamp(tk.x + dx), y: clamp(tk.y + dy) };
    return out;
  };
  const up = () => {
    if (marquee) {
      const x0 = Math.min(marquee.a.x, marquee.b.x); const x1 = Math.max(marquee.a.x, marquee.b.x);
      const y0 = Math.min(marquee.a.y, marquee.b.y); const y1 = Math.max(marquee.a.y, marquee.b.y);
      const tiny = (x1 - x0) * W < 10 && (y1 - y0) * H < 10;
      onSelect?.(tiny ? [] : scene.tokens.filter(t => t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1).map(t => t.id));
      setMarquee(null);
      return;
    }
    if (draft) {
      if (Math.hypot((draft.b.x - draft.a.x) * W, (draft.b.y - draft.a.y) * H) > 14) onDraw?.(draft);
      setDraft(null);
      return;
    }
    if (!drag) return;
    if (drag.id.startsWith('via:')) {
      const id = drag.id.slice(4);
      if (drag.moved) onVia?.(id, drag.pt);
      else if (scene.trails.find(t => t.id === id)?.via) onVia?.(id, null);
    } else if (drag.moved) {
      if (drag.id === 'ball') onMoveBall?.(drag.pt);
      else if (selecting) onMoveMany?.(groupMoves(drag));
      else onMoveToken?.(drag.id, drag.pt);
    } else if (drag.id !== 'ball') {
      if (selecting) onSelect?.(selectedIds.includes(drag.id) ? selectedIds.filter(x => x !== drag.id) : [...selectedIds, drag.id]);
      else onTapToken?.(drag.id);
    }
    setDrag(null);
  };
  const cancel = () => { setDrag(null); setDraft(null); setMarquee(null); };

  const key = (tk: SceneToken) => (e: React.KeyboardEvent) => {
    if (!moving) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTapToken?.(tk.id); return; }
    const step = e.shiftKey ? 0.04 : 0.012;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); onMoveToken?.(tk.id, { x: clamp(tk.x + d[0]), y: clamp(tk.y + d[1]) }); }
  };

  const live = drag && drag.moved && !drag.id.startsWith('via:') && drag.id !== 'ball' ? (selecting ? groupMoves(drag) : { [drag.id]: drag.pt }) : null;
  const place = (tk: SceneToken): SceneToken => (live && live[tk.id] ? { ...tk, ...live[tk.id] } : tk);
  const ball = scene.ball && (drag?.moved && drag.id === 'ball' ? drag.pt : scene.ball);
  const tokens = scene.tokens.map(place).sort((a, b) => a.y - b.y);
  const colors = [...new Set(tokens.filter(t => !t.empty).map(t => t.color))];
  const cid = (c: string) => `tk-${c.slice(1)}`;

  return (
    <svg
      ref={svg}
      className={`pitch${drawing || selecting ? ' drawing' : ''}${mini ? ' mini' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      role={mini ? 'img' : undefined}
      onPointerDown={svgDown}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
    >
      <defs>
        <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".24" />
        </radialGradient>
        <filter id="tokShadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".4" />
        </filter>
        {colors.map(c => (
          <radialGradient key={c} id={cid(c)} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor={shade(c, 0.32)} />
            <stop offset="55%" stopColor={c} />
            <stop offset="100%" stopColor={shade(c, -0.22)} />
          </radialGradient>
        ))}
      </defs>
      <PitchLines />
      {scene.trails.map(t => {
        const live = drag?.moved && drag.id === `via:${t.id}` ? drag.pt : t.via;
        const g = trailGeom(t, live);
        if (g.len < 20) return null;
        return <path key={t.id} d={g.d} fill="none" stroke="rgba(255,255,255,.78)" strokeWidth={3} strokeDasharray="7 6" strokeLinecap="round" markerEnd="url(#arrowHead)" />;
      })}
      <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 z" fill="rgba(255,255,255,.85)" />
      </marker>
      {scene.drawings.map(d => (
        <g key={d.id}>
          <DrawingShape kind={d.kind} a={d.a} b={d.b} alpha={d.alpha} />
          {interactive && tool === 'erase' && (
            <g className="erase-hit" onPointerDown={e => { e.stopPropagation(); onErase?.(d.id); }}>
              {d.kind === 'zone'
                ? <circle cx={d.a.x * W} cy={d.a.y * H} r={Math.hypot((d.b.x - d.a.x) * W, (d.b.y - d.a.y) * H)} fill="transparent" />
                : <line x1={d.a.x * W} y1={d.a.y * H} x2={d.b.x * W} y2={d.b.y * H} stroke="transparent" strokeWidth={36} />}
            </g>
          )}
        </g>
      ))}
      {draft && <DrawingShape kind={draft.kind} a={draft.a} b={draft.b} alpha={0.9} />}
      {marquee && (
        <rect className="marquee" x={Math.min(marquee.a.x, marquee.b.x) * W} y={Math.min(marquee.a.y, marquee.b.y) * H}
          width={Math.abs(marquee.b.x - marquee.a.x) * W} height={Math.abs(marquee.b.y - marquee.a.y) * H} />
      )}
      {tokens.map(tk => {
        const selected = selectedId === tk.id;
        const label = `${tk.role} ${tk.name || tk.number || '빈 자리'}`;
        return (
          <g
            key={tk.id}
            className={`token${moving ? ' interactive' : ''}${tk.empty ? ' empty' : ''}`}
            transform={`translate(${tk.x * W} ${tk.y * H})`}
            onPointerDown={down(tk.id)}
            tabIndex={moving ? 0 : undefined}
            role={moving ? 'button' : undefined}
            aria-label={moving ? label : undefined}
            onKeyDown={moving ? key(tk) : undefined}
          >
            <circle r={R + 12} fill="transparent" />
            {selected && <circle className="sel-ring" r={R + 7} fill="none" stroke="#fde047" strokeWidth={4} />}
            {selectedIds.includes(tk.id) && <circle className="multi-ring" r={R + 7} fill="rgba(34,211,238,.16)" stroke="#22d3ee" strokeWidth={3.5} />}
            {tk.holder && <circle className="holder-ring" r={R + 5} fill="none" stroke="#fbbf24" strokeWidth={4} />}
            {tk.empty ? (
              <>
                <circle r={R} fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.85)" strokeWidth={2.5} strokeDasharray="6 5" />
                {!mini && <text className="tk-role" y={1}>{tk.role}</text>}
              </>
            ) : (
              <>
                <circle r={R} fill={`url(#${cid(tk.color)})`} stroke="#fff" strokeWidth={3} filter="url(#tokShadow)" />
                <text className="tk-num" y={1} fill={inkFor(tk.color)} fontSize={tk.number.length > 2 ? 17 : 22}>{tk.number}</text>
                {tk.name && !mini && <text className="tk-name" y={R + 17}>{tk.name}</text>}
              </>
            )}
          </g>
        );
      })}
      {moving && tool === 'move' && scene.trails.map(t => {
        const live = drag?.moved && drag.id === `via:${t.id}` ? drag.pt : t.via;
        const g = trailGeom(t, live);
        if (g.len < 20) return null;
        return (
          <g key={`h-${t.id}`} className={`via-handle${live ? ' bent' : ''}`} transform={`translate(${g.handle.x} ${g.handle.y})`} onPointerDown={down(`via:${t.id}`)}>
            <circle r={20} fill="transparent" />
            <circle r={8} />
          </g>
        );
      })}
      {ball && (
        <g
          className={`ball${ballDraggable && moving ? ' interactive' : ''}`}
          transform={`translate(${ball.x * W} ${ball.y * H})`}
          onPointerDown={ballDraggable ? down('ball') : undefined}
        >
          <circle r={22} fill="transparent" />
          <circle cx={0} cy={3} r={12} fill="rgba(0,0,0,.28)" />
          <circle r={12} fill="#fff" stroke="#111827" strokeWidth={2} />
          <path d="M0 -6 L6 -2 L4 5 L-4 5 L-6 -2 z" fill="#111827" />
        </g>
      )}
    </svg>
  );
}
