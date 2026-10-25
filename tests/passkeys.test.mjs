import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { authenticator } from './support/software-authenticator.mjs';
import { createPasskeyHandler, hash } from '../lib/passkeys.mjs';

const origin = 'https://portfolio.test';
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const live = process.env.T08_LIVE_DB === '1';
if (live && !['dev-t08-passkey','br-muddy-hill-b7xm0ey4'].includes(process.env.NEON_BRANCH)) throw Error('Live tests are restricted to the isolated T08 Neon development branch');
test('Passkey API + '+(live?'live Neon PostgreSQL':'PGlite Postgres')+' + real WebAuthn signature verification', async t => {
  const sql = live ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 15000 }) : new PGlite();
  if (!live) await sql.exec(await readFile(new URL('../migrations/001-passkeys.sql', import.meta.url), 'utf8'));
  const db = live ? sql : { query: (s, v) => sql.query(s, v), connect: async () => ({ query: (s, v) => sql.query(s, v), release() {} }) };
  const handler = createPasskeyHandler({ db, origin });
  const evidence = { environment: live ? 'Live isolated Neon PostgreSQL + software authenticator, NOT OS/browser passkey' : 'PGlite test Postgres + software authenticator, NOT live Neon or browser', requests: [] };
  let serial = 0;
  function browser() {
    const jar = new Map(), ip = `test-${++serial}`;
    return { jar, async request(action, body, query = '', headers = {}) {
      const req = { url: `/api/passkey?action=${action}${query}`, method: body === undefined ? 'GET' : 'POST', body,
        headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), origin, 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers } };
      const responseHeaders = {};
      const res = { statusCode: 200, setHeader(k, v) { responseHeaders[k.toLowerCase()] = v; }, end(raw) { this.body = JSON.parse(raw); } };
      await handler(req, res);
      evidence.requests.push({ action, method: req.method, status: res.statusCode,
        error: res.body.error || null, itemCount: res.body.items?.length, keyCount: res.body.keys?.length });
      for (const line of [responseHeaders['set-cookie'] || []].flat()) {
        const [kv] = line.split(';'), i = kv.indexOf('=');
        if (line.includes('Max-Age=0;') || line.endsWith('Max-Age=0')) jar.delete(kv.slice(0, i));
        else jar.set(kv.slice(0, i), kv.slice(i + 1));
      }
      return { status: res.statusCode, body: res.body, headers: responseHeaders };
    } };
  }
  const a = browser(), b = browser(), stranger = browser();
  const keyA = authenticator('account-a'), spareA = authenticator('account-a'), keyB = authenticator('account-b');
  async function provision(id, invite) {
    await sql.query('INSERT INTO t08_users VALUES($1,$2)', [id, id]);
    await sql.query("INSERT INTO t08_invitations VALUES($1,$2,now()+interval '30 minutes')", [hash(invite), id]);
    for (let i = 1; i <= 3; i++) await sql.query('INSERT INTO t08_private_items VALUES($1,$2,$3,$4)', [`${id}-${i}`, id, `fictional-${i}`, `${id} private fixture ${i}`]);
  }
  async function register(client, key, invitation) {
    const options = await client.request('register-options', { invitation, name: 'Test device' });
    assert.equal(options.status, 200, JSON.stringify(options.body));
    const credential = key.register(options.body.challenge);
    const response = await client.request('register-verify', { credential });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response;
  }
  async function login(client, key, settings) {
    const options = await client.request('login-options', {});
    return client.request('login-verify', { credential: key.login(options.body.challenge, settings) });
  }
  try {
    await provision('account-a', 'invite-a'); await provision('account-b', 'invite-b');
    await t.test('anonymous private requests return 401; cross-origin requests return 403', async () => {
      assert.equal((await stranger.request('items')).status, 401);
      assert.equal((await stranger.request('keys')).status, 401);
      assert.equal((await stranger.request('login-options', {}, '', { origin: 'https://evil.test' })).status, 403);
    });
    await t.test('registration stores public keys only; canceled registration saves no key', async () => {
      const before = await sql.query('SELECT count(*)::int n FROM t08_credentials');
      const first = await stranger.request('register-options', { invitation: 'invite-a', name: 'Canceled' });
      const second = await stranger.request('register-options', { invitation: 'invite-a', name: 'Canceled again' });
      assert.notEqual(first.body.challenge, second.body.challenge);
      const savedChallenge = (await sql.query('SELECT challenge FROM t08_challenges WHERE token_hash=$1', [hash(stranger.jar.get('__Host-t08_challenge'))])).rows[0];
      assert.equal(savedChallenge.challenge, second.body.challenge);
      assert.equal((await sql.query('SELECT count(*)::int n FROM t08_credentials')).rows[0].n, before.rows[0].n);
      await register(a, keyA, 'invite-a'); await register(b, keyB, 'invite-b');
      const key = (await sql.query('SELECT * FROM t08_credentials WHERE id=$1', [keyA.id])).rows[0];
      assert.ok(key.public_key); assert.equal(Number(key.counter), 0); assert.ok(!('private_key' in key));
      evidence.storedTestPublicKey = key.public_key;
      assert.match((await a.request('keys')).body.keys[0].created_at, /^\d{4}/);
      assert.equal((await stranger.request('register-options', { invitation: 'invite-a', name: 'Stolen invite' })).status, 403);
    });
    await t.test('two accounts read only their own items; both cross-account directions fail without changing counts', async () => {
      const before = JSON.stringify((await sql.query('SELECT user_id,count(*) FROM t08_private_items GROUP BY user_id ORDER BY user_id')).rows);
      assert.equal((await a.request('items')).body.items.length, 3);
      assert.ok((await a.request('items')).body.items.every(x => x.body.startsWith('account-a')));
      assert.equal((await a.request('items', undefined, '&owner=account-b')).status, 403);
      assert.equal((await b.request('items', undefined, '&owner=account-a')).status, 403);
      const tampered = await a.request('items', undefined, '&user_id=account-b');
      assert.equal(tampered.status, 200);
      assert.ok(tampered.body.items.every(x => x.body.startsWith('account-a')));
      assert.equal(JSON.stringify((await sql.query('SELECT user_id,count(*) FROM t08_private_items GROUP BY user_id ORDER BY user_id')).rows), before);
    });
    await t.test('challenge changes each time and is atomically single use', async () => {
      const first = await stranger.request('login-options', {}), second = await stranger.request('login-options', {});
      assert.notEqual(first.body.challenge, second.body.challenge);
      const credential = keyA.login(second.body.challenge);
      const saved = new Map(stranger.jar);
      assert.equal((await stranger.request('login-verify', { credential })).status, 200);
      stranger.jar.clear(); for (const entry of saved) stranger.jar.set(...entry);
      assert.equal((await stranger.request('login-verify', { credential })).status, 401);
    });
    await t.test('wrong signature, origin, challenge, user handle, and missing user verification are rejected', async () => {
      assert.equal((await login(stranger, keyA, { corrupt: true })).status, 401);
      assert.equal((await login(stranger, keyA, { site: 'https://evil.test' })).status, 401);
      assert.equal((await login(stranger, keyA, { flags: 0x01 })).status, 401);
      await stranger.request('login-options', {});
      assert.equal((await stranger.request('login-verify', { credential: keyA.login('wrong-challenge') })).status, 401);
      const options = await stranger.request('login-options', {}), credential = keyA.login(options.body.challenge);
      credential.response.userHandle = b64(Buffer.from('account-b'));
      assert.equal((await stranger.request('login-verify', { credential })).status, 401);
    });
    await t.test('expired questions fail; session cookies are Secure, HttpOnly and SameSite=Strict', async () => {
      const options = await stranger.request('login-options', {});
      await sql.query("UPDATE t08_challenges SET expires_at=now()-interval '1 second'");
      assert.equal((await stranger.request('login-verify', { credential: keyA.login(options.body.challenge) })).status, 401);
      const response = await login(stranger, keyA);
      assert.equal(response.status, 200);
      const session = response.headers['set-cookie'][0];
      assert.match(session, /HttpOnly/); assert.match(session, /Secure/); assert.match(session, /SameSite=Strict/);
    });
    await t.test('logout revokes server session even if the old cookie is reused', async () => {
      const old = new Map(stranger.jar);
      assert.equal((await stranger.request('logout', {})).status, 200);
      stranger.jar.clear(); for (const entry of old) stranger.jar.set(...entry);
      assert.equal((await stranger.request('items')).status, 401);
    });
    await t.test('second key works; other account cannot delete it; removed key and its sessions fail', async () => {
      const deletedKeySession = browser(); for (const entry of a.jar) deletedKeySession.jar.set(...entry);
      await register(a, spareA);
      assert.equal((await a.request('keys')).body.keys.length, 2);
      assert.equal((await b.request('delete-key', { id: spareA.id })).status, 403);
      assert.equal((await a.request('delete-key', { id: keyA.id })).status, 200);
      assert.equal((await deletedKeySession.request('items')).status, 401);
      assert.equal((await login(stranger, keyA)).status, 401);
      assert.equal((await login(stranger, spareA)).status, 200);
      assert.equal((await a.request('items')).status, 200);
      assert.equal((await a.request('delete-key', { id: spareA.id })).status, 409);
    });
    await t.test('session expiry rejects requests and the DB never stores raw session tokens', async () => {
      const raw = a.jar.get('__Host-t08_session');
      assert.ok((await sql.query('SELECT token_hash FROM t08_sessions')).rows.every(row => row.token_hash !== raw));
      await sql.query("UPDATE t08_sessions SET expires_at=now()-interval '1 second'");
      assert.equal((await a.request('items')).status, 401);
    });
  } finally {
    await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
    await writeFile(new URL(live?'../test-results/passkey-neon.json':'../test-results/passkey-api.json', import.meta.url), JSON.stringify(evidence, null, 2));
    if (live) {
      const client = await sql.connect();
      try {
        await client.query('BEGIN');
        for (const table of ['t08_challenges','t08_invitations','t08_sessions','t08_credentials','t08_private_items','t08_users']) {
          await client.query('DELETE FROM '+table+' WHERE '+(table==='t08_users'?'id':'user_id')+' = ANY($1::text[])', [['account-a','account-b']]);
        }
        await client.query('COMMIT');
      } catch(error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); await sql.end(); }
    } else await sql.close();
  }
});
