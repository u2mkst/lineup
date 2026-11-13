import { beforeEach, describe, expect, it } from 'vitest';
import { formationRoles } from '../../data/formations';
import { HOLD, MOVE, sampleAt, totalDuration } from '../anim';
import { along, controlPoint } from '../curve';
import { BALL_OFFSET, nearestHolder } from '../holder';
import { layoutFormation, rolesFor } from '../layout';
import { buildPayload, decodePayload, encodePayload } from '../share';
import { useStore } from '../store';
import { normalizePlayer, normalizeTactic } from '../validate';
import type { Match } from '../../types';

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
  const mk = (x: number, n: string) => ({ id: n, note: n, via: {}, subs: {}, timing: {}, holder: null, drawings: [{ id: `d${n}`, kind: 'run' as const, a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }], positions: { u0: { x, y: 0.5 } }, ball: { x, y: 0.5 } });
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

describe('curves', () => {
  const a = { x: 0, y: 1 };
  const b = { x: 1, y: 1 };
  it('passes through the via point halfway and keeps its endpoints', () => {
    const via = { x: 0.5, y: 0.2 };
    expect(along(a, b, via, 0)).toEqual(a);
    const m = along(a, b, via, 0.5);
    expect(m.x).toBeCloseTo(0.5, 9);
    expect(m.y).toBeCloseTo(0.2, 9);
    expect(along(a, b, via, 1)).toEqual(b);
    expect(controlPoint(a, b, { x: 0.5, y: 1 })).toEqual({ x: 0.5, y: 1 });
  });
  it('animates along the bend and straight when there is none', () => {
    const f = (x: number, via = {}) => ({ id: String(x), note: '', via, subs: {}, timing: {}, holder: null, drawings: [], positions: { u0: { x, y: 1 } }, ball: { x, y: 1 } });
    const bent = [f(0), f(1, { u0: { x: 0.5, y: 0.2 } })];
    const t = HOLD + MOVE / 2;
    expect(sampleAt(bent, t).positions.u0.y).toBeCloseTo(0.2, 6);
    expect(sampleAt([f(0), f(1)], t).positions.u0.y).toBe(1);
  });
  it('stores, clears and invalidates curves', () => {
    const id = fresh();
    const s = useStore.getState();
    s.addFrame(id, 0);
    s.setVia(id, 1, 'u3', { x: 0.4, y: 0.4 });
    expect(get(id).frames[1].via.u3).toEqual({ x: 0.4, y: 0.4 });
    s.setVia(id, 0, 'u3', { x: 0.1, y: 0.1 });            // first frame has no way in
    expect(get(id).frames[0].via).toEqual({});
    s.addFrame(id, 1);
    s.moveFrame(id, 1, 2);                                   // reordering resets curves
    expect(get(id).frames.every(f => Object.keys(f.via).length === 0)).toBe(true);
    s.setVia(id, 1, 'u3', { x: 0.4, y: 0.4 });
    s.setVia(id, 1, 'u3', null);
    expect(get(id).frames[1].via).toEqual({});
  });
  it('round-trips curves through a share code and drops junk', async () => {
    const id = fresh();
    const s = useStore.getState();
    s.addFrame(id, 0);
    s.setVia(id, 1, 'u3', { x: 0.4123456, y: 0.4 });
    s.setVia(id, 1, 'ball', { x: 0.2, y: 0.2 });
    const back = await decodePayload(await encodePayload(buildPayload(get(id), s.roster)));
    expect(back!.tactic.frames[1].via.u3.x).toBeCloseTo(0.412, 3);
    expect(back!.tactic.frames[1].via.ball).toEqual({ x: 0.2, y: 0.2 });
    const bad = normalizeTactic({ ...get(id), frames: [{ via: { nope: { x: 1, y: 1 }, u3: { x: 5, y: -1 } } }] })!;
    expect(bad.frames[0].via).toEqual({ u3: { x: 1, y: 0 } });
  });
});

describe('cloud sync', () => {
  const t = (id: string, updatedAt: number, extra = {}) => ({ ...normalizeTactic({ us: {}, frames: [{}] })!, id, updatedAt, ...extra });
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  it('pulls what is newer on the server and pushes what is newer here', async () => {
    const { planSync } = await import('../sync');
    const local = [t(A, 100), t(B, 300), t(C, 50)];
    const remote = [t(A, 200), t(B, 300), t('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 10)];
    const plan = planSync(local, remote);
    expect(plan.apply.map(x => x.id).sort()).toEqual([A, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'].sort()); // newer remote, remote-only
    expect(plan.push.map(x => x.id)).toEqual([C]);                                                       // local-only; B is in sync
  });
  it('never pushes tactics whose id is not a uuid', async () => {
    const { planSync } = await import('../sync');
    expect(planSync([t('not-a-uuid', 1)], []).push).toEqual([]);
  });
  it('keeps isPublic through validation but not through share links or copies', async () => {
    expect(normalizeTactic({ us: {}, frames: [{}], isPublic: true })!.isPublic).toBe(true);
    expect(normalizeTactic({ us: {}, frames: [{}], isPublic: 'yes' })!.isPublic).toBeUndefined();
    const id = fresh();
    useStore.getState().edit(id, x => { x.isPublic = true; });
    const back = await decodePayload(await encodePayload(buildPayload(get(id), useStore.getState().roster)));
    expect(back!.tactic.isPublic).toBeUndefined();
    const copy = useStore.getState().duplicateTactic(id)!;
    expect(get(copy).isPublic).toBeUndefined();
    expect(get(id).isPublic).toBe(true);
  });
});

describe('cloud errors and roster order', () => {
  it('explains database errors in plain Korean', async () => {
    const { explain } = await import('../cloud');
    expect(explain({ code: '23505' }).message).toContain('등번호');
    expect(explain({ code: '42501' }).message).toContain('관리자');
    expect(explain({ message: 'new row violates row-level security policy' }).message).toContain('관리자');
    expect(explain({ message: 'TypeError: Failed to fetch' }).message).toContain('인터넷');
  });
  it('sorts GK, DF, MF, FW and then by shirt number', async () => {
    const { sortRoster } = await import('../roster');
    const p = (number: string, pos: 'GK' | 'DF' | 'MF' | 'FW') => ({ id: number, number, name: number, pos });
    expect(sortRoster([p('9', 'FW'), p('10', 'MF'), p('2', 'DF'), p('1', 'GK'), p('3', 'DF')]).map(x => x.number)).toEqual(['1', '2', '3', '10', '9']);
  });
});

describe('substitutions', () => {
  it('applies subs from their frame onward and carries them when a frame is deleted', async () => {
    const { assignAt, benchAt } = await import('../assign');
    const id = fresh();
    const s = useStore.getState();
    s.assignPlayer(id, 'u5', 'p6');
    s.addFrame(id, 0); s.addFrame(id, 1); s.addFrame(id, 2);
    s.setSub(id, 1, 'u5', 'p8');                // frame 1: p8 replaces p6
    s.setSub(id, 0, 'u5', 'p99');               // frame 0 is the line-up itself: refused
    expect(get(id).frames[0].subs).toEqual({});
    expect(assignAt(get(id), 0).u5).toBe('p6');
    expect(assignAt(get(id), 1).u5).toBe('p8');
    expect(assignAt(get(id), 3).u5).toBe('p8');
    s.setSub(id, 2, 'u5', 'p10');
    expect(assignAt(get(id), 2).u5).toBe('p10');
    expect(benchAt(get(id), useStore.getState().roster, 2).some(p => p.id === 'p8')).toBe(true);
    s.deleteFrame(id, 1);                        // p8's entry must survive on the next frame...
    expect(get(id).frames[1].subs.u5).toBe('p10'); // ...unless that frame overrides it
    s.clearSub(id, 1, 'u5');
    s.deleteFrame(id, 1);
    expect(assignAt(get(id), 1).u5).toBe('p6');
  });
});

describe('timing and ball holder', () => {
  const frame = (x: number, extra = {}) => ({ id: String(x), note: '', via: {}, subs: {}, timing: {}, holder: null, drawings: [], positions: { u0: { x, y: 0.5 }, u1: { x, y: 0.2 } }, ball: { x, y: 0.5 }, ...extra });
  it('lets a player start late or arrive early', () => {
    const frames = [frame(0), frame(1, { timing: { u1: [0.5, 1] } })];
    const quarter = sampleAt(frames, HOLD + MOVE * 0.25);
    expect(quarter.positions.u0.x).toBeGreaterThan(0.05);   // moving
    expect(quarter.positions.u1.x).toBe(0);                  // still waiting
    expect(sampleAt(frames, HOLD + MOVE * 0.99).positions.u1.x).toBeGreaterThan(0.9);
    const early = [frame(0), frame(1, { timing: { u0: [0, 0.5] } })];
    expect(sampleAt(early, HOLD + MOVE * 0.5).positions.u0.x).toBeCloseTo(1, 5);
  });
  it('validates timing ranges', () => {
    const t = normalizeTactic({ us: {}, frames: [{}, { timing: { u1: [0.2, 0.9], u2: [0.5, 0.52], u3: 'x', ball: [0, 1] } }] })!;
    expect(t.frames[1].timing).toEqual({ u1: [0.2, 0.9] });
  });
  it('keeps the ball glued to its holder', () => {
    const id = fresh();
    const s = useStore.getState();
    const p = get(id).frames[0].positions.u9;
    s.moveBall(id, 0, p, 'u9');
    expect(get(id).frames[0].holder).toBe('u9');
    s.moveToken(id, 0, 'u9', { x: 0.3, y: 0.3 });
    expect(get(id).frames[0].ball.x).toBeCloseTo(0.3 + BALL_OFFSET.x, 5);
    s.moveTokens(id, 0, { u9: { x: 0.6, y: 0.4 }, u8: { x: 0.2, y: 0.2 } });
    expect(get(id).frames[0].ball.x).toBeCloseTo(0.6 + BALL_OFFSET.x, 5);
    expect(get(id).frames[0].positions.u8).toEqual({ x: 0.2, y: 0.2 });
    s.moveBall(id, 0, { x: 0.5, y: 0.5 }, null);
    expect(get(id).frames[0].holder).toBeNull();
    expect(get(id).frames[0].ball).toEqual({ x: 0.5, y: 0.5 });
  });
  it('snaps a dropped ball to the nearest player only when close', () => {
    const tokens = [{ id: 'u1', x: 0.5, y: 0.5 }, { id: 'u2', x: 0.9, y: 0.9 }];
    expect(nearestHolder(tokens, { x: 0.52, y: 0.51 })).toBe('u1');
    expect(nearestHolder(tokens, { x: 0.7, y: 0.7 })).toBeNull();
  });
});

describe('auto fill and set pieces', () => {
  const pl = (id: string, pos: 'GK' | 'DF' | 'MF' | 'FW', extra = {}) => ({ id, number: id, name: id, pos, ...extra });
  it('skips injured players and uses alternative positions', async () => {
    const { autoAssign } = await import('../autofill');
    const roster = [pl('gk', 'GK'), pl('d1', 'DF', { out: true }), pl('d2', 'DF'), pl('m1', 'MF', { altPos: ['DF'] }), pl('f1', 'FW')];
    // m1 is a natural MF, so with a CM slot he plays there and the injured d1 is only the last resort for LCB
    expect(autoAssign(roster, ['GK', 'LB', 'LCB', 'CM', 'ST'])).toEqual(['gk', 'd2', 'd1', 'm1', 'f1']);
    // without a midfield slot, m1 covers defence before the injured defender is used
    expect(autoAssign(roster, ['GK', 'LB', 'LCB', 'ST'])).toEqual(['gk', 'd2', 'm1', 'f1']);
  });
  it('still fills the pitch when everyone is out', async () => {
    const { autoAssign } = await import('../autofill');
    const r = autoAssign([pl('gk', 'GK', { out: true }), pl('d1', 'DF', { out: true })], ['GK', 'LB']);
    expect(r).toEqual(['gk', 'd1']);
  });
  it('every template has 11 in-bounds positions per frame and valid tokens', async () => {
    const { SET_PIECES } = await import('../../data/setpieces');
    expect(SET_PIECES.length).toBeGreaterThanOrEqual(6);
    for (const sp of SET_PIECES) {
      expect(sp.frames.length).toBeGreaterThanOrEqual(2);
      for (const f of sp.frames) {
        for (const list of [f.us, f.opp ?? f.us]) {
          expect(list).toHaveLength(11);
          list.forEach(p => { expect(p.x).toBeGreaterThan(0.02); expect(p.x).toBeLessThan(0.98); expect(p.y).toBeGreaterThan(0.02); expect(p.y).toBeLessThan(0.98); });
        }
        if (f.holder) expect(/^[uo]([0-9]|10)$/.test(f.holder)).toBe(true);
      }
    }
  });
  it('applies a template to our team, and to the opponent only when it is on', async () => {
    const { SET_PIECES } = await import('../../data/setpieces');
    const corner = SET_PIECES.find(s => s.id === 'corner-attack')!;
    const id = fresh();
    useStore.getState().applyTemplate(id, corner.frames);
    let t = get(id);
    expect(t.frames).toHaveLength(2);
    expect(Object.keys(t.frames[0].positions)).toHaveLength(11);
    expect(t.frames[1].holder).toBe('u1');
    expect(t.frames[1].via.u1).toBeDefined();
    useStore.getState().setOpponent(id, true);
    useStore.getState().applyTemplate(id, corner.frames);
    t = get(id);
    expect(Object.keys(t.frames[0].positions)).toHaveLength(22);
    const cd = SET_PIECES.find(s => s.id === 'corner-defend')!;
    useStore.getState().applyTemplate(id, cd.frames);
    expect(get(id).frames[0].holder).toBe('o10');
    useStore.getState().setOpponent(id, false);
    useStore.getState().applyTemplate(id, cd.frames);
    expect(get(id).frames[0].holder).toBeNull();   // no opponent -> nobody to hold the ball
  });
});

describe('matches and kakao', () => {
  it('keeps the match link on a tactic but only as a short string', () => {
    expect(normalizeTactic({ us: {}, frames: [{}], matchId: 'abc' })!.matchId).toBe('abc');
    expect(normalizeTactic({ us: {}, frames: [{}], matchId: 5 })!.matchId).toBeUndefined();
  });
  it('closes voting at the deadline, or at kick-off when there is none', async () => {
    const { votingOpen, deadlineLabel } = await import('../matches');
    const h = 3600 * 1000;
    const base: Omit<Match, 'kickoff' | 'voteDeadline'> = { id: 'm', kind: 'match', title: 't', opponent: '', venue: '', notes: '', tacticId: null, status: 'scheduled', ourScore: null, oppScore: null, quarters: [], potmPlayerId: null };
    const at = (hours: number) => new Date(Date.now() + hours * h).toISOString();
    expect(votingOpen({ ...base, kickoff: at(5), voteDeadline: null })).toBe(true);
    expect(votingOpen({ ...base, kickoff: at(5), voteDeadline: at(-1) })).toBe(false);   // deadline passed although the match is later
    expect(votingOpen({ ...base, kickoff: at(-2), voteDeadline: null })).toBe(false);
    expect(votingOpen({ ...base, kickoff: at(5), voteDeadline: null, status: 'finished' })).toBe(false);
    expect(deadlineLabel({ ...base, kickoff: at(80), voteDeadline: null })).toBe('마감 D-3');
    expect(deadlineLabel({ ...base, kickoff: at(-1), voteDeadline: null })).toBe('마감');
  });
  it('builds Kakao card payloads with the link on both the card and the button', async () => {
    const { textCard, feedCard } = await import('../kakao');
    const t = textCard('⚽ 10월 정기전', 'https://x.test/#/m/1', '참석 투표하기') as { link: { webUrl: string }; buttons: { title: string; link: { mobileWebUrl: string } }[] };
    expect(t.link.webUrl).toBe('https://x.test/#/m/1');
    expect(t.buttons[0]).toMatchObject({ title: '참석 투표하기', link: { mobileWebUrl: 'https://x.test/#/m/1' } });
    const f = feedCard({ title: 'T'.repeat(300), description: 'd', imageUrl: 'https://img/1.png', width: 1080, height: 1888 }, 'https://x.test/#/p/1') as { content: { title: string; imageUrl: string } };
    expect(f.content.title).toHaveLength(200);
    expect(f.content.imageUrl).toBe('https://img/1.png');
  });
  it('maps player columns both ways', async () => {
    const p = normalizePlayer({ id: 'x', number: '9', name: '공격수', pos: 'FW', alt_pos: ['MF', 'FW', 'ZZ'], injured: true, injury_note: '햄스트링' })!;
    expect(p).toMatchObject({ altPos: ['MF'], out: true, note: '햄스트링' });   // own position and junk are dropped
    expect(normalizePlayer({ id: 'y', number: '1', name: 'a', pos: 'GK' })).not.toHaveProperty('out');
  });
});

describe('team-mode errors', () => {
  it('explains join codes, last admin and linked players in plain Korean', async () => {
    const { explain } = await import('../cloud');
    expect(explain({ code: '28P01', message: 'wrong code' }).message).toContain('코드가 맞지 않아요');
    expect(explain({ code: '23514', message: 'last admin' }).message).toContain('마지막 관리자');
    expect(explain({ code: '23505', message: 'player taken' }).message).toContain('이미 다른 계정');
    expect(explain({ code: '23505', message: 'duplicate key players_number_key' }).message).toContain('등번호');
    expect(explain({ code: '28000', message: 'sign in first' }).message).toContain('로그인');
  });
});

describe('invite links and sign-up checks', () => {
  it('parses join and setup links, upper-casing the code', async () => {
    const { parseRoute } = await import('../route');
    expect(parseRoute('#/join/ab12cd')).toEqual({ name: 'invite', code: 'AB12CD' });
    expect(parseRoute('#/setup/6d69f87288')).toEqual({ name: 'setup', code: '6D69F87288' });
    expect(parseRoute('#/setup')).toEqual({ name: 'setup', code: '' });
    expect(parseRoute('#/join')).toEqual({ name: 'home' });
  });

  it('builds a share link that round-trips through the router', async () => {
    const { inviteLink } = await import('../pending');
    const { parseRoute } = await import('../route');
    const link = inviteLink('CD90F6DC64', 'https://x.test', '/');
    expect(link).toBe('https://x.test/#/join/CD90F6DC64');
    expect(parseRoute(link.slice(link.indexOf('#')))).toEqual({ name: 'invite', code: 'CD90F6DC64' });
  });

  it('validates e-mail and password while typing', async () => {
    const { isEmail, checkPassword } = await import('../pending');
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail(' a@b ')).toBe(false);
    expect(isEmail('a b@c.com')).toBe(false);
    expect(checkPassword('abc12')).toMatchObject({ long: false, ok: false });
    expect(checkPassword('abcdefgh')).toMatchObject({ long: true, letter: true, digit: false, ok: false });
    expect(checkPassword('abcdefg1').ok).toBe(true);
    expect(checkPassword('12345678').letter).toBe(false);
  });
});

describe('quick pick from secret ratings', () => {
  const pl = (id: string, pos: 'GK' | 'DF' | 'MF' | 'FW', extra: Record<string, unknown> = {}) => ({ id, number: id, name: id, pos, ...extra });
  const rate = (o: Partial<Record<string, number>>) => ({ shooting: 5, passing: 5, dribbling: 5, defending: 5, pace: 5, stamina: 5, physical: 5, keeper: 5, ...o });

  it('puts the best keeper in goal and the best finisher up front', async () => {
    const { pickBest } = await import('../ratings');
    const players = [pl('gk1', 'GK'), pl('gk2', 'GK'), pl('d1', 'DF'), pl('f1', 'FW'), pl('f2', 'FW')] as never[];
    const ratings = { gk1: rate({ keeper: 4 }), gk2: rate({ keeper: 9 }), f1: rate({ shooting: 9 }), f2: rate({ shooting: 5 }), d1: rate({ defending: 8 }) };
    const r = pickBest(players, ratings, ['GK', 'LCB', 'ST']);
    expect(r.picks.map(x => x.playerId)).toEqual(['gk2', 'd1', 'f1']);
    expect(r.unrated).toEqual([]);
  });

  it('finds the best overall assignment, not a greedy one', async () => {
    const { pickBest } = await import('../ratings');
    // a is great at both slots, b is only fine at ST: a should take the slot where the gap to b is bigger
    const players = [pl('a', 'FW'), pl('b', 'FW')] as never[];
    const ratings = { a: rate({ shooting: 9, passing: 9, dribbling: 9, pace: 9, stamina: 9 }), b: rate({ shooting: 7, pace: 7, physical: 7, dribbling: 6 }) };
    const r = pickBest(players, ratings, ['ST', 'CM']);
    const total = r.picks.reduce((s, x) => s + x.score, 0);
    const swapped = pickBest(players, ratings, ['CM', 'ST']);
    expect(total).toBe(swapped.picks.reduce((s, x) => s + x.score, 0));
    expect(r.picks.map(x => x.playerId).sort()).toEqual(['a', 'b']);
  });

  it('skips injured players, honours the pool and manual exclusions, and leaves slots empty when short', async () => {
    const { pickBest } = await import('../ratings');
    const players = [pl('a', 'MF', { out: true }), pl('b', 'MF'), pl('c', 'MF')] as never[];
    const ratings = { a: rate({ passing: 10, stamina: 10 }) };
    expect(pickBest(players, ratings, ['CM']).picks[0].playerId).not.toBe('a');
    expect(pickBest(players, ratings, ['CM'], { pool: new Set(['c']) }).picks[0].playerId).toBe('c');
    expect(pickBest(players, ratings, ['CM', 'CM'], { exclude: new Set(['b']) }).picks.map(x => x.playerId).sort()).toEqual(['a', 'c']); // injured used only when needed
    const short = pickBest(players.slice(0, 1), {}, ['CM', 'ST']);
    expect(short.picks.filter(x => x.playerId)).toHaveLength(1);
    expect(short.picks.some(x => x.playerId === null)).toBe(true);
  });

  it('rates a secondary position slightly lower and a field player in goal very low', async () => {
    const { fit } = await import('../ratings');
    expect(fit(pl('x', 'DF') as never, 'LCB')).toBe(1);
    expect(fit(pl('x', 'DF', { altPos: ['MF'] }) as never, 'CM')).toBeLessThan(1);
    expect(fit(pl('x', 'MF') as never, 'GK')).toBeLessThan(0.5);
  });

  it('reports unrated picks so the coach knows they were counted as average', async () => {
    const { pickBest } = await import('../ratings');
    const r = pickBest([pl('a', 'FW'), pl('b', 'FW')] as never[], { a: rate({}) }, ['ST', 'LST']);
    expect(r.unrated).toEqual(['b']);
  });
});

describe('bulk player entry', () => {
  it('reads number, name and position in any order', async () => {
    const { parsePlayers } = await import('../bulkPlayers');
    const rows = parsePlayers('7 김철수 MF\n이영희 10 공격수\n#3, 박민수, DF\n1 최골키 GK');
    expect(rows.map(r => [r.number, r.name, r.pos])).toEqual([['7', '김철수', 'MF'], ['10', '이영희', 'FW'], ['3', '박민수', 'DF'], ['1', '최골키', 'GK']]);
    expect(rows.every(r => !r.error)).toBe(true);
  });
  it('defaults to MF and skips blank lines', async () => {
    const { parsePlayers } = await import('../bulkPlayers');
    const rows = parsePlayers('\n  9번 홍길동 \n\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ number: '9', name: '홍길동', pos: 'MF', line: 2 });
  });
  it('flags missing numbers, long names and duplicate numbers (also against the existing roster)', async () => {
    const { parsePlayers } = await import('../bulkPlayers');
    const rows = parsePlayers('김철수 MF\n7 아주아주긴이름입니다\n5 가나\n5 다라\n8 마바', [{ number: '8', name: '기존' }]);
    expect(rows.map(r => r.error)).toEqual(['등번호가 없어요', '이름은 8자 이내예요', undefined, '가나와(과) 번호가 겹쳐요', '기존 선수가 이미 쓰는 번호예요']);
  });
});
