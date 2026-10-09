import { useRef, useState } from 'react';
import { inkFor } from '../lib/scene';
import type { Pt, Scene, SceneToken } from '../types';

const W = 600;
const H = 800;
const R = 24;
const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v));

interface Props {
  scene: Scene;
  interactive: boolean;
  /** ball can be dragged (tactic mode only) */
  ballDraggable?: boolean;
  selectedId?: string | null;
  onMoveToken?: (id: string, pt: Pt) => void;
  onMoveBall?: (pt: Pt) => void;
  onTapToken?: (id: string) => void;
}

type Drag = { id: string; pt: Pt; sx: number; sy: number; moved: boolean };

function PitchLines() {
  const stroke = { stroke: 'rgba(255,255,255,.85)', strokeWidth: 3, fill: 'none' } as const;
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={0} y={i * 80} width={W} height={80} fill={i % 2 ? '#2d8a4b' : '#31944f'} />
      ))}
      <rect x={24} y={24} width={552} height={752} {...stroke} />
      <line x1={24} y1={400} x2={576} y2={400} {...stroke} />
      <ellipse cx={300} cy={400} rx={76} ry={66} {...stroke} />
      <circle cx={300} cy={400} r={4} fill="rgba(255,255,255,.85)" />
      <rect x={122} y={24} width={356} height={126} {...stroke} />
      <rect x={220} y={24} width={160} height={44} {...stroke} />
      <rect x={122} y={650} width={356} height={126} {...stroke} />
      <rect x={220} y={732} width={160} height={44} {...stroke} />
      <circle cx={300} cy={110} r={4} fill="rgba(255,255,255,.85)" />
      <circle cx={300} cy={690} r={4} fill="rgba(255,255,255,.85)" />
      <path d="M 244 150 A 76 66 0 0 0 356 150" {...stroke} />
      <path d="M 244 650 A 76 66 0 0 1 356 650" {...stroke} />
    </g>
  );
}

export function Pitch({ scene, interactive, ballDraggable, selectedId, onMoveToken, onMoveBall, onTapToken }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const toPt = (e: React.PointerEvent): Pt => {
    const b = svg.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) };
  };

  const down = (id: string) => (e: React.PointerEvent) => {
    if (!interactive) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ id, pt: toPt(e), sx: e.clientX, sy: e.clientY, moved: false });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6;
    setDrag({ ...drag, pt: toPt(e), moved });
  };
  const up = () => {
    if (!drag) return;
    if (drag.moved) {
      if (drag.id === 'ball') onMoveBall?.(drag.pt);
      else onMoveToken?.(drag.id, drag.pt);
    } else if (drag.id !== 'ball') {
      onTapToken?.(drag.id);
    }
    setDrag(null);
  };

  const place = (tk: SceneToken): SceneToken =>
    drag && drag.moved && drag.id === tk.id ? { ...tk, x: drag.pt.x, y: drag.pt.y } : tk;
  const ball = scene.ball && (drag?.moved && drag.id === 'ball' ? drag.pt : scene.ball);
  const tokens = scene.tokens.map(place).sort((a, b) => a.y - b.y);

  return (
    <svg
      ref={svg}
      className="pitch"
      viewBox={`0 0 ${W} ${H}`}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
    >
      <defs>
        <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(255,255,255,.85)" />
        </marker>
      </defs>
      <PitchLines />
      {scene.trails.map(t => {
        const a = { x: t.from.x * W, y: t.from.y * H };
        const b = { x: t.to.x * W, y: t.to.y * H };
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const k = (R + 4) / d;
        return (
          <line
            key={t.id} x1={a.x + (b.x - a.x) * k} y1={a.y + (b.y - a.y) * k}
            x2={b.x - (b.x - a.x) * (k + 0.02)} y2={b.y - (b.y - a.y) * (k + 0.02)}
            stroke="rgba(255,255,255,.8)" strokeWidth={3} strokeDasharray="7 6" markerEnd="url(#arrowHead)"
          />
        );
      })}
      {tokens.map(tk => {
        const cx = tk.x * W;
        const cy = tk.y * H;
        const selected = selectedId === tk.id;
        return (
          <g
            key={tk.id}
            className={`token${interactive ? ' interactive' : ''}`}
            transform={`translate(${cx} ${cy})`}
            onPointerDown={down(tk.id)}
          >
            <circle r={R + 12} fill="transparent" />
            {selected && <circle r={R + 7} fill="none" stroke="#fde047" strokeWidth={4} />}
            {tk.empty ? (
              <>
                <circle r={R} fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.85)" strokeWidth={2.5} strokeDasharray="6 5" />
                <text className="tk-role" y={1}>{tk.role}</text>
              </>
            ) : (
              <>
                <circle r={R} fill={tk.color} stroke="#fff" strokeWidth={3} />
                <text className="tk-num" y={1} fill={inkFor(tk.color)} fontSize={tk.number.length > 2 ? 17 : 22}>{tk.number}</text>
                {tk.name && <text className="tk-name" y={R + 17}>{tk.name}</text>}
              </>
            )}
          </g>
        );
      })}
      {ball && (
        <g
          className={`ball${ballDraggable && interactive ? ' interactive' : ''}`}
          transform={`translate(${ball.x * W} ${ball.y * H})`}
          onPointerDown={ballDraggable ? down('ball') : undefined}
        >
          <circle r={22} fill="transparent" />
          <circle r={12} fill="#fff" stroke="#111827" strokeWidth={2} />
          <path d="M0 -6 L6 -2 L4 5 L-4 5 L-6 -2 z" fill="#111827" />
        </g>
      )}
    </svg>
  );
}
