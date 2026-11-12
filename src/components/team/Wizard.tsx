import type { ReactNode } from 'react';
import { IconBack, IconLogo } from '../Icons';

interface Props {
  /** 1-based position; omit to hide the progress bar */
  step?: number;
  total?: number;
  title: string;
  sub?: string;
  onBack?: () => void;
  /** the main button (and anything below it) pinned to the bottom */
  footer?: ReactNode;
  children?: ReactNode;
  onSubmit?: () => void;
}

/**
 * One question per screen: progress bar on top, a big question, the answer, and one big button pinned to the bottom.
 * Wrapped in a <form> so Enter on the keyboard moves on.
 */
export function Wizard({ step, total, title, sub, onBack, footer, children, onSubmit }: Props) {
  return (
    <form className="wizard" onSubmit={e => { e.preventDefault(); onSubmit?.(); }}>
      <div className="wiz-top">
        {onBack ? <button type="button" className="icon-btn" onClick={onBack} aria-label="이전"><IconBack /></button> : <span className="wiz-brand"><IconLogo width={26} height={26} /></span>}
        {step && total ? (
          <div className="wiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`${total}단계 중 ${step}단계`}>
            <span style={{ width: `${Math.min(100, (step / total) * 100)}%` }} />
          </div>
        ) : <span />}
      </div>
      <div className="wiz-body">
        <h1>{title}</h1>
        {sub && <p className="wiz-sub">{sub}</p>}
        <div className="wiz-answer">{children}</div>
      </div>
      {footer && <div className="wiz-foot">{footer}</div>}
    </form>
  );
}

/** The pinned primary button. */
export function NextButton({ children = '다음', disabled, busy }: { children?: ReactNode; disabled?: boolean; busy?: boolean }) {
  return <button className="btn primary lg block" type="submit" disabled={disabled || busy}>{busy ? '잠시만요…' : children}</button>;
}
