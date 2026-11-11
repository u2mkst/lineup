import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { Home } from './components/Home';
import { PublicView } from './components/PublicView';
import { SharedImport } from './components/SharedImport';
import { AdminPage } from './components/team/Admin';
import { JoinScreen, LinkPlayerScreen, LoginScreen, Splash } from './components/team/AuthScreens';
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

/** Everything behind the team wall: sign in, join with the code, (optionally) link a player, then the app. */
function TeamGate({ route }: { route: Route }) {
  const ready = useAuth(s => s.ready);
  const user = useAuth(s => s.user);
  const member = useAuth(s => s.member);
  const [skipped, setSkipped] = useState(() => { try { return localStorage.getItem('chukgubang:skip-link') === user?.id; } catch { return false; } });

  // Signing out must not leave the next person on the previous person's page.
  useEffect(() => { if (ready && !user && location.hash && location.hash !== '#/') go(paths.home); }, [ready, user]);

  if (!ready) return <Splash />;
  if (!user) return <LoginScreen />;
  if (!member) return <JoinScreen />;
  if (!member.playerId && !skipped && route.name !== 'me') {
    return <LinkPlayerScreen onSkip={() => { try { localStorage.setItem('chukgubang:skip-link', user.id); } catch { /* ignore */ } setSkipped(true); }} />;
  }
  return <TeamApp route={route} />;
}

export default function App() {
  const route = useRoute();
  return cloudEnabled ? <TeamGate route={route} /> : <LocalApp route={route} />;
}
