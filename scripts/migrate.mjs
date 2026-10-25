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
  for (const name of ['001-passkeys', '002-additional-enrollment']) {
    if (!(await client.query('SELECT name FROM t08_migrations WHERE name=$1', [name])).rowCount) {
      await client.query(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
      await client.query('INSERT INTO t08_migrations(name) VALUES($1)', [name]);
      console.log(`Applied: ${name}`);
    } else console.log(`Already applied: ${name}`);
  }
  await client.query('COMMIT');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
