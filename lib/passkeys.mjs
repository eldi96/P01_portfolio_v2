import { createHash, randomBytes } from 'node:crypto';
import { generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';

export const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const SESSION_SECONDS = 60 * 60 * 8;
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const deny = (status, message) => { throw new HttpError(status, message); };
const safeText = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;

// Dependencies can be supplied in tests; production always uses the real Postgres pool.
export function createPasskeyHandler({ db, origin }) {
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== 'https:' && url.hostname !== 'localhost')) {
    throw new Error('APP_ORIGIN must be an HTTPS origin (localhost allowed for development)');
  }
  const secure = url.protocol === 'https:';
  const sessionCookie = secure ? '__Host-t08_session' : 't08_session';
  const challengeCookie = secure ? '__Host-t08_challenge' : 't08_challenge';
  const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const list = async (sql, values = []) => (await db.query(sql, values)).rows;

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
      const i = part.indexOf('='); return i < 0 ? ['', ''] : [part.slice(0, i).trim(), part.slice(i + 1)];
    }));
    const sessionHash = hash(cookies[sessionCookie] || '');
    const session = async () => one(`SELECT s.user_id, u.name FROM t08_sessions s
      JOIN t08_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [sessionHash]);
    const requireSession = async () => (await session()) || deny(401, '패스키로 먼저 들어와 주세요.');
    const issueSession = async (userId, credentialId) => {
      const raw = token();
      // Serialize with key deletion; a deleted credential cannot create a new session.
      const row = await one(`INSERT INTO t08_sessions(token_hash,user_id,credential_id,expires_at)
        SELECT $1,user_id,id,now()+interval '8 hours' FROM t08_credentials
        WHERE id=$2 AND user_id=$3 FOR KEY SHARE RETURNING user_id`, [hash(raw), credentialId, userId]);
      if (!row) deny(401, '삭제된 패스키입니다.');
      res.setHeader('Set-Cookie', [cookie(sessionCookie, raw, SESSION_SECONDS), cookie(challengeCookie, '', 0)]);
    };
    const newChallenge = async (options, purpose, userId = null, invitationHash = null, keyName = null) => {
      const raw = token();
      // A browser has one active ceremony; issuing another invalidates its previous ceremony.
      await db.query('DELETE FROM t08_challenges WHERE token_hash=$1 OR expires_at<=now()', [hash(cookies[challengeCookie] || '')]);
      await db.query(`INSERT INTO t08_challenges(token_hash,challenge,purpose,user_id,invitation_hash,session_hash,key_name,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes')`,
      [hash(raw), options.challenge, purpose, userId, invitationHash, purpose === 'register' && !invitationHash ? sessionHash : null, keyName]);
      res.setHeader('Set-Cookie', cookie(challengeCookie, raw, 300));
      return options;
    };
    const consumeChallenge = async purpose => {
      // Atomic DELETE RETURNING also consumes invalid signature attempts and prevents races/replay.
      const row = await one(`DELETE FROM t08_challenges WHERE token_hash=$1 AND purpose=$2
        AND expires_at>now() RETURNING *`, [hash(cookies[challengeCookie] || ''), purpose]);
      if (!row) deny(401, '질문이 만료되었거나 이미 사용됐습니다. 다시 시도해 주세요.');
      res.setHeader('Set-Cookie', cookie(challengeCookie, '', 0));
      return row;
    };
    try {
      const action = new URL(req.url, origin).searchParams.get('action');
      const readActions = new Set(['session', 'items', 'keys']);
      if (req.method !== (readActions.has(action) ? 'GET' : 'POST')) deny(405, '허용되지 않은 요청입니다.');
      let body = {};
      if (req.method === 'POST') {
        if (req.headers.origin !== origin || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
          deny(403, '이 사이트에서 시작한 요청만 허용됩니다.');
        }
        if (req.body !== undefined) {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
          if (JSON.stringify(body).length > 20000) deny(413, '요청이 너무 큽니다.');
        } else {
          const chunks = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > 20000) deny(413, '요청이 너무 큽니다.'); chunks.push(chunk); }
          body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) deny(400, '잘못된 요청입니다.');
        const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
        const bucket = hash(`${ip}:${Math.floor(Date.now() / 60000)}`);
        const rate = await one(`INSERT INTO t08_rate_limits(bucket,attempts,expires_at) VALUES($1,1,now()+interval '2 minutes')
          ON CONFLICT(bucket) DO UPDATE SET attempts=t08_rate_limits.attempts+1 RETURNING attempts`, [bucket]);
        if (rate.attempts > 60) deny(429, '잠시 후 다시 시도해 주세요.');
        await db.query('DELETE FROM t08_rate_limits WHERE expires_at<=now()');
      }
      if (action === 'session') return reply(200, { user: await session() || null });
      if (action === 'items') {
        const user = await requireSession();
        // user_id is ignored: identity always comes from the server session.
        // A direct request for a resource owned by another account is explicitly denied.
        const target = new URL(req.url, origin).searchParams.get('owner');
        if (target && target !== user.user_id) deny(403, '다른 사람의 자료는 열 수 없습니다.');
        return reply(200, { items: await list('SELECT id,title,body FROM t08_private_items WHERE user_id=$1 ORDER BY id', [user.user_id]) });
      }
      if (action === 'keys') {
        const user = await requireSession();
        return reply(200, { keys: await list(`SELECT id,name,created_at,device_type,backed_up FROM t08_credentials WHERE user_id=$1 ORDER BY created_at`, [user.user_id]) });
      }
      if (action === 'register-options') {
        const user = await session();
        let owner = user, invitationHash = null;
        if (!owner) {
          if (!safeText(body.invitation, 128)) deny(403, '최초 등록에는 소유자가 발급한 일회용 초대가 필요합니다.');
          invitationHash = hash(body.invitation);
          owner = await one(`SELECT i.user_id,u.name FROM t08_invitations i JOIN t08_users u ON u.id=i.user_id
            WHERE i.token_hash=$1 AND i.expires_at>now()
            AND NOT EXISTS(SELECT 1 FROM t08_credentials c WHERE c.user_id=i.user_id)`, [invitationHash]);
          if (!owner) deny(403, '사용할 수 없는 초대입니다.');
        }
        if (!safeText(body.name?.trim(), 60)) deny(400, '패스키 이름을 1~60자로 입력해 주세요.');
        const existing = await list('SELECT id,transports FROM t08_credentials WHERE user_id=$1', [owner.user_id]);
        const options = await generateRegistrationOptions({ rpName: 'ELDI 나만의 공간', rpID: url.hostname,
          userID: new TextEncoder().encode(owner.user_id), userName: owner.name,
          attestationType: 'none', supportedAlgorithmIDs: [-7, -257],
          excludeCredentials: existing, authenticatorSelection: { residentKey: 'required', userVerification: 'required' } });
        return reply(200, await newChallenge(options, 'register', owner.user_id, invitationHash, body.name.trim()));
      }
      if (action === 'register-verify') {
        const challenge = await consumeChallenge('register');
        if (!challenge.invitation_hash) {
          const user = await requireSession();
          if (challenge.session_hash !== sessionHash || user.user_id !== challenge.user_id) deny(403, '등록을 시작한 로그인 상태가 아닙니다.');
        }
        let result;
        try { result = await verifyRegistrationResponse({ response: body.credential,
          expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: url.hostname,
          requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] }); }
        catch { deny(401, '패스키 등록을 확인하지 못했습니다.'); }
        if (!result.verified) deny(401, '패스키 등록을 확인하지 못했습니다.');
        const info = result.registrationInfo, key = info.credential;
        const client = await db.connect();
        try {
          await client.query('BEGIN');
          // Lock the user to serialize first enrollment and last-key deletion.
          await client.query('SELECT id FROM t08_users WHERE id=$1 FOR UPDATE', [challenge.user_id]);
          if (challenge.invitation_hash) {
            const invite = (await client.query(`DELETE FROM t08_invitations WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()
              AND NOT EXISTS(SELECT 1 FROM t08_credentials WHERE user_id=$2) RETURNING user_id`, [challenge.invitation_hash, challenge.user_id])).rows[0];
            if (!invite) deny(403, '이미 사용됐거나 만료된 초대입니다.');
          } else {
            const live = (await client.query('SELECT user_id FROM t08_sessions WHERE token_hash=$1 AND expires_at>now()', [sessionHash])).rows[0];
            if (!live) deny(401, '로그인이 만료되었습니다.');
          }
          await client.query(`INSERT INTO t08_credentials(id,user_id,public_key,counter,transports,name,device_type,backed_up)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [key.id, challenge.user_id, Buffer.from(key.publicKey).toString('base64url'),
            key.counter, JSON.stringify(key.transports || []), challenge.key_name, info.credentialDeviceType, info.credentialBackedUp]);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
        await issueSession(challenge.user_id, key.id);
        return reply(200, { ok: true });
      }
      if (action === 'login-options') {
        return reply(200, await newChallenge(await generateAuthenticationOptions({ rpID: url.hostname,
          userVerification: 'required' }), 'login'));
      }
      if (action === 'login-verify') {
        const challenge = await consumeChallenge('login');
        if (!safeText(body.credential?.id, 2048)) deny(401, '패스키를 확인하지 못했습니다.');
        const key = await one('SELECT * FROM t08_credentials WHERE id=$1', [body.credential.id]);
        if (!key) deny(401, '등록되지 않았거나 삭제된 패스키입니다.');
        if (body.credential.response?.userHandle !== Buffer.from(key.user_id).toString('base64url')) deny(401, '사용자가 일치하지 않습니다.');
        let result;
        try { result = await verifyAuthenticationResponse({ response: body.credential,
          expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: url.hostname,
          credential: { id: key.id, publicKey: new Uint8Array(Buffer.from(key.public_key, 'base64url')),
            counter: Number(key.counter), transports: key.transports }, requireUserVerification: true }); }
        catch { deny(401, '패스키 서명을 확인하지 못했습니다.'); }
        if (!result.verified) deny(401, '패스키 서명을 확인하지 못했습니다.');
        const updated = await one(`UPDATE t08_credentials SET counter=$1 WHERE id=$2 AND counter=$3 RETURNING id`,
          [result.authenticationInfo.newCounter, key.id, key.counter]);
        if (!updated) deny(401, '패스키 상태가 바뀌었습니다. 다시 시도해 주세요.');
        await issueSession(key.user_id, key.id);
        return reply(200, { ok: true });
      }
      if (action === 'delete-key') {
        const user = await requireSession();
        if (!safeText(body.id, 2048)) deny(400, '패스키를 선택해 주세요.');
        const client = await db.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT id FROM t08_users WHERE id=$1 FOR UPDATE', [user.user_id]);
          const live = (await client.query('SELECT user_id FROM t08_sessions WHERE token_hash=$1 AND expires_at>now()', [sessionHash])).rows[0];
          if (!live) deny(401, '로그인이 만료되었습니다.');
          const keys = (await client.query('SELECT id FROM t08_credentials WHERE user_id=$1', [user.user_id])).rows;
          if (!keys.some(key => key.id === body.id)) deny(403, '다른 사람의 패스키는 삭제할 수 없습니다.');
          if (keys.length <= 1) deny(409, '마지막 패스키는 삭제할 수 없습니다. 먼저 다른 패스키를 등록해 주세요.');
          await client.query('DELETE FROM t08_credentials WHERE id=$1 AND user_id=$2', [body.id, user.user_id]);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
        return reply(200, { ok: true });
      }
      if (action === 'logout') {
        await db.query('DELETE FROM t08_sessions WHERE token_hash=$1', [sessionHash]);
        await db.query('DELETE FROM t08_challenges WHERE token_hash=$1', [hash(cookies[challengeCookie] || '')]);
        res.setHeader('Set-Cookie', [cookie(sessionCookie, '', 0), cookie(challengeCookie, '', 0)]);
        return reply(200, { ok: true });
      }
      deny(404, '요청을 찾을 수 없습니다.');
    } catch (error) {
      // No credentials, signatures, challenge values or session tokens in runtime logs.
      if (!error.status && !(error instanceof SyntaxError)) console.error('Passkey request failed:', error.code || error.name);
      reply(error.status || (error instanceof SyntaxError ? 400 : 503), { error: error.status ? error.message :
        error instanceof SyntaxError ? '잘못된 요청입니다.' : '연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  };
}
