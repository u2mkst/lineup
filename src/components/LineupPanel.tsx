import { formationGroups } from '../data/formations';
import { COLORS, useStore } from '../lib/store';
import { benchOf } from '../lib/scene';
import type { Player, Tactic } from '../types';

function Colors({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="팀 색상">
      {COLORS.map(c => (
        <button key={c} role="radio" aria-checked={c === value} aria-label={c}
          className={`swatch${c === value ? ' on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

function FormationPicker({ value, onChange }: { value: string; onChange: (f: string) => void }) {
  return (
    <div className="formations">
      {formationGroups.map(g => (
        <div key={g.label} className="fgroup">
          <span className="flabel">{g.label}</span>
          <div className="chips">
            {g.items.map(f => (
              <button key={f} className={`chip${f === value ? ' on' : ''}`} onClick={() => onChange(f)}>{f}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  tactic: Tactic;
  roster: Player[];
  onOpenRoster: () => void;
}

export function LineupPanel({ tactic, roster, onOpenRoster }: Props) {
  const s = useStore();
  const id = tactic.id;
  const bench = benchOf(tactic, roster);
  const filled = Object.values(tactic.us.assign).filter(Boolean).length;
  const confirmReset = () => tactic.frames.length <= 1 || confirm('전술 장면이 장면 1만 남고 모두 사라져요. 계속할까요?');

  return (
    <div className="panel-body">
      <section className="card">
        <div className="card-head">
          <h3>우리 팀</h3>
          <span className="muted small">{filled} / 11 배치</span>
        </div>
        <div className="row">
          <input className="text-in" value={tactic.us.name} maxLength={12} aria-label="우리 팀 이름"
            onChange={e => s.edit(id, t => { t.us.name = e.target.value; })} />
          <Colors value={tactic.us.color} onChange={c => s.edit(id, t => { t.us.color = c; })} />
        </div>
        <FormationPicker value={tactic.us.formation} onChange={f => confirmReset() && s.setFormation(id, 'us', f)} />
        <div className="row gap">
          <button className="btn sm" onClick={() => s.autoFill(id)}>포지션별 자동 채우기</button>
          <button className="btn sm ghost" onClick={() => s.clearAssign(id)}>선수 비우기</button>
          <button className="btn sm ghost" onClick={() => confirmReset() && s.resetLayout(id)}>위치 초기화</button>
        </div>
        <p className="hint">선수를 탭하면 배정, 끌면 위치를 옮겨요.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>상대 팀 <small>(선택)</small></h3>
          <label className="switch">
            <input type="checkbox" checked={!!tactic.opp} onChange={e => confirmReset() && s.setOpponent(id, e.target.checked)} />
            <i />
          </label>
        </div>
        {tactic.opp ? (
          <>
            <div className="row">
              <input className="text-in" value={tactic.opp.name} maxLength={12} aria-label="상대 팀 이름"
                onChange={e => s.edit(id, t => { if (t.opp) t.opp.name = e.target.value; })} />
              <Colors value={tactic.opp.color} onChange={c => s.edit(id, t => { if (t.opp) t.opp.color = c; })} />
            </div>
            <FormationPicker value={tactic.opp.formation} onChange={f => confirmReset() && s.setFormation(id, 'opp', f)} />
            <p className="hint">상대 선수를 탭하면 번호와 이름을 적을 수 있어요.</p>
          </>
        ) : (
          <p className="muted small">켜면 상대 라인업도 같이 짜고 전술 애니메이션에도 함께 움직여요.</p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>교체 명단 <small>({bench.length})</small></h3>
          <button className="btn sm ghost" onClick={onOpenRoster}>명단 편집</button>
        </div>
        <div className="bench">
          {bench.map(p => <span key={p.id} className="bench-chip"><b>{p.number}</b>{p.name}</span>)}
          {bench.length === 0 && <span className="muted small">모든 선수가 배치됐어요.</span>}
        </div>
      </section>
    </div>
  );
}
