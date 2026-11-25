import { describe, expect, it } from 'vitest';

// Raw SQL of every migration (bundled by Vite, so no Node typings are needed).
const migrations = import.meta.glob('../../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/**
 * Supabase rejects UPDATE/DELETE without WHERE ("UPDATE requires a WHERE clause"), which the in-memory fake used
 * in browser tests does not. This catches the mistake in the SQL itself.
 */
describe('migrations', () => {
  it('finds the migration files', () => {
    expect(Object.keys(migrations).length).toBeGreaterThanOrEqual(5);
  });

  for (const [path, raw] of Object.entries(migrations)) {
    it(`${path.split('/').pop()}: every UPDATE and DELETE has a WHERE`, () => {
      const sql = raw.replace(/--.*$/gm, '');
      const statements = sql.match(/\b(update\s+[\w."]+\s+set|delete\s+from\s+[\w."]+)[^;]*;/gi) ?? [];
      const missing = statements.filter(st => !/\bwhere\b/i.test(st));
      expect(missing).toEqual([]);
    });
  }
});
