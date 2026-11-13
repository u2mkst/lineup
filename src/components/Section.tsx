import { useState, type ReactNode } from 'react';
import { IconChevron } from './Icons';

interface Props {
  title: string;
  /** short value shown next to the title while collapsed */
  summary?: ReactNode;
  /** control rendered at the far right, e.g. a switch */
  right?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Collapsible block used to keep long panels short. */
export function Section({ title, summary, right, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`section${open ? ' open' : ''}`}>
      <div className="section-head">
        <button className="section-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <span className="section-title">{title}</span>
          {summary != null && <span className="section-summary">{summary}</span>}
          <IconChevron className="chev" width={18} height={18} />
        </button>
        {right}
      </div>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}
