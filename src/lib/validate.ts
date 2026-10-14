import { DEFAULT_FORMATION, formationRoles } from '../data/formations';
import type { DrawKind, Drawing, Frame, OppTeam, Player, Pos, Pt, Tactic } from '../types';
import { uid } from './id';
import { layoutFormation, tokenIds } from './layout';

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback: string, max = 40) => (typeof v === 'string' ? v.slice(0, max) : fallback);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);
const formation = (v: unknown, fallback: string) => (typeof v === 'string' && v in formationRoles ? v : fallback);
const POS: Pos[] = ['GK', 'DF', 'MF', 'FW'];
const KINDS: DrawKind[] = ['run', 'pass', 'zone'];

function pt(v: unknown, fallback: Pt): Pt {
  return isObj(v) ? { x: clamp01(num(v.x, fallback.x)), y: clamp01(num(v.y, fallback.y)) } : fallback;
}

export function normalizePlayer(raw: unknown): Player | null {
  if (!isObj(raw)) return null;
  const pos = POS.includes(raw.pos as Pos) ? (raw.pos as Pos) : 'MF';
  return { id: str(raw.id, '', 60) || uid(), number: str(raw.number, '', 3), name: str(raw.name, '', 8), pos };
}

function normalizeFrame(raw: unknown, base: Record<string, Pt>): Frame {
  const r = isObj(raw) ? raw : {};
  const rp = isObj(r.positions) ? r.positions : {};
  const positions: Record<string, Pt> = {};
  for (const id of Object.keys(base)) positions[id] = pt(rp[id], base[id]);
  const drawings: Drawing[] = Array.isArray(r.drawings)
    ? r.drawings.flatMap((d): Drawing[] => {
        if (!isObj(d) || !KINDS.includes(d.kind as DrawKind)) return [];
        return [{ id: str(d.id, '', 60) || uid(), kind: d.kind as DrawKind, a: pt(d.a, { x: 0.5, y: 0.5 }), b: pt(d.b, { x: 0.5, y: 0.5 }) }];
      }).slice(0, 40)
    : [];
  return { id: str(r.id, '', 60) || uid(), note: str(r.note, '', 60), drawings, positions, ball: pt(r.ball, { x: 0.5, y: 0.5 }) };
}

/** Rebuilds a tactic from untrusted data (share links, backups, old storage). */
export function normalizeTactic(raw: unknown): Tactic | null {
  if (!isObj(raw) || !isObj(raw.us) || !Array.isArray(raw.frames) || raw.frames.length === 0) return null;
  const us = raw.us;
  const usF = formation(us.formation, DEFAULT_FORMATION);
  const rawAssign = isObj(us.assign) ? us.assign : {};
  const assign: Record<string, string | null> = {};
  for (const id of tokenIds('us')) assign[id] = typeof rawAssign[id] === 'string' ? (rawAssign[id] as string) : null;

  let opp: OppTeam | null = null;
  if (isObj(raw.opp)) {
    const o = raw.opp;
    const rl = isObj(o.labels) ? o.labels : {};
    const labels: OppTeam['labels'] = {};
    tokenIds('opp').forEach((id, i) => {
      const l = isObj(rl[id]) ? (rl[id] as Raw) : {};
      labels[id] = { number: str(l.number, String(i + 1), 3), name: str(l.name, '', 8) };
    });
    opp = { name: str(o.name, '상대팀', 12), color: color(o.color, '#ef4444'), formation: formation(o.formation, '4-4-2'), labels };
  }

  const base: Record<string, Pt> = {};
  layoutFormation(usF, 'us', !!opp).forEach((p, i) => (base[`u${i}`] = p));
  if (opp) layoutFormation(opp.formation, 'opp', true).forEach((p, i) => (base[`o${i}`] = p));

  return {
    id: str(raw.id, '', 60) || uid(),
    name: str(raw.name, '전술', 24),
    updatedAt: num(raw.updatedAt, Date.now()),
    us: { name: str(us.name, '우리팀', 12), color: color(us.color, '#2563eb'), formation: usF, assign },
    opp,
    frames: raw.frames.slice(0, 30).map(f => normalizeFrame(f, base)),
  };
}
