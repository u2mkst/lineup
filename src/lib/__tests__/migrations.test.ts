import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(__dirname, '../../../supabase/migrations');

/**
 * Supabase rejects UPDATE/DELETE without WHERE ("UPDATE requires a WHERE clause"), which the in-memory fake used
 * in browser tests does not. This catches the mistake in the SQL itself.
 */
describe('migrations', () => {
  const stripComments = (sql: string) => sql.replace(/--.*$/gm, '');
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql'))) {
    it(`${file}: every UPDATE and DELETE has a WHERE`, () => {
      const sql = stripComments(readFileSync(join(dir, file), 'utf8'));
      const statements = sql.match(/\b(update\s+[\w."]+\s+set|delete\s+from\s+[\w."]+)[^;]*;/gi) ?? [];
      const missing = statements.filter(st => !/\bwhere\b/i.test(st));
      expect(missing).toEqual([]);
    });
  }
});
