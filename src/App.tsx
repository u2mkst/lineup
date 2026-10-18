import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { Home } from './components/Home';
import { PublicView } from './components/PublicView';
import { SharedImport } from './components/SharedImport';

type Route = { kind: 'home' } | { kind: 'tactic'; id: string } | { kind: 'shared'; code: string } | { kind: 'public'; id: string };

const parse = (): Route => {
  const t = location.hash.match(/^#\/t\/(.+)$/);
  if (t) return { kind: 'tactic', id: decodeURIComponent(t[1]) };
  const pub = location.hash.match(/^#\/p\/(.+)$/);
  if (pub) return { kind: 'public', id: decodeURIComponent(pub[1]) };
  const s = location.hash.match(/^#\/s\/(.+)$/);
  if (s) return { kind: 'shared', code: s[1] };
  return { kind: 'home' };
};

export default function App() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const open = (id: string | null) => { location.hash = id ? `#/t/${encodeURIComponent(id)}` : '#/'; };

  if (route.kind === 'tactic') return <Editor key={route.id} id={route.id} onBack={() => open(null)} />;
  if (route.kind === 'public') return <PublicView id={route.id} onOpen={open} onHome={() => open(null)} />;
  if (route.kind === 'shared') return <SharedImport code={route.code} onOpen={open} onHome={() => open(null)} />;
  return <Home onOpen={open} />;
}
