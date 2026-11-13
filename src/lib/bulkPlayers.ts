import type { Player, Pos } from '../types';

export interface ParsedPlayer {
  line: number;
  number: string;
  name: string;
  pos: Pos;
  /** why this line cannot be added */
  error?: string;
}

const POS_WORDS: [RegExp, Pos][] = [
  [/^(gk|골키퍼|키퍼|골기퍼)$/i, 'GK'],
  [/^(df|수비수|수비|디펜더)$/i, 'DF'],
  [/^(mf|미드필더|미드|중앙)$/i, 'MF'],
  [/^(fw|공격수|공격|포워드|스트라이커)$/i, 'FW'],
];
const asPos = (w: string): Pos | null => POS_WORDS.find(([re]) => re.test(w))?.[1] ?? null;

/**
 * "7 김철수 MF" / "김철수 7 미드필더" / "10, 이영희" — one player per line, any order.
 * The shirt number is the digits, the position is GK/DF/MF/FW (or 골키퍼/수비/미드/공격), the rest is the name.
 * No position means MF. A "#" before the number is fine.
 */
export function parsePlayers(text: string, existing: Pick<Player, 'number' | 'name'>[] = []): ParsedPlayer[] {
  const taken = new Map(existing.map(p => [p.number, p.name]));
  const seen = new Map<string, string>();
  const rows: ParsedPlayer[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const tokens = raw.replace(/[,\t;|/]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    let number = '';
    let pos: Pos | null = null;
    const nameParts: string[] = [];
    for (const t of tokens) {
      const digits = /^#?(\d{1,3})(번)?$/.exec(t);
      if (digits && !number) { number = String(Number(digits[1])); continue; }
      const p = asPos(t);
      if (p && !pos) { pos = p; continue; }
      nameParts.push(t);
    }
    const name = nameParts.join(' ');
    const row: ParsedPlayer = { line: i + 1, number, name, pos: pos ?? 'MF' };
    if (!number) row.error = '등번호가 없어요';
    else if (!name) row.error = '이름이 없어요';
    else if (name.length > 8) row.error = '이름은 8자 이내예요';
    else if (taken.has(number)) row.error = `${taken.get(number)} 선수가 이미 쓰는 번호예요`;
    else if (seen.has(number)) row.error = `${seen.get(number)}와(과) 번호가 겹쳐요`;
    if (!row.error) seen.set(number, name);
    rows.push(row);
  });
  return rows;
}
