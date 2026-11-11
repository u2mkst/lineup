import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'schedule' }
  | { name: 'event'; id: string }
  | { name: 'records' }
  | { name: 'tactics' }
  | { name: 'editor'; id: string }
  | { name: 'shared'; id: string }
  | { name: 'link'; code: string }
  | { name: 'more' }
  | { name: 'roster' }
  | { name: 'board' }
  | { name: 'post'; id: string }
  | { name: 'admin' }
  | { name: 'me' };

const seg = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export function parseRoute(hash = location.hash): Route {
  const [, kind = '', arg = ''] = hash.replace(/^#/, '').split('/');
  const id = seg(arg);
  switch (kind) {
    case 'schedule': return { name: 'schedule' };
    case 'm': return id ? { name: 'event', id } : { name: 'schedule' };
    case 'records': return { name: 'records' };
    case 'tactics': return { name: 'tactics' };
    case 't': return id ? { name: 'editor', id } : { name: 'tactics' };
    case 'p': return id ? { name: 'shared', id } : { name: 'tactics' };
    case 's': return arg ? { name: 'link', code: arg } : { name: 'tactics' };
    case 'more': return { name: 'more' };
    case 'roster': return { name: 'roster' };
    case 'board': return id ? { name: 'post', id } : { name: 'board' };
    case 'admin': return { name: 'admin' };
    case 'me': return { name: 'me' };
    default: return { name: 'home' };
  }
}

export const paths = {
  home: '#/',
  schedule: '#/schedule',
  event: (id: string) => `#/m/${encodeURIComponent(id)}`,
  records: '#/records',
  tactics: '#/tactics',
  editor: (id: string) => `#/t/${encodeURIComponent(id)}`,
  shared: (id: string) => `#/p/${encodeURIComponent(id)}`,
  more: '#/more',
  roster: '#/roster',
  board: '#/board',
  post: (id: string) => `#/board/${encodeURIComponent(id)}`,
  admin: '#/admin',
  me: '#/me',
};

export const go = (path: string) => { location.hash = path; };

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  useEffect(() => {
    const on = () => { setRoute(parseRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
