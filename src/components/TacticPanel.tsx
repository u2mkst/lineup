import type { ReactNode } from 'react';
import { SET_PIECES } from '../data/setpieces';
import { lineTokenIds } from '../lib/layout';
import { useStore } from '../lib/store';
import type { Tactic } from '../types';
import { IconEraser, IconHand, IconLeft, IconPass, IconRight, IconRun, IconSelect, IconTrash, IconZone } from './Icons';
import type { Tool } from './Pitch';
import { Section } from './Section';

export interface MovedItem {
  id: string;
  label: string;
}

export interface SubItem {
  token: string;
  label: string;
}

interface Props {
  tactic: Tactic;
  frameIndex: number;
  locked: boolean;
  showTrails: boolean;
  tool: Tool;
  selectedIds: string[];
  /** players (and the ball) that move into this frame */
  moved: MovedItem[];
  /** substitutions made at this frame */
  subs: SubItem[];
  onSelectFrame: (i: number) => void;
  onTrails: (v: boolean) => void;
  onTool: (t: Tool) => void;
  onSelectIds: (ids: string[]) => void;
}

const TOOLS: { id: Tool; label: string; icon: ReactNode; hint: string }[] = [
  { id: 'move', label: '이동', icon: <IconHand />, hint: '선수와 공을 끌어 옮겨요. 이동 경로 가운데 점을 끌면 곡선, 탭하면 직선이에요. 공을 선수 가까이 놓으면 그 선수가 공을 가져요. 선수를 탭하면 교체할 수 있어요.' },
  { id: 'select', label: '선택', icon: <IconSelect />, hint: '선수를 탭해 여러 명을 고르거나 빈 곳을 끌어 영역으로 고르세요. 고른 선수 중 하나를 끌면 모두 같이 움직여요.' },
  { id: 'run', label: '달리기', icon: <IconRun />, hint: '끌어서 침투·이동 방향을 점선 화살표로 그려요.' },
  { id: 'pass', label: '패스', icon: <IconPass />, hint: '끌어서 패스 방향을 노란 화살표로 그려요.' },
  { id: 'zone', label: '구역', icon: <IconZone />, hint: '중심에서 끌어서 압박·공략할 구역을 표시해요.' },
  { id: 'erase', label: '지우개', icon: <IconEraser />, hint: '지울 화살표나 구역을 탭하세요.' },
];

export function TacticPanel(p: Props) {
  const edit = useStore(s => s.edit);
  const addFrame = useStore(s => s.addFrame);
  const deleteFrame = useStore(s => s.deleteFrame);
  const moveFrame = useStore(s => s.moveFrame);
  const clearDrawings = useStore(s => s.clearDrawings);
  const setTiming = useStore(s => s.setTiming);
  const clearSub = useStore(s => s.clearSub);
  const applyTemplate = useStore(s => s.applyTemplate);
  const { tactic, frameIndex } = p;
  const n = tactic.frames.length;
  const frame = tactic.frames[frameIndex];
  const tool = TOOLS.find(t => t.id === p.tool)!;

  const del = () => {
    if (n <= 1 || !confirm(`장면 ${frameIndex + 1}을 삭제할까요?`)) return;
    deleteFrame(tactic.id, frameIndex);
    p.onSelectFrame(Math.max(0, frameIndex - 1));
  };
  const shift = (d: -1 | 1) => {
    moveFrame(tactic.id, frameIndex, frameIndex + d);
    p.onSelectFrame(frameIndex + d);
  };

  const us = lineTokenIds(tactic.us.formation, 'us');
  const opp = tactic.opp ? lineTokenIds(tactic.opp.formation, 'opp') : null;
  const mids = us.lines.slice(1, -1).flat();
  const quick: { label: string; ids: string[] }[] = [
    { label: '우리 전체', ids: [us.gk, ...us.lines.flat()] },
    { label: '수비 라인', ids: us.lines[0] ?? [] },
    { label: '미드필더', ids: mids.length ? mids : [] },
    { label: '공격 라인', ids: us.lines.length > 1 ? us.lines[us.lines.length - 1] : [] },
    ...(opp ? [{ label: '상대 전체', ids: [opp.gk, ...opp.lines.flat()] }] : []),
  ].filter(q => q.ids.length > 0);

  const template = (id: string) => {
    const sp = SET_PIECES.find(x => x.id === id)!;
    const dirty = n > 1 || frame.drawings.length > 0 || Object.keys(frame.via).length > 0;
    if (dirty && !confirm(`"${sp.title}" 템플릿으로 모든 장면이 바뀌어요. 계속할까요?`)) return;
    applyTemplate(tactic.id, sp.frames);
    p.onSelectFrame(0);
    p.onTool('move');
  };

  return (
    <div className="panel-body">
      <Section title="도구" summary={tool.label} defaultOpen>
        <div className="tools" role="radiogroup" aria-label="편집 도구">
          {TOOLS.map(t => (
            <button key={t.id} role="radio" aria-checked={p.tool === t.id} className={`tool${p.tool === t.id ? ' on' : ''}`}
              onClick={() => p.onTool(t.id)} disabled={p.locked}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </div>
        <p className="hint">
          {p.locked ? '재생을 멈추면 편집할 수 있어요.'
            : frameIndex === 0 && p.tool === 'move' ? '장면 1은 라인업이에요. 아래 ＋로 장면을 늘리고 선수와 공을 끌어 다음 움직임을 만들어요.'
            : tool.hint}
        </p>
        {p.tool === 'select' && !p.locked && (
          <div className="quick-select">
            <div className="chips">
              {quick.map(q => <button key={q.label} className="chip" onClick={() => p.onSelectIds(q.ids)}>{q.label}</button>)}
              <button className="chip" onClick={() => p.onSelectIds([])} disabled={p.selectedIds.length === 0}>해제</button>
            </div>
            <span className="muted small">{p.selectedIds.length}명 선택</span>
          </div>
        )}
        <label className="check"><input type="checkbox" checked={p.showTrails} onChange={e => p.onTrails(e.target.checked)} /> 이전 장면에서의 이동 경로 보기</label>
      </Section>

      <Section title={`장면 ${frameIndex + 1} 설명`} summary={frame.note ? '작성됨' : '비어 있음'} defaultOpen>
        <textarea className="text-in" rows={2} maxLength={60} aria-label={`장면 ${frameIndex + 1} 설명`} placeholder="예) 윙백이 올라가고 6번이 내려와 빌드업"
          value={frame.note} onChange={e => edit(tactic.id, t => { t.frames[frameIndex].note = e.target.value; }, `note-${frame.id}`)} />
      </Section>

      {frameIndex > 0 && (
        <Section title="이동 타이밍" summary={p.moved.length ? `${p.moved.length}명` : '움직임 없음'}>
          {p.moved.length === 0 ? <p className="muted small">이 장면에서 움직인 선수가 없어요. 선수를 끌어 옮기면 출발·도착 시점을 정할 수 있어요.</p> : (
            <>
              <p className="hint">0%는 장면이 시작되는 순간, 100%는 끝나는 순간이에요. 출발을 늦추거나 도착을 앞당기면 그 선수만 더 빠르게 움직여요.</p>
              <div className="timing-list">
                {p.moved.map(m => {
                  const [st, en] = frame.timing[m.id] ?? [0, 1];
                  const set = (a: number, b: number) => setTiming(tactic.id, frameIndex, m.id, [a, b]);
                  return (
                    <div className="timing-row" key={m.id}>
                      <strong>{m.label}</strong>
                      <label><span>출발 {Math.round(st * 100)}%</span>
                        <input type="range" min={0} max={80} step={5} value={Math.round(st * 100)} disabled={p.locked}
                          onChange={e => { const v = Number(e.target.value) / 100; set(v, Math.max(en, v + 0.1)); }} /></label>
                      <label><span>도착 {Math.round(en * 100)}%</span>
                        <input type="range" min={20} max={100} step={5} value={Math.round(en * 100)} disabled={p.locked}
                          onChange={e => { const v = Number(e.target.value) / 100; set(Math.min(st, v - 0.1), v); }} /></label>
                    </div>
                  );
                })}
              </div>
              <button className="btn sm ghost" disabled={Object.keys(frame.timing).length === 0}
                onClick={() => Object.keys(frame.timing).forEach(k => setTiming(tactic.id, frameIndex, k, null))}>모두 같은 타이밍으로</button>
            </>
          )}
        </Section>
      )}

      {frameIndex > 0 && (
        <Section title="선수 교체" summary={p.subs.length ? `${p.subs.length}건` : '없음'}>
          {p.subs.length === 0
            ? <p className="muted small">이동 도구로 우리 팀 선수를 탭하면 이 장면부터 다른 선수로 교체할 수 있어요.</p>
            : <ul className="sub-list">{p.subs.map(s => (
                <li key={s.token}><span>{s.label}</span><button className="btn sm ghost" onClick={() => clearSub(tactic.id, frameIndex, s.token)}>취소</button></li>
              ))}</ul>}
        </Section>
      )}

      <Section title="세트피스 템플릿" summary={`${SET_PIECES.length}개`}>
        <p className="hint">자주 쓰는 장면을 불러와 시작하세요. 선수 번호 순서(수비 → 미드 → 공격)에 맞춰 배치돼요.</p>
        <div className="template-grid">
          {SET_PIECES.map(sp => (
            <button key={sp.id} className="template-card" onClick={() => template(sp.id)} disabled={p.locked}>
              <strong>{sp.title}</strong><span>{sp.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="장면 관리" summary={`${n}개`}>
        <div className="btn-row">
          <button className="btn sm" onClick={() => p.onSelectFrame(addFrame(tactic.id, frameIndex))}>이 장면 복제해 추가</button>
          <button className="btn sm ghost" onClick={() => shift(-1)} disabled={frameIndex === 0}><IconLeft width={15} height={15} /> 앞으로</button>
          <button className="btn sm ghost" onClick={() => shift(1)} disabled={frameIndex >= n - 1}>뒤로 <IconRight width={15} height={15} /></button>
          <button className="btn sm ghost" onClick={() => clearDrawings(tactic.id, frameIndex)} disabled={frame.drawings.length === 0}>그림 지우기</button>
          <button className="btn sm ghost danger" onClick={del} disabled={n <= 1}><IconTrash width={15} height={15} /> 장면 삭제</button>
        </div>
      </Section>
    </div>
  );
}
