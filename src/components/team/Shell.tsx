import type { ReactNode } from 'react';
import { paths } from '../../lib/route';
import { IconBoardTactic, IconCalendar, IconChart, IconHome, IconMenu } from '../Icons';

export type TabId = 'home' | 'schedule' | 'records' | 'tactics' | 'more';

const TABS: { id: TabId; label: string; href: string; icon: ReactNode }[] = [
  { id: 'home', label: '홈', href: paths.home, icon: <IconHome /> },
  { id: 'schedule', label: '일정', href: paths.schedule, icon: <IconCalendar /> },
  { id: 'records', label: '기록', href: paths.records, icon: <IconChart /> },
  { id: 'tactics', label: '전술', href: paths.tactics, icon: <IconBoardTactic /> },
  { id: 'more', label: '더보기', href: paths.more, icon: <IconMenu /> },
];

/** Page frame with the bottom tab bar (a side rail on wide screens). */
export function Shell({ active, children }: { active: TabId; children: ReactNode }) {
  return (
    <div className="shell">
      <main className="shell-main">{children}</main>
      <nav className="tabbar" aria-label="주요 메뉴">
        {TABS.map(t => (
          <a key={t.id} href={t.href} className={`tab${active === t.id ? ' on' : ''}`} aria-current={active === t.id ? 'page' : undefined}>
            {t.icon}<span>{t.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
