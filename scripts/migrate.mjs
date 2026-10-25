import { readFile } from 'node:fs/promises';
import pg from 'pg';
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) throw Error('DATABASE_URL_UNPOOLED is required for migrations');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(8001)");
  await client.query('CREATE TABLE IF NOT EXISTS t08_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const name = '001-passkeys';
  if (!(await client.query('SELECT name FROM t08_migrations WHERE name=$1', [name])).rowCount) {
    await client.query(await readFile(new URL('../migrations/001-passkeys.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO t08_migrations(name) VALUES($1)', [name]);
    console.log('Applied: 001-passkeys');
  } else console.log('Already applied: 001-passkeys');
  await client.query('COMMIT');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
