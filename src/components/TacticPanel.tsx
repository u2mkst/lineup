import type { ReactNode } from 'react';
import { frameStart, totalDuration } from '../lib/anim';
import { useStore } from '../lib/store';
import type { Tactic } from '../types';
import { IconEraser, IconHand, IconLeft, IconPass, IconPause, IconPlay, IconPlus, IconRight, IconRun, IconTrash, IconZone } from './Icons';
import type { Tool } from './Pitch';

interface Props {
  tactic: Tactic;
  frameIndex: number;
  playing: boolean;
  time: number | null;
  speed: number;
  showTrails: boolean;
  tool: Tool;
  onSelectFrame: (i: number) => void;
  onTogglePlay: () => void;
  onScrub: (ms: number) => void;
  onSpeed: (s: number) => void;
  onTrails: (v: boolean) => void;
  onTool: (t: Tool) => void;
}

const SPEEDS = [0.5, 1, 2];
const TOOLS: { id: Tool; label: string; icon: ReactNode; hint: string }[] = [
  { id: 'move', label: '이동', icon: <IconHand />, hint: '선수와 공을 끌어서 옮겨요' },
  { id: 'run', label: '달리기', icon: <IconRun />, hint: '끌어서 선수의 침투·이동 방향을 점선 화살표로 그려요' },
  { id: 'pass', label: '패스', icon: <IconPass />, hint: '끌어서 패스 방향을 노란 화살표로 그려요' },
  { id: 'zone', label: '구역', icon: <IconZone />, hint: '중심에서 끌어서 압박·공략할 구역을 표시해요' },
  { id: 'erase', label: '지우개', icon: <IconEraser />, hint: '지울 화살표나 구역을 탭하세요' },
];

export function FrameBar({ tactic, frameIndex, time, onSelectFrame }: Pick<Props, 'tactic' | 'frameIndex' | 'time' | 'onSelectFrame'>) {
  const addFrame = useStore(s => s.addFrame);
  return (
    <div className="frames" role="tablist" aria-label="장면">
      {tactic.frames.map((f, i) => (
        <button key={f.id} role="tab" aria-selected={i === frameIndex && time == null} aria-label={`장면 ${i + 1}`}
          className={`frame-chip${i === frameIndex ? ' on' : ''}`} onClick={() => onSelectFrame(i)}>
          {i + 1}
        </button>
      ))}
      <button className="frame-chip add" onClick={() => onSelectFrame(addFrame(tactic.id, frameIndex))} aria-label="장면 추가"><IconPlus width={16} height={16} /></button>
    </div>
  );
}

export function TacticPanel(p: Props) {
  const edit = useStore(s => s.edit);
  const addFrame = useStore(s => s.addFrame);
  const deleteFrame = useStore(s => s.deleteFrame);
  const moveFrame = useStore(s => s.moveFrame);
  const clearDrawings = useStore(s => s.clearDrawings);
  const { tactic, frameIndex } = p;
  const n = tactic.frames.length;
  const frame = tactic.frames[frameIndex];
  const total = totalDuration(n);
  const tool = TOOLS.find(t => t.id === p.tool)!;
  const locked = p.playing || p.time != null;

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
      <section className="card">
        <div className="card-head">
          <h3>장면 {frameIndex + 1} <small>/ {n}</small></h3>
          <div className="row tight">
            <button className="icon-btn sm" onClick={() => shift(-1)} disabled={frameIndex === 0} aria-label="장면을 앞으로"><IconLeft /></button>
            <button className="icon-btn sm" onClick={() => shift(1)} disabled={frameIndex >= n - 1} aria-label="장면을 뒤로"><IconRight /></button>
          </div>
        </div>

        <div className="tools" role="radiogroup" aria-label="편집 도구">
          {TOOLS.map(t => (
            <button key={t.id} role="radio" aria-checked={p.tool === t.id} className={`tool${p.tool === t.id ? ' on' : ''}`}
              onClick={() => p.onTool(t.id)} disabled={locked}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </div>
        <p className="hint">
          {locked ? '재생을 멈추면 편집할 수 있어요.'
            : frameIndex === 0 && p.tool === 'move' ? '장면 1은 라인업이에요. ＋로 장면을 늘리고, 선수와 공을 끌어 다음 움직임을 만들어요.'
            : tool.hint}
        </p>

        <label className="field">
          <span>장면 {frameIndex + 1} 설명</span>
          <textarea rows={2} maxLength={60} placeholder="예) 윙백이 올라가고 6번이 내려와 빌드업"
            value={frame.note} onChange={e => edit(tactic.id, t => { t.frames[frameIndex].note = e.target.value; }, `note-${frame.id}`)} />
        </label>
        <div className="row gap">
          <button className="btn sm" onClick={() => p.onSelectFrame(addFrame(tactic.id, frameIndex))}>이 장면 복제해서 추가</button>
          <button className="btn sm ghost" onClick={() => clearDrawings(tactic.id, frameIndex)} disabled={frame.drawings.length === 0}>그림 지우기</button>
          <button className="btn sm ghost danger" onClick={del} disabled={n <= 1}><IconTrash width={15} height={15} /> 장면 삭제</button>
          <label className="check"><input type="checkbox" checked={p.showTrails} onChange={e => p.onTrails(e.target.checked)} /> 이동 화살표</label>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h3>재생</h3></div>
        <div className="player">
          <button className="btn primary play" disabled={n < 2} onClick={p.onTogglePlay}>
            {p.playing ? <><IconPause width={16} height={16} /> 일시정지</> : <><IconPlay width={16} height={16} /> 재생</>}
          </button>
          <div className="chips" role="radiogroup" aria-label="재생 속도">
            {SPEEDS.map(v => (
              <button key={v} role="radio" aria-checked={p.speed === v} className={`chip${p.speed === v ? ' on' : ''}`} onClick={() => p.onSpeed(v)}>{v}×</button>
            ))}
          </div>
        </div>
        <input type="range" className="scrub" min={0} max={Math.max(1, total)} step={10} disabled={n < 2}
          value={p.time ?? frameStart(frameIndex)} onChange={e => p.onScrub(Number(e.target.value))} aria-label="재생 위치" />
        {n < 2 && <p className="hint">장면을 2개 이상 만들면 재생할 수 있어요.</p>}
      </section>
    </div>
  );
}
