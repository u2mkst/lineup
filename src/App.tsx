import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { Home } from './components/Home';
import { PublicView } from './components/PublicView';
import { SharedImport } from './components/SharedImport';
import { AdminPage } from './components/team/Admin';
import { JoinScreen, LinkPlayerScreen, LoginScreen, Splash } from './components/team/AuthScreens';
import { AdminSetup, InstallGuide } from './components/team/Onboarding';
import { BoardPage, PostPage } from './components/team/Board';
import { EventPage } from './components/team/EventPage';
import { HomeDashboard } from './components/team/HomeDashboard';
import { MePage } from './components/team/Me';
import { MorePage } from './components/team/More';
import { RecordsPage } from './components/team/Records';
import { RosterPage } from './components/team/Roster';
import { SchedulePage } from './components/team/Schedule';
import { Shell, type TabId } from './components/team/Shell';
import { TacticsPage } from './components/team/Tactics';
import { useAuth } from './lib/auth';
import { clearPending, readPending, savePending } from './lib/pending';
import { shouldSuggestInstall } from './lib/pwa';
import { go, paths, useRoute, type Route } from './lib/route';
import { cloudEnabled } from './lib/supabase';

/** Without a server the app is a private, on-this-device tactics board. */
function LocalApp({ route }: { route: Route }) {
  if (route.name === 'editor') return <Editor key={route.id} id={route.id} onBack={() => go(paths.home)} />;
  if (route.name === 'link') return <SharedImport code={route.code} onOpen={id => go(paths.editor(id))} onHome={() => go(paths.home)} />;
  return <Home onOpen={id => go(paths.editor(id))} />;
}

const TAB_OF: Partial<Record<Route['name'], TabId>> = { home: 'home', schedule: 'schedule', records: 'records', tactics: 'tactics', more: 'more' };

function TeamApp({ route }: { route: Route }) {
  switch (route.name) {
    case 'editor': return <Editor key={route.id} id={route.id} onBack={() => go(paths.tactics)} />;
    case 'link': return <SharedImport code={route.code} onOpen={id => go(paths.editor(id))} onHome={() => go(paths.tactics)} />;
    case 'shared': return <PublicView key={route.id} id={route.id} onOpen={id => go(paths.editor(id))} onHome={() => go(paths.tactics)} />;
    default: break;
  }
  const page = (() => {
    switch (route.name) {
      case 'schedule': return <SchedulePage />;
      case 'event': return <EventPage key={route.id} id={route.id} />;
      case 'records': return <RecordsPage />;
      case 'tactics': return <TacticsPage />;
      case 'more': return <MorePage />;
      case 'roster': return <RosterPage />;
      case 'board': return <BoardPage />;
      case 'post': return <PostPage key={route.id} id={route.id} />;
      case 'admin': return <AdminPage />;
      case 'me': return <MePage />;
      default: return <HomeDashboard />;
    }
  })();
  const parent: Partial<Record<Route['name'], TabId>> = { event: 'schedule', roster: 'more', board: 'more', post: 'more', admin: 'more', me: 'more' };
  return <Shell active={TAB_OF[route.name] ?? parent[route.name] ?? 'home'}>{page}</Shell>;
}

const INSTALL_KEY = 'chukgubang:install-seen';
const installSeen = () => { try { return localStorage.getItem(INSTALL_KEY) === '1'; } catch { return true; } };
const markInstallSeen = () => { try { localStorage.setItem(INSTALL_KEY, '1'); } catch { /* ignore */ } };

/** Remember an invite / setup link so it survives e-mail confirmation and page reloads. */
function capture(route: Route) {
  if (route.name === 'invite' && route.code) savePending({ kind: 'invite', code: route.code });
  if (route.name === 'setup' && route.code) savePending({ kind: 'setup', code: route.code });
}

/** Everything behind the team wall: sign in, join (link or code), (optionally) link a player, then the app. */
function TeamGate({ route }: { route: Route }) {
  const ready = useAuth(s => s.ready);
  const user = useAuth(s => s.user);
  const member = useAuth(s => s.member);
  const isAdmin = useAuth(s => s.isAdmin);
  const [skipped, setSkipped] = useState(() => { try { return localStorage.getItem('chukgubang:skip-link') === user?.id; } catch { return false; } });
  const [tipDone, setTipDone] = useState(installSeen);

  capture(route);

  // Signing out must not leave the next person on the previous person's page.
  useEffect(() => { if (ready && !user && location.hash && location.hash !== '#/' && route.name !== 'invite' && route.name !== 'setup') go(paths.home); }, [ready, user, route.name]);

  // Members have no use for a join link; non-admins no use for the setup wizard.
  const stray = !!member && (route.name === 'invite' || (route.name === 'setup' && !isAdmin));
  useEffect(() => {
    if (!member) return;
    if (readPending()) clearPending();
    if (stray) go(paths.home);
  }, [member, stray]);

  if (!ready) return <Splash />;
  if (!user) return <LoginScreen />;
  if (!member) return <JoinScreen />;
  if (stray) return <Splash />;
  if (route.name === 'setup') return <AdminSetup onDone={() => { markInstallSeen(); setTipDone(true); go(paths.home); }} />;
  if (!member.playerId && !skipped && route.name !== 'me') {
    return <LinkPlayerScreen onSkip={() => { try { localStorage.setItem('chukgubang:skip-link', user.id); } catch { /* ignore */ } setSkipped(true); }} />;
  }
  if (!tipDone && route.name === 'home' && shouldSuggestInstall()) {
    return <InstallGuide final onDone={() => { markInstallSeen(); setTipDone(true); }} />;
  }
  return <TeamApp route={route} />;
}

export default function App() {
  const route = useRoute();
  return cloudEnabled ? <TeamGate route={route} /> : <LocalApp route={route} />;
}
