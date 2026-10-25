import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import pg from 'pg';
import { hash } from '../lib/passkeys.mjs';

// Operator-only initial enrollment. There is no public account creation endpoint.
const name = process.argv[2];
if (!name || name.length > 60) throw Error('Usage: npm run account:create -- "owner-or-test-name"');
if (!process.env.DATABASE_URL || !process.env.APP_ORIGIN) throw Error('DATABASE_URL and APP_ORIGIN are required');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const userId = randomUUID(), invitation = randomBytes(32).toString('base64url');
  await client.query('INSERT INTO t08_users(id,name) VALUES($1,$2)', [userId, name]);
  await client.query(`INSERT INTO t08_invitations(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')`, [hash(invitation), userId]);
  const titles = ['다음 프로젝트 메모', '관심 있는 역할', '나에게 남긴 회고'];
  const bodies = ['가상 메모: 작은 도구의 사용 흐름을 구상하고 있습니다.', '가상 목록: 개발 경험을 기록하는 연습용 역할입니다.', '가상 회고: 결과뿐 아니라 선택한 이유도 남기기로 했습니다.'];
  for (let i = 0; i < titles.length; i++) await client.query('INSERT INTO t08_private_items(id,user_id,title,body) VALUES($1,$2,$3,$4)',
    [randomUUID(), userId, titles[i], `${name}의 ${bodies[i]}`]);
  const file = `.enrollment-${userId}.txt`;
  await writeFile(file, `${process.env.APP_ORIGIN}/private.html#invite=${invitation}\n`, { mode: 0o600, flag: 'wx' });
  await client.query('COMMIT');
  console.log(`Account created. Open the private invitation file: ${file} (expires in 30 minutes). Do not share or upload it.`);
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
