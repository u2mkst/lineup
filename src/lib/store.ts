import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { DEFAULT_FORMATION, roleGroup } from '../data/formations';
import { defaultRoster } from '../data/defaultRoster';
import type { Drawing, Frame, OppTeam, Player, Pt, Tactic } from '../types';
import { uid } from './id';
import { layoutFormation, rolesFor, tokenIds } from './layout';
import { toast } from './toast';
import { normalizePlayer, normalizeTactic } from './validate';

export const COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f8fafc', '#1e293b'];
const BALL_START: Pt = { x: 0.5, y: 0.5 };
const HISTORY_LIMIT = 60;
const STORAGE_KEY = 'chukgubang:v1';

function makeFrame(positions: Record<string, Pt>, ball: Pt = BALL_START, note = ''): Frame {
  return { id: uid(), note, drawings: [], positions, ball };
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

interface History {
  past: Tactic[];
  future: Tactic[];
  lastKey: string | null;
  lastAt: number;
}

interface State {
  roster: Player[];
  tactics: Tactic[];
  /** in-memory undo/redo stacks per tactic, never persisted */
  history: Record<string, History>;

  addTactic: () => string;
  duplicateTactic: (id: string) => string | null;
  deleteTactic: (id: string) => void;
  /**
   * Clone-mutate-replace helper for editing one tactic. Edits sharing a `key`
   * within a second (typing in a field) collapse into one undo step.
   */
  edit: (id: string, fn: (t: Tactic) => void, key?: string) => void;
  undo: (id: string) => void;
  redo: (id: string) => void;

  setFormation: (id: string, side: 'us' | 'opp', formation: string) => void;
  setOpponent: (id: string, on: boolean) => void;
  assignPlayer: (id: string, token: string, playerId: string | null) => void;
  autoFill: (id: string) => void;
  clearAssign: (id: string) => void;

  moveToken: (id: string, frame: number, token: string, pt: Pt) => void;
  moveBall: (id: string, frame: number, pt: Pt) => void;
  addFrame: (id: string, after: number) => number;
  deleteFrame: (id: string, index: number) => void;
  moveFrame: (id: string, from: number, to: number) => void;
  addDrawing: (id: string, frame: number, d: Omit<Drawing, 'id'>) => void;
  removeDrawing: (id: string, frame: number, drawingId: string) => void;
  clearDrawings: (id: string, frame: number) => void;
  resetLayout: (id: string) => void;

  setRoster: (r: Player[]) => void;
  resetRoster: () => void;
  /** Adds a tactic from a share link / backup. Returns the new id. */
  importTactic: (t: Tactic, players: Player[]) => string;
  /** Merges a backup file. Returns how many tactics were added. */
  importBackup: (raw: unknown) => number;
}

/** localStorage that never throws and keeps a copy of data it cannot parse. */
const safeStorage: StateStorage = {
  getItem: name => {
    try {
      const raw = localStorage.getItem(name);
      if (raw == null) return null;
      try {
        JSON.parse(raw);
      } catch {
        localStorage.setItem(`${name}:corrupt`, raw);
        return null;
      }
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      toast('저장 공간이 부족하거나 저장이 막혀 있어요. 백업 파일을 받아 두세요.', 'error');
    }
  },
  removeItem: name => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const edit: State['edit'] = (id, fn, key) =>
        set(s => {
          const prev = s.tactics.find(t => t.id === id);
          if (!prev) return s;
          const next = structuredClone(prev);
          fn(next);
          next.updatedAt = Date.now();
          const now = Date.now();
          const h = s.history[id] ?? { past: [], future: [], lastKey: null, lastAt: 0 };
          const merge = !!key && h.lastKey === key && now - h.lastAt < 1000;
          const history: History = {
            past: merge ? h.past : [...h.past, prev].slice(-HISTORY_LIMIT),
            future: [],
            lastKey: key ?? null,
            lastAt: now,
          };
          return {
            tactics: s.tactics.map(t => (t.id === id ? next : t)),
            history: { ...s.history, [id]: history },
          };
        });

      const relayout = (t: Tactic) => {
        const first = t.frames[0];
        first.positions = layoutPositions(t.us.formation, 'us', !!t.opp);
        if (t.opp) Object.assign(first.positions, layoutPositions(t.opp.formation, 'opp', true));
        first.drawings = [];
        t.frames = [first];
      };

      return {
        roster: defaultRoster(),
        tactics: [],
        history: {},

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
          c.name = `${src.name} 복사본`.slice(0, 24);
          c.updatedAt = Date.now();
          c.frames.forEach(f => {
            f.id = uid();
            f.drawings.forEach(d => (d.id = uid()));
          });
          set(s => ({ tactics: [c, ...s.tactics] }));
          return c.id;
        },
        deleteTactic: id =>
          set(s => {
            const { [id]: _drop, ...history } = s.history;
            void _drop;
            return { tactics: s.tactics.filter(t => t.id !== id), history };
          }),
        edit,
        undo: id =>
          set(s => {
            const h = s.history[id];
            const cur = s.tactics.find(t => t.id === id);
            if (!h || !cur || h.past.length === 0) return s;
            const prev = h.past[h.past.length - 1];
            return {
              tactics: s.tactics.map(t => (t.id === id ? prev : t)),
              history: { ...s.history, [id]: { past: h.past.slice(0, -1), future: [cur, ...h.future], lastKey: null, lastAt: 0 } },
            };
          }),
        redo: id =>
          set(s => {
            const h = s.history[id];
            const cur = s.tactics.find(t => t.id === id);
            if (!h || !cur || h.future.length === 0) return s;
            const [next, ...rest] = h.future;
            return {
              tactics: s.tactics.map(t => (t.id === id ? next : t)),
              history: { ...s.history, [id]: { past: [...h.past, cur], future: rest, lastKey: null, lastAt: 0 } },
            };
          }),

        setFormation: (id, side, formation) =>
          edit(id, t => {
            if (side === 'us') t.us.formation = formation;
            else if (t.opp) t.opp.formation = formation;
            // Slots change meaning with the shape, so tactic scenes restart from the first one.
            relayout(t);
          }),
        setOpponent: (id, on) =>
          edit(id, t => {
            if (on && !t.opp) t.opp = newOpp();
            if (!on) t.opp = null;
            relayout(t);
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
        moveFrame: (id, from, to) =>
          edit(id, t => {
            if (to < 0 || to >= t.frames.length || from === to) return;
            const [f] = t.frames.splice(from, 1);
            t.frames.splice(to, 0, f);
          }),
        addDrawing: (id, frame, d) =>
          edit(id, t => {
            const f = t.frames[frame];
            if (f && f.drawings.length < 40) f.drawings.push({ ...d, id: uid() });
          }),
        removeDrawing: (id, frame, drawingId) =>
          edit(id, t => {
            const f = t.frames[frame];
            if (f) f.drawings = f.drawings.filter(d => d.id !== drawingId);
          }),
        clearDrawings: (id, frame) =>
          edit(id, t => {
            if (t.frames[frame]) t.frames[frame].drawings = [];
          }),
        resetLayout: id => edit(id, relayout),

        setRoster: roster => set({ roster }),
        resetRoster: () => set({ roster: defaultRoster() }),
        importTactic: (t, players) => {
          const known = new Set(get().roster.map(p => p.id));
          const add = players.filter(p => !known.has(p.id));
          const copy = { ...structuredClone(t), id: uid(), updatedAt: Date.now() };
          set(s => ({ roster: [...s.roster, ...add], tactics: [copy, ...s.tactics] }));
          return copy.id;
        },
        importBackup: raw => {
          const r = raw as { roster?: unknown; tactics?: unknown } | null;
          if (!r || typeof r !== 'object' || !Array.isArray(r.tactics)) throw new Error('올바른 백업 파일이 아니에요');
          const players = (Array.isArray(r.roster) ? r.roster : []).flatMap(p => normalizePlayer(p) ?? []);
          const have = new Set(get().tactics.map(t => t.id));
          const incoming = r.tactics.flatMap(t => normalizeTactic(t) ?? []).filter(t => !have.has(t.id));
          const known = new Set(get().roster.map(p => p.id));
          set(s => ({
            roster: [...s.roster, ...players.filter(p => !known.has(p.id))],
            tactics: [...incoming, ...s.tactics],
          }));
          return incoming.length;
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: s => ({ roster: s.roster, tactics: s.tactics }),
      // v1 frames had no drawings; rebuild everything through the validator.
      migrate: persisted => {
        const p = persisted as { roster?: unknown; tactics?: unknown };
        return {
          roster: Array.isArray(p?.roster) ? p.roster.flatMap(x => normalizePlayer(x) ?? []) : defaultRoster(),
          tactics: (Array.isArray(p?.tactics) ? p.tactics : []).flatMap(x => normalizeTactic(x) ?? []),
        } as never;
      },
    },
  ),
);
