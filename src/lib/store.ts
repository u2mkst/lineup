import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_FORMATION, roleGroup } from '../data/formations';
import { defaultRoster } from '../data/defaultRoster';
import type { Frame, OppTeam, Player, Pt, Tactic } from '../types';
import { uid } from './id';
import { layoutFormation, rolesFor, tokenIds } from './layout';

export const COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f8fafc', '#1e293b'];
const BALL_START: Pt = { x: 0.5, y: 0.5 };

function makeFrame(positions: Record<string, Pt>, ball: Pt = BALL_START, note = ''): Frame {
  return { id: uid(), note, positions, ball };
}

function layoutPositions(formation: string, side: 'us' | 'opp', hasOpp: boolean): Record<string, Pt> {
  const pts = layoutFormation(formation, side, hasOpp);
  return Object.fromEntries(tokenIds(side).map((id, i) => [id, pts[i]]));
}

function newOpp(): OppTeam {
  return {
    name: '상대팀',
    color: COLORS[1],
    formation: '4-4-2',
    labels: Object.fromEntries(tokenIds('opp').map((id, i) => [id, { number: String(i + 1), name: '' }])),
  };
}

export function createTactic(name: string): Tactic {
  return {
    id: uid(),
    name,
    updatedAt: Date.now(),
    us: {
      name: '우리팀',
      color: COLORS[0],
      formation: DEFAULT_FORMATION,
      assign: Object.fromEntries(tokenIds('us').map(id => [id, null])),
    },
    opp: null,
    frames: [makeFrame(layoutPositions(DEFAULT_FORMATION, 'us', false))],
  };
}

interface State {
  roster: Player[];
  tactics: Tactic[];

  addTactic: () => string;
  duplicateTactic: (id: string) => string | null;
  deleteTactic: (id: string) => void;
  /** Clone-mutate-replace helper for editing a single tactic. */
  edit: (id: string, fn: (t: Tactic) => void) => void;

  setFormation: (id: string, side: 'us' | 'opp', formation: string) => void;
  setOpponent: (id: string, on: boolean) => void;
  assignPlayer: (id: string, token: string, playerId: string | null) => void;
  autoFill: (id: string) => void;
  clearAssign: (id: string) => void;

  moveToken: (id: string, frame: number, token: string, pt: Pt) => void;
  moveBall: (id: string, frame: number, pt: Pt) => void;
  addFrame: (id: string, after: number) => number;
  deleteFrame: (id: string, index: number) => void;
  resetLayout: (id: string) => void;

  setRoster: (r: Player[]) => void;
  resetRoster: () => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const edit: State['edit'] = (id, fn) =>
        set(s => ({
          tactics: s.tactics.map(t => {
            if (t.id !== id) return t;
            const c = structuredClone(t);
            fn(c);
            c.updatedAt = Date.now();
            return c;
          }),
        }));

      return {
        roster: defaultRoster(),
        tactics: [],

        addTactic: () => {
          const t = createTactic(`새 전술 ${get().tactics.length + 1}`);
          set(s => ({ tactics: [t, ...s.tactics] }));
          return t.id;
        },
        duplicateTactic: id => {
          const src = get().tactics.find(t => t.id === id);
          if (!src) return null;
          const c = structuredClone(src);
          c.id = uid();
          c.name = `${src.name} 복사본`;
          c.updatedAt = Date.now();
          c.frames.forEach(f => (f.id = uid()));
          set(s => ({ tactics: [c, ...s.tactics] }));
          return c.id;
        },
        deleteTactic: id => set(s => ({ tactics: s.tactics.filter(t => t.id !== id) })),
        edit,

        setFormation: (id, side, formation) =>
          edit(id, t => {
            const hasOpp = !!t.opp;
            if (side === 'us') t.us.formation = formation;
            else if (t.opp) t.opp.formation = formation;
            // Slots change meaning with the shape, so tactic scenes restart from the first one.
            const fresh = layoutPositions(formation, side, hasOpp);
            const first = t.frames[0];
            Object.assign(first.positions, fresh);
            t.frames = [first];
          }),
        setOpponent: (id, on) =>
          edit(id, t => {
            if (on && !t.opp) t.opp = newOpp();
            if (!on) t.opp = null;
            const hasOpp = !!t.opp;
            const first = t.frames[0];
            first.positions = layoutPositions(t.us.formation, 'us', hasOpp);
            if (t.opp) Object.assign(first.positions, layoutPositions(t.opp.formation, 'opp', true));
            t.frames = [first];
          }),
        assignPlayer: (id, token, playerId) =>
          edit(id, t => {
            if (playerId) {
              for (const k of Object.keys(t.us.assign)) if (t.us.assign[k] === playerId) t.us.assign[k] = null;
            }
            t.us.assign[token] = playerId;
          }),
        autoFill: id =>
          edit(id, t => {
            const used = new Set<string>();
            const roles = rolesFor(t.us.formation);
            const { roster } = get();
            const tokens = tokenIds('us');
            const pick = (pred: (p: Player) => boolean) => roster.find(p => !used.has(p.id) && pred(p));
            // Two passes so exact-position matches win over fallbacks.
            const out: Record<string, string | null> = Object.fromEntries(tokens.map(k => [k, null]));
            tokens.forEach((k, i) => {
              const p = pick(pl => pl.pos === roleGroup(roles[i]));
              if (p) { out[k] = p.id; used.add(p.id); }
            });
            tokens.forEach((k, i) => {
              if (out[k]) return;
              const p = pick(pl => (roles[i] === 'GK' ? pl.pos === 'GK' : pl.pos !== 'GK'));
              if (p) { out[k] = p.id; used.add(p.id); }
            });
            t.us.assign = out;
          }),
        clearAssign: id =>
          edit(id, t => {
            for (const k of Object.keys(t.us.assign)) t.us.assign[k] = null;
          }),

        moveToken: (id, frame, token, pt) =>
          edit(id, t => {
            if (t.frames[frame]) t.frames[frame].positions[token] = pt;
          }),
        moveBall: (id, frame, pt) =>
          edit(id, t => {
            if (t.frames[frame]) t.frames[frame].ball = pt;
          }),
        addFrame: (id, after) => {
          let index = after + 1;
          edit(id, t => {
            const src = t.frames[after] ?? t.frames[t.frames.length - 1];
            const copy = makeFrame(structuredClone(src.positions), { ...src.ball });
            index = Math.min(after + 1, t.frames.length);
            t.frames.splice(index, 0, copy);
          });
          return index;
        },
        deleteFrame: (id, index) =>
          edit(id, t => {
            if (t.frames.length > 1) t.frames.splice(index, 1);
          }),
        resetLayout: id =>
          edit(id, t => {
            const hasOpp = !!t.opp;
            const first = t.frames[0];
            first.positions = layoutPositions(t.us.formation, 'us', hasOpp);
            if (t.opp) Object.assign(first.positions, layoutPositions(t.opp.formation, 'opp', true));
            t.frames = [first];
          }),

        setRoster: roster => set({ roster }),
        resetRoster: () => set({ roster: defaultRoster() }),
      };
    },
    { name: 'chukgubang:v1', version: 1 },
  ),
);
