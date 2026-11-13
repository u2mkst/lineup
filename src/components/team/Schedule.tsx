import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { KIND_COLOR, KIND_LABEL, dayKey, formatTime } from '../../lib/matches';
import { go, paths } from '../../lib/route';
import { useTeamData } from '../../lib/teamData';
import type { Match } from '../../types';
import { IconChevron, IconMapPin, IconPlus } from '../Icons';
import { Empty, Loading, PageHeader } from '../ui';
import { EventForm } from './EventForm';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function Calendar({ month, byDay, selected, onSelect }: { month: Date; byDay: Map<string, Match[]>; selected: string | null; onSelect: (k: string | null) => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const today = dayKey(new Date());
  return (
    <div className="cal" role="grid" aria-label="월간 달력">
      {DOW.map((d, i) => <span key={d} className={`cal-dow${i === 0 ? ' sun' : ''}`} role="columnheader">{d}</span>)}
      {cells.map((d, i) => {
        if (!d) return <span key={i} className="cal-cell empty" />;
        const k = dayKey(d);
        const evs = byDay.get(k) ?? [];
        return (
          <button key={k} role="gridcell" className={`cal-cell${k === today ? ' today' : ''}${k === selected ? ' sel' : ''}${d.getDay() === 0 ? ' sun' : ''}`}
            onClick={() => onSelect(k === selected ? null : k)} aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${evs.length ? `, 일정 ${evs.length}개` : ''}`} aria-pressed={k === selected}>
            <b>{d.getDate()}</b>
            <span className="dots">{evs.slice(0, 3).map(e => <i key={e.id} style={{ background: KIND_COLOR[e.kind] }} />)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EventRow({ m }: { m: Match }) {
  const d = new Date(m.kickoff);
  const done = m.status === 'finished' && m.ourScore != null;
  return (
    <a className="event-row" href={paths.event(m.id)}>
      <span className="event-date"><small>{DOW[d.getDay()]}</small><b>{d.getDate()}</b></span>
      <span className="event-info">
        <span className="event-top">
          <em className="kind" style={{ background: KIND_COLOR[m.kind] }}>{KIND_LABEL[m.kind]}</em>
          {m.status === 'cancelled' && <em className="kind off">취소</em>}
          <strong>{m.title}</strong>
        </span>
        <span className="muted small">{formatTime(m.kickoff)}{m.venue ? <> · <IconMapPin width={12} height={12} /> {m.venue}</> : null}</span>
      </span>
      {done && <span className={`score ${m.ourScore! > m.oppScore! ? 'win' : m.ourScore! < m.oppScore! ? 'lose' : 'draw'}`}>{m.ourScore}:{m.oppScore}</span>}
    </a>
  );
}

export function SchedulePage() {
  const isAdmin = useAuth(s => s.isAdmin);
  const { matches, loaded, error, load } = useTeamData();
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { void load(); }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) { const k = dayKey(new Date(m.kickoff)); map.set(k, [...(map.get(k) ?? []), m]); }
    return map;
  }, [matches]);
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const inMonth = matches.filter(m => dayKey(new Date(m.kickoff)).startsWith(prefix)).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const shown = selected ? inMonth.filter(m => dayKey(new Date(m.kickoff)) === selected) : inMonth;
  const shift = (d: number) => { setMonth(new Date(month.getFullYear(), month.getMonth() + d, 1)); setSelected(null); };

  return (
    <>
      <PageHeader title="일정" right={isAdmin && <button className="btn sm primary" onClick={() => setCreating(true)}><IconPlus width={15} height={15} /> 일정</button>} />
      <section className="card month-card">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="이전 달"><IconChevron style={{ transform: 'rotate(90deg)' }} /></button>
          <strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="다음 달"><IconChevron style={{ transform: 'rotate(-90deg)' }} /></button>
        </div>
        <Calendar month={month} byDay={byDay} selected={selected} onSelect={setSelected} />
        <div className="legend">{(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map(k => <span key={k}><i style={{ background: KIND_COLOR[k] }} />{KIND_LABEL[k]}</span>)}</div>
      </section>

      <h2 className="group-title">{selected ? `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일 일정` : `${month.getMonth() + 1}월 일정 ${inMonth.length}개`}
        {selected && <button className="link" onClick={() => setSelected(null)}>전체 보기</button>}</h2>
      {!loaded && !error && <Loading />}
      {error && !loaded && <Empty title="일정을 불러오지 못했어요" hint="인터넷 연결을 확인해 주세요." action={<button className="btn sm" onClick={() => void load()}>다시 시도</button>} />}
      {loaded && shown.length === 0 && <Empty title="일정이 없어요" hint={isAdmin ? '오른쪽 위 "일정"으로 등록해 보세요.' : undefined} />}
      <div className="list-stack">{shown.map(m => <EventRow key={m.id} m={m} />)}</div>

      {creating && <EventForm day={selected ?? undefined} onClose={() => setCreating(false)} onSaved={m => { setCreating(false); void load(); go(paths.event(m.id)); }} />}
    </>
  );
}
