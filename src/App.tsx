import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { Home } from './components/Home';

const parse = () => {
  const m = location.hash.match(/^#\/t\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};

export default function App() {
  const [id, setId] = useState<string | null>(parse);
  useEffect(() => {
    const on = () => setId(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const open = (next: string | null) => { location.hash = next ? `#/t/${encodeURIComponent(next)}` : '#/'; };
  return id ? <Editor key={id} id={id} onBack={() => open(null)} /> : <Home onOpen={open} />;
}
