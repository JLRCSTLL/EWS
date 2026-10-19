import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

export async function openDatabase() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    return {
      query: (sql, args) => pool.query(sql, args),
      transaction: async fn => {
        const client = await pool.connect();
        try { await client.query('begin'); const result = await fn(client); await client.query('commit'); return result; }
        catch (error) { await client.query('rollback'); throw error; }
        finally { client.release(); }
      },
      close: () => pool.end(),
    };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required. Refusing ephemeral storage in production.');
  const { PGlite } = await import('@electric-sql/pglite');
  const directory = process.env.LOCAL_DATABASE_PATH || './.local-data/eligtas';
  await mkdir(path.dirname(path.resolve(directory)), { recursive: true });
  const db = new PGlite(directory);
  await db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  return db;
}
