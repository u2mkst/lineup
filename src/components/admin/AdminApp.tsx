import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../lib/auth';
import type { AdminSection } from '../../lib/adminTodos';
import { cloudEnabled } from '../../lib/supabase';
import { IconCalendar, IconChart, IconKey, IconLogo, IconSettings, IconUser, IconUsers } from '../Icons';
import { JoinScreen, LoginScreen, Splash } from '../team/AuthScreens';
import { EventsSection, MembersSection, OverviewSection, PlayersSection, RatingsSection, SettingsSection } from './Sections';

const NAV: { id: AdminSection; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: '개요', icon: <IconChart /> },
  { id: 'members', label: '팀원·권한', icon: <IconUsers /> },
  { id: 'players', label: '선수 관리', icon: <IconUser /> },
  { id: 'ratings', label: '능력치 (비공개)', icon: <IconKey /> },
  { id: 'events', label: '일정·기록', icon: <IconCalendar /> },
  { id: 'settings', label: '구단 설정', icon: <IconSettings /> },
];

const sectionOf = (hash: string): AdminSection => {
  const id = hash.replace(/^#\/?/, '').split('/')[0];
  return (NAV.find(n => n.id === id)?.id ?? 'overview') as AdminSection;
};

function useSection(): AdminSection {
  const [s, setS] = useState(() => sectionOf(location.hash));
  useEffect(() => {
    const on = () => { setS(sectionOf(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return s;
}

/** True when the address is /admin (or /admin/…). The admin console is its own page, not a tab of the member app. */
export const isAdminPath = (pathname = location.pathname) => /^\/admin(\/|$)/.test(pathname);

function Notice({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

/** The admin console at /admin: its own layout, only for admins. */
export function AdminApp() {
  const ready = useAuth(s => s.ready);
  const user = useAuth(s => s.user);
  const member = useAuth(s => s.member);
  const isAdmin = useAuth(s => s.isAdmin);
  const teamName = useAuth(s => s.teamName);
  const signOut = useAuth(s => s.signOut);
  const section = useSection();

  useEffect(() => { document.title = `관리자 · ${teamName}`; }, [teamName]);

  if (!cloudEnabled) return <Notice title="서버에 연결돼 있지 않아요" sub="관리자 페이지는 Supabase 연결이 있어야 쓸 수 있어요."><a className="btn primary lg block" href="/">앱으로 가기</a></Notice>;
  if (!ready) return <Splash />;
  if (!user) return <LoginScreen />;
  if (!member) return <JoinScreen />;
  if (!isAdmin) {
    return (
      <Notice title="관리자만 들어올 수 있어요" sub="이 페이지는 구단 관리자 전용이에요. 권한이 필요하면 관리자에게 요청해 주세요.">
        <a className="btn primary lg block" href="/">앱으로 돌아가기</a>
        <button className="btn ghost block" onClick={() => void signOut()}>{user.email} 로그아웃</button>
      </Notice>
    );
  }

  const page = (() => {
    switch (section) {
      case 'members': return <MembersSection />;
      case 'players': return <PlayersSection />;
      case 'ratings': return <RatingsSection />;
      case 'events': return <EventsSection />;
      case 'settings': return <SettingsSection />;
      default: return <OverviewSection />;
    }
  })();

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand"><IconLogo width={26} height={34} /><b>{teamName}</b><em>관리자</em></div>
        <nav aria-label="관리자 메뉴">
          {NAV.map(n => (
            <a key={n.id} href={n.id === 'overview' ? '#/' : `#/${n.id}`} className={section === n.id ? 'on' : ''} aria-current={section === n.id ? 'page' : undefined}>{n.icon}<span>{n.label}</span></a>
          ))}
        </nav>
        <div className="adm-side-foot">
          <a href="/">← 앱으로 돌아가기</a>
          <button className="link" onClick={() => void signOut()}>로그아웃</button>
        </div>
      </aside>
      <main className="adm-main">{page}</main>
    </div>
  );
}
