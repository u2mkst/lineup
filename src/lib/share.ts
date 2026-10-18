import type { Player, Tactic } from '../types';
import { normalizePlayer, normalizeTactic } from './validate';

export interface SharePayload {
  v: 1;
  tactic: Tactic;
  /** only the players referenced by the line-up */
  players: Player[];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function slim(t: Tactic): Tactic {
  const c = structuredClone(t);
  delete c.isPublic; // a link copy is always private
  const r = (p: { x: number; y: number }) => { p.x = round(p.x); p.y = round(p.y); };
  c.frames.forEach(f => {
    Object.values(f.positions).forEach(r);
    r(f.ball);
    Object.values(f.via).forEach(r);
    f.drawings.forEach(d => { r(d.a); r(d.b); });
  });
  return c;
}

export function buildPayload(tactic: Tactic, roster: Player[]): SharePayload {
  const used = new Set(Object.values(tactic.us.assign).filter(Boolean));
  return { v: 1, tactic: slim(tactic), players: roster.filter(p => used.has(p.id)) };
}

const toB64Url = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach(b => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (str: string) => {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** `z.` prefix = deflate-raw compressed, `p.` = plain (browsers without CompressionStream). */
export async function encodePayload(p: SharePayload): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(p));
  if (typeof CompressionStream !== 'undefined') {
    return `z.${toB64Url(await pipe(raw, new CompressionStream('deflate-raw')))}`;
  }
  return `p.${toB64Url(raw)}`;
}

export async function decodePayload(code: string): Promise<{ tactic: Tactic; players: Player[] } | null> {
  try {
    const [kind, body] = [code.slice(0, 2), code.slice(2)];
    let bytes: Uint8Array = fromB64Url(body);
    if (kind === 'z.') {
      if (typeof DecompressionStream === 'undefined') return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (kind !== 'p.') return null;
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    const tactic = normalizeTactic(raw?.tactic);
    if (!tactic) return null;
    const players = (Array.isArray(raw.players) ? raw.players : []).flatMap((p: unknown) => normalizePlayer(p) ?? []);
    return { tactic, players };
  } catch {
    return null;
  }
}

export function shareUrl(code: string): string {
  return `${location.origin}${location.pathname}#/s/${code}`;
}
