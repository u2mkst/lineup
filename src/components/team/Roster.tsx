import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { averageAge, playerLines, seasonOf } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { useTeamData } from '../../lib/teamData';
import type { Player, Pos } from '../../types';
import { AdminRoster } from '../AdminRoster';
import { Sheet } from '../Sheet';
import { Loading, PageHeader } from '../ui';
import { useEffect } from 'react';

const GROUPS: { pos: Pos; label: string; en: string }[] = [
  { pos: 'FW', label: '공격수', en: 'Forward' }, { pos: 'MF', label: '미드필더', en: 'Midfielder' },
  { pos: 'DF', label: '수비수', en: 'Defender' }, { pos: 'GK', label: '골키퍼', en: 'Goalkeeper' },
];

export function RosterPage() {
  const roster = useStore(s => s.roster);
  const isAdmin = useAuth(s => s.isAdmin);
  const { matches, stats, loaded, load } = useTeamData();
  const [open, setOpen] = useState<Player | null>(null);
  const [managing, setManaging] = useState(false);
  useEffect(() => { void load(); }, [load]);

  const age = averageAge(roster);
  const year = new Date().getFullYear();
  const lines = useMemo(() => playerLines(matches.filter(m => seasonOf(m.kickoff) === year), stats, roster), [matches, stats, roster, year]);
  const line = (id: string) => lines.find(l => l.playerId === id);

  return (
    <>
      <PageHeader title="선수단" back="#/more" right={isAdmin && <button className="btn sm primary" onClick={() => setManaging(true)}>선수단 관리</button>} />
      <section className="card">
        <div className="card-title"><h3>선수단 구성</h3><span className="muted small">총 {roster.length}명</span></div>
        <div className="roster-tiles">
          {GROUPS.map(g => <div key={g.pos}><small>{g.label}</small><b>{roster.filter(p => p.pos === g.pos).length}<span>명</span></b></div>)}
          <div><small>평균 연령</small><b>{age ?? '-'}{age != null && <span>세</span>}</b></div>
        </div>
      </section>

      {GROUPS.map(g => {
        const list = roster.filter(p => p.pos === g.pos);
        if (!list.length) return null;
        return (
          <section key={g.pos} className="card">
            <div className="card-title"><h3>{g.label}</h3><span className="muted small">{g.en} · {list.length}</span></div>
            <div className="player-list">
              {list.map(p => (
                <button key={p.id} className={`player-item${p.out ? ' out' : ''}`} onClick={() => setOpen(p)}>
                  <b>{p.number}</b>
                  <span><strong>{p.name}</strong>{p.altPos?.length ? <small className="muted"> +{p.altPos.join('/')}</small> : null}</span>
                  {p.out && <em className="flag danger">부상{p.note ? ` · ${p.note}` : ''}</em>}
                  {p.birthYear && <small className="muted">{year - p.birthYear}세</small>}
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {roster.length === 0 && <Loading text="선수가 없어요." />}

      {open && (
        <Sheet title={`${open.number} ${open.name}`} onClose={() => setOpen(null)}>
          <p className="muted">{GROUPS.find(g => g.pos === open.pos)?.label}{open.altPos?.length ? ` · 겸임 ${open.altPos.join('/')}` : ''}{open.birthYear ? ` · ${year - open.birthYear}세` : ''}</p>
          {open.out && <p className="warn">부상 / 출전 불가{open.note ? ` · ${open.note}` : ''}</p>}
          {loaded && (
            <div className="stat-grid">
              <div className="stat-card"><small>{year} 출전</small><b>{line(open.id)?.games ?? 0}<span>경기</span></b></div>
              <div className="stat-card"><small>골</small><b>{line(open.id)?.goals ?? 0}<span>골</span></b></div>
              <div className="stat-card"><small>도움</small><b>{line(open.id)?.assists ?? 0}<span>도움</span></b></div>
              <div className="stat-card"><small>POTM</small><b>{line(open.id)?.potm ?? 0}<span>회</span></b></div>
            </div>
          )}
        </Sheet>
      )}
      {managing && <AdminRoster onClose={() => setManaging(false)} />}
    </>
  );
}
