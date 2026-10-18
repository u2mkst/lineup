import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { COLORS, useStore } from '../lib/store';
import { cloudEnabled } from '../lib/supabase';
import { benchOf } from '../lib/scene';
import type { Player, Tactic } from '../types';
import { FormationSheet } from './FormationSheet';
import { IconChevron } from './Icons';
import { Section } from './Section';

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

interface Props {
  tactic: Tactic;
  roster: Player[];
  onOpenRoster: () => void;
}

export function LineupPanel({ tactic, roster, onOpenRoster }: Props) {
  const isAdmin = useAuth(a => a.isAdmin);
  const s = useStore();
  const id = tactic.id;
  const bench = benchOf(tactic, roster);
  const filled = Object.values(tactic.us.assign).filter(Boolean).length;
  const [sheet, setSheet] = useState<'us' | 'opp' | null>(null);
  const confirmReset = () => tactic.frames.length <= 1 || confirm('전술 장면이 장면 1만 남고 모두 사라져요. 계속할까요?');

  return (
    <div className="panel-body">
      <Section title="우리 팀" summary={`${tactic.us.formation} · ${filled}/11`} defaultOpen>
        <div className="field-row">
          <input className="text-in" value={tactic.us.name} maxLength={12} aria-label="우리 팀 이름"
            onChange={e => s.edit(id, t => { t.us.name = e.target.value; }, 'us-name')} />
          <Colors value={tactic.us.color} onChange={c => s.edit(id, t => { t.us.color = c; })} />
        </div>
        <button className="select-btn" onClick={() => setSheet('us')}>
          <span><small>포메이션</small>{tactic.us.formation}</span><IconChevron width={18} height={18} />
        </button>
        <div className="btn-row">
          <button className="btn sm" onClick={() => s.autoFill(id)}>포지션별 자동 채우기</button>
          <button className="btn sm ghost" onClick={() => s.clearAssign(id)}>비우기</button>
          <button className="btn sm ghost" onClick={() => confirmReset() && s.resetLayout(id)}>위치 초기화</button>
        </div>
        <p className="hint">선수를 탭하면 배정, 끌면 위치를 옮겨요.</p>
      </Section>

      <Section
        title="상대 팀"
        summary={tactic.opp ? tactic.opp.formation : '선택'}
        defaultOpen={!!tactic.opp}
        right={
          <label className="switch" aria-label="상대 팀 사용">
            <input type="checkbox" checked={!!tactic.opp} onChange={e => confirmReset() && s.setOpponent(id, e.target.checked)} />
            <i />
          </label>
        }
      >
        {tactic.opp ? (
          <>
            <div className="field-row">
              <input className="text-in" value={tactic.opp.name} maxLength={12} aria-label="상대 팀 이름"
                onChange={e => s.edit(id, t => { if (t.opp) t.opp.name = e.target.value; }, 'opp-name')} />
              <Colors value={tactic.opp.color} onChange={c => s.edit(id, t => { if (t.opp) t.opp.color = c; })} />
            </div>
            <button className="select-btn" onClick={() => setSheet('opp')}>
              <span><small>포메이션</small>{tactic.opp.formation}</span><IconChevron width={18} height={18} />
            </button>
            <p className="hint">상대 선수를 탭하면 번호와 이름을 적을 수 있어요.</p>
          </>
        ) : (
          <p className="muted small">스위치를 켜면 상대 라인업도 같이 짜고, 전술 애니메이션에도 함께 움직여요.</p>
        )}
      </Section>

      <Section title="교체 명단" summary={`${bench.length}명`}>
        <div className="bench">
          {bench.map(p => <span key={p.id} className="bench-chip"><b>{p.number}</b>{p.name}</span>)}
          {bench.length === 0 && <span className="muted small">모든 선수가 배치됐어요.</span>}
        </div>
        <div className="btn-row">
          <button className="btn sm ghost" onClick={onOpenRoster}>{isAdmin || !cloudEnabled ? '선수 명단 관리' : '선수 명단 보기'}</button>
        </div>
      </Section>

      {sheet && (
        <FormationSheet
          title={sheet === 'us' ? '우리 팀 포메이션' : '상대 팀 포메이션'}
          value={sheet === 'us' ? tactic.us.formation : tactic.opp?.formation ?? ''}
          color={sheet === 'us' ? tactic.us.color : tactic.opp?.color ?? '#ef4444'}
          onClose={() => setSheet(null)}
          onPick={f => { if (f !== (sheet === 'us' ? tactic.us.formation : tactic.opp?.formation) && !confirmReset()) return; s.setFormation(id, sheet, f); setSheet(null); }}
        />
      )}
    </div>
  );
}
