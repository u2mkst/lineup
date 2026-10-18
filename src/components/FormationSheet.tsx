import { formationGroups } from '../data/formations';
import { layoutFormation } from '../lib/layout';
import { Sheet } from './Sheet';

function Mini({ formation, color }: { formation: string; color: string }) {
  const pts = layoutFormation(formation, 'us', false);
  return (
    <svg viewBox="0 0 60 80" className="mini-formation" aria-hidden>
      <rect x="1" y="1" width="58" height="78" rx="4" fill="none" stroke="currentColor" strokeOpacity=".35" />
      <line x1="1" y1="40" x2="59" y2="40" stroke="currentColor" strokeOpacity=".25" />
      {pts.map((p, i) => <circle key={i} cx={p.x * 60} cy={p.y * 80} r="3.4" fill={color} />)}
    </svg>
  );
}

interface Props {
  title: string;
  value: string;
  color: string;
  onPick: (formation: string) => void;
  onClose: () => void;
}

export function FormationSheet({ title, value, color, onPick, onClose }: Props) {
  return (
    <Sheet title={title} onClose={onClose}>
      {formationGroups.map(g => (
        <div key={g.label} className="formation-group">
          <h4>{g.label}</h4>
          <div className="formation-grid">
            {g.items.map(f => (
              <button key={f} className={`formation-card${f === value ? ' on' : ''}`} onClick={() => onPick(f)} aria-pressed={f === value}>
                <Mini formation={f} color={color} />
                <span>{f}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
