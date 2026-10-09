import { frameStart, totalDuration } from '../lib/anim';
import { useStore } from '../lib/store';
import type { Tactic } from '../types';

interface Props {
  tactic: Tactic;
  frameIndex: number;
  playing: boolean;
  time: number | null;
  speed: number;
  showTrails: boolean;
  onSelectFrame: (i: number) => void;
  onTogglePlay: () => void;
  onScrub: (ms: number) => void;
  onSpeed: (s: number) => void;
  onTrails: (v: boolean) => void;
}

const SPEEDS = [0.5, 1, 2];

export function FrameBar({ tactic, frameIndex, time, onSelectFrame }: Pick<Props, 'tactic' | 'frameIndex' | 'time' | 'onSelectFrame'>) {
  const addFrame = useStore(s => s.addFrame);
  return (
    <div className="frames" role="tablist">
      {tactic.frames.map((f, i) => (
        <button key={f.id} role="tab" aria-selected={i === frameIndex && time == null}
          className={`frame-chip${i === frameIndex ? ' on' : ''}`} onClick={() => onSelectFrame(i)}>
          {i + 1}
        </button>
      ))}
      <button className="frame-chip add" onClick={() => onSelectFrame(addFrame(tactic.id, frameIndex))} aria-label="장면 추가">＋</button>
    </div>
  );
}


export function TacticPanel(p: Props) {
  const s = useStore();
  const { tactic, frameIndex } = p;
  const n = tactic.frames.length;
  const frame = tactic.frames[frameIndex];
  const total = totalDuration(n);

  const add = () => p.onSelectFrame(s.addFrame(tactic.id, frameIndex));
  const del = () => {
    if (n <= 1 || !confirm(`장면 ${frameIndex + 1}을 삭제할까요?`)) return;
    s.deleteFrame(tactic.id, frameIndex);
    p.onSelectFrame(Math.max(0, frameIndex - 1));
  };

  return (
    <div className="panel-body">
      <section className="card">
        <div className="card-head">
          <h3>장면 {frameIndex + 1} <small>/ {n}</small></h3>
        </div>
        <p className="hint">
          {frameIndex === 0
            ? '장면 1은 라인업이에요. ＋로 장면을 늘리고, 선수와 공을 끌어 다음 움직임을 만들어요.'
            : '선수와 공을 끌어 이 장면의 위치를 정하세요. 점선 화살표는 이전 장면에서의 이동이에요.'}
        </p>
        <label className="field">
          <span>장면 {frameIndex + 1} 설명</span>
          <textarea rows={2} maxLength={60} placeholder="예) 윙백이 올라가고 6번이 내려와 빌드업"
            value={frame.note} onChange={e => s.edit(tactic.id, t => { t.frames[frameIndex].note = e.target.value; })} />
        </label>
        <div className="row gap">
          <button className="btn sm" onClick={add}>이 장면 복제해서 추가</button>
          <button className="btn sm ghost danger" onClick={del} disabled={n <= 1}>장면 삭제</button>
          <label className="check"><input type="checkbox" checked={p.showTrails} onChange={e => p.onTrails(e.target.checked)} /> 이동 화살표</label>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h3>재생</h3></div>
        <div className="player">
          <button className="btn primary play" disabled={n < 2} onClick={p.onTogglePlay}>{p.playing ? '⏸ 일시정지' : '▶ 재생'}</button>
          <div className="chips">
            {SPEEDS.map(v => (
              <button key={v} className={`chip${p.speed === v ? ' on' : ''}`} onClick={() => p.onSpeed(v)}>{v}×</button>
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
