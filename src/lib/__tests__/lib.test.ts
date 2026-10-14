import { beforeEach, describe, expect, it } from 'vitest';
import { formationRoles } from '../../data/formations';
import { HOLD, MOVE, sampleAt, totalDuration } from '../anim';
import { layoutFormation, rolesFor } from '../layout';
import { buildPayload, decodePayload, encodePayload } from '../share';
import { useStore } from '../store';
import { normalizeTactic } from '../validate';

const fresh = () => {
  useStore.setState({ tactics: [], history: {} });
  const id = useStore.getState().addTactic();
  return id;
};
const get = (id: string) => useStore.getState().tactics.find(t => t.id === id)!;

describe('layout', () => {
  it('places 11 in-bounds players per formation, goalkeeper first', () => {
    for (const f of Object.keys(formationRoles)) {
      for (const side of ['us', 'opp'] as const) {
        for (const hasOpp of [false, true]) {
          const pts = layoutFormation(f, side, hasOpp);
          expect(pts).toHaveLength(11);
          expect(rolesFor(f)).toHaveLength(11);
          expect(rolesFor(f)[0]).toBe('GK');
          pts.forEach(p => { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(1); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(1); });
        }
      }
    }
  });
  it('keeps both teams in their own half when facing each other', () => {
    expect(Math.min(...layoutFormation('4-3-3', 'us', true).map(p => p.y))).toBeGreaterThan(0.5);
    expect(Math.max(...layoutFormation('4-3-3', 'opp', true).map(p => p.y))).toBeLessThan(0.5);
  });
});

describe('anim', () => {
  const mk = (x: number, n: string) => ({ id: n, note: n, drawings: [{ id: `d${n}`, kind: 'run' as const, a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }], positions: { u0: { x, y: 0.5 } }, ball: { x, y: 0.5 } });
  const frames = [mk(0, 'a'), mk(1, 'b')];
  it('holds, travels, then lands on the last frame', () => {
    expect(totalDuration(2)).toBe(HOLD + MOVE + HOLD);
    expect(sampleAt(frames, 0).positions.u0.x).toBe(0);
    const mid = sampleAt(frames, HOLD + MOVE / 2);
    expect(mid.positions.u0.x).toBeCloseTo(0.5, 5);
    expect(mid.noteIndex).toBe(1);
    expect(sampleAt(frames, 1e9).positions.u0.x).toBe(1);
  });
  it('cross-fades annotations while moving', () => {
    expect(sampleAt(frames, 100).drawings.map(d => d.id)).toEqual(['da']);
    expect(sampleAt(frames, HOLD + MOVE / 2).drawings).toEqual([]);
    expect(sampleAt(frames, HOLD + MOVE).drawings.map(d => d.id)).toEqual(['db']);
  });
});

describe('validate / share', () => {
  beforeEach(() => useStore.setState({ tactics: [], history: {} }));
  it('rejects garbage and repairs bad numbers', () => {
    expect(normalizeTactic(null)).toBeNull();
    expect(normalizeTactic({ us: {}, frames: [] })).toBeNull();
    const t = normalizeTactic({ us: { formation: 'nope', color: 'red' }, frames: [{ positions: { u0: { x: 9, y: -3 } } }] })!;
    expect(t.us.formation).toBe('4-2-3-1');
    expect(t.us.color).toBe('#2563eb');
    expect(t.frames[0].positions.u0).toEqual({ x: 1, y: 0 });
    expect(Object.keys(t.frames[0].positions)).toHaveLength(11);
  });
  it('round-trips a tactic through a share code', async () => {
    const id = fresh();
    const s = useStore.getState();
    s.autoFill(id);
    s.setOpponent(id, true);
    s.addFrame(id, 0);
    s.addDrawing(id, 1, { kind: 'pass', a: { x: 0.2, y: 0.3 }, b: { x: 0.6, y: 0.4 } });
    const t = get(id);
    const code = await encodePayload(buildPayload(t, s.roster));
    const back = await decodePayload(code);
    expect(back).not.toBeNull();
    expect(back!.tactic.us.assign).toEqual(t.us.assign);
    expect(back!.tactic.frames).toHaveLength(2);
    expect(back!.tactic.frames[1].drawings[0].kind).toBe('pass');
    expect(back!.tactic.opp?.formation).toBe('4-4-2');
    expect(back!.players.length).toBe(11);
    expect(code.length).toBeLessThan(2500);
  });
  it('returns null for broken codes', async () => {
    expect(await decodePayload('z.@@@')).toBeNull();
    expect(await decodePayload('x.abc')).toBeNull();
    expect(await decodePayload('')).toBeNull();
  });
});

describe('store', () => {
  it('undoes and redoes edits, and clears redo on a new edit', () => {
    const id = fresh();
    const s = useStore.getState();
    s.moveToken(id, 0, 'u3', { x: 0.1, y: 0.1 });
    s.moveToken(id, 0, 'u3', { x: 0.9, y: 0.9 });
    s.undo(id);
    expect(get(id).frames[0].positions.u3).toEqual({ x: 0.1, y: 0.1 });
    s.redo(id);
    expect(get(id).frames[0].positions.u3).toEqual({ x: 0.9, y: 0.9 });
    s.undo(id);
    s.moveToken(id, 0, 'u3', { x: 0.5, y: 0.5 });
    expect(useStore.getState().history[id].future).toHaveLength(0);
  });
  it('merges keyed edits into one undo step', () => {
    const id = fresh();
    const { edit, undo } = useStore.getState();
    const before = get(id).name;
    for (const n of ['a', 'ab', 'abc']) edit(id, t => { t.name = n; }, 'name');
    undo(id);
    expect(get(id).name).toBe(before);
  });
  it('reorders frames and resets scenes when the formation changes', () => {
    const id = fresh();
    const s = useStore.getState();
    s.addFrame(id, 0);
    s.addFrame(id, 1);
    s.edit(id, t => { t.frames.forEach((f, i) => (f.note = String(i))); });
    s.moveFrame(id, 0, 2);
    expect(get(id).frames.map(f => f.note)).toEqual(['1', '2', '0']);
    s.setFormation(id, 'us', '4-3-3');
    expect(get(id).frames).toHaveLength(1);
    expect(get(id).us.formation).toBe('4-3-3');
  });
  it('keeps one player in one slot only', () => {
    const id = fresh();
    const s = useStore.getState();
    s.assignPlayer(id, 'u1', 'p1');
    s.assignPlayer(id, 'u2', 'p1');
    expect(get(id).us.assign.u1).toBeNull();
    expect(get(id).us.assign.u2).toBe('p1');
  });
  it('imports backups defensively', () => {
    expect(() => useStore.getState().importBackup({ nope: 1 })).toThrow();
    const id = fresh();
    const t = get(id);
    expect(useStore.getState().importBackup({ tactics: [t, { broken: true }] })).toBe(0); // same id already present
    useStore.setState({ tactics: [] });
    expect(useStore.getState().importBackup({ tactics: [t, { broken: true }] })).toBe(1);
  });
});
