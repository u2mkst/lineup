import type { ReactNode } from 'react';
import { useStore } from '../lib/store';
import type { Tactic } from '../types';
import { IconEraser, IconHand, IconLeft, IconPass, IconRight, IconRun, IconTrash, IconZone } from './Icons';
import type { Tool } from './Pitch';
import { Section } from './Section';

interface Props {
  tactic: Tactic;
  frameIndex: number;
  locked: boolean;
  showTrails: boolean;
  tool: Tool;
  onSelectFrame: (i: number) => void;
  onTrails: (v: boolean) => void;
  onTool: (t: Tool) => void;
}

const TOOLS: { id: Tool; label: string; icon: ReactNode; hint: string }[] = [
  { id: 'move', label: '이동', icon: <IconHand />, hint: '선수와 공을 끌어 옮겨요. 이동 경로 가운데 점을 끌면 곡선이 되고, 탭하면 다시 직선이에요.' },
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
        <label className="check"><input type="checkbox" checked={p.showTrails} onChange={e => p.onTrails(e.target.checked)} /> 이전 장면에서의 이동 경로 보기</label>
      </Section>

      <Section title={`장면 ${frameIndex + 1} 설명`} summary={frame.note ? '작성됨' : '비어 있음'} defaultOpen>
        <textarea className="text-in" rows={2} maxLength={60} aria-label={`장면 ${frameIndex + 1} 설명`} placeholder="예) 윙백이 올라가고 6번이 내려와 빌드업"
          value={frame.note} onChange={e => edit(tactic.id, t => { t.frames[frameIndex].note = e.target.value; }, `note-${frame.id}`)} />
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
