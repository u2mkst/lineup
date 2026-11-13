import type { ReactNode } from 'react';
import { IconBack } from './Icons';

/** Sticky page title with an optional back button and right-hand actions. */
export function PageHeader({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="page-head">
      {back && <a className="icon-btn" href={back} aria-label="뒤로"><IconBack /></a>}
      <h1>{title}</h1>
      <div className="page-head-right">{right}</div>
    </header>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-msg">
      <p>{title}</p>
      {hint && <p className="muted small">{hint}</p>}
      {action}
    </div>
  );
}

export function Loading({ text = '불러오는 중…' }: { text?: string }) {
  return <p className="muted small empty-msg" role="status">{text}</p>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label} 줄이기`}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} 늘리기`}>＋</button>
    </span>
  );
}
