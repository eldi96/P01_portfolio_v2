import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { authenticator } from './support/software-authenticator.mjs';
import { hash } from '../lib/passkeys.mjs';
const origin=process.argv[2];
if(!origin||!origin.startsWith('https://p01-portfolio-v2-')||!origin.endsWith('-asd-2f7d.vercel.app'))throw Error('Only the isolated Vercel preview may run this test');
const dev=parseEnv(await readFile('research/.env.t08-dev','utf8'));
if(dev.NEON_BRANCH!=='dev-t08-passkey')throw Error('Incorrect verification database');
const local=parseEnv(await readFile('.env.local','utf8'));
const db=new pg.Pool({connectionString:dev.DATABASE_URL,max:3});
const ids=[randomUUID(),randomUUID()],invites=[randomBytes(32).toString('base64url'),randomBytes(32).toString('base64url')];
const evidence={environment:'Vercel preview HTTP + live Neon development DB + software authenticator; NOT an OS/browser passkey',checks:[]};
function browser(){const jar=new Map();return {jar,async request(action,body,expected,query='',extra={}){
  const r=await fetch(origin+'/api/passkey?action='+action+query,{method:body===undefined?'GET':'POST',headers:{'x-vercel-trusted-oidc-idp-token':local.VERCEL_OIDC_TOKEN,Origin:origin,'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...extra},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json();assert.equal(r.status,expected,action+': '+JSON.stringify(data));
  assert.match(r.headers.get('cache-control'),/no-store/);
  for(const line of r.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');if(/Max-Age=0(?:;|$)/.test(line))jar.delete(pair.slice(0,i));else jar.set(pair.slice(0,i),pair.slice(i+1));}
  evidence.checks.push({action,status:r.status});return data;
}};}
const a=browser(),b=browser(),stranger=browser(),keyA=authenticator(ids[0],origin),spare=authenticator(ids[0],origin),keyB=authenticator(ids[1],origin);
async function register(client,key,invite){const opt=await client.request('register-options',{name:'Verification key',invitation:invite},200);return client.request('register-verify',{credential:key.register(opt.challenge)},200);}
async function login(client,key,expected=200){const opt=await client.request('login-options',{},200);return client.request('login-verify',{credential:key.login(opt.challenge)},expected);}
try{
  for(let n=0;n<2;n++){
    await db.query('INSERT INTO t08_users(id,name) VALUES($1,$2)',[ids[n],'HTTP verification '+n]);
    await db.query("INSERT INTO t08_invitations(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '10 minutes')",[hash(invites[n]),ids[n]]);
    for(let i=0;i<3;i++)await db.query('INSERT INTO t08_private_items(id,user_id,title,body) VALUES($1,$2,$3,$4)',[randomUUID(),ids[n],'Fictional '+i,'Verification data only']);
  }
  await stranger.request('items',undefined,401);
  await stranger.request('login-options',{},403,'',{Origin:'https://untrusted.invalid'});
  await register(a,keyA,invites[0]);await register(b,keyB,invites[1]);
  assert.equal((await a.request('items',undefined,200)).items.length,3);
  await a.request('items',undefined,403,'&owner='+ids[1]);await b.request('items',undefined,403,'&owner='+ids[0]);
  const options=await a.request('login-options',{},200),credential=keyA.login(options.challenge);
  await a.request('login-verify',{credential},200);await a.request('login-verify',{credential},401);
  await register(a,spare);await a.request('delete-key',{id:keyA.id},200);
  await login(stranger,keyA,401);await login(a,spare);
  await a.request('delete-key',{id:spare.id},409);
  const old=new Map(a.jar);await a.request('logout',{},200);a.jar.clear();for(const [k,v]of old)a.jar.set(k,v);
  await a.request('items',undefined,401);
  evidence.passed=true;console.log('PASS: '+evidence.checks.length+' HTTP checks on Vercel preview and live Neon');
}finally{
  const client=await db.connect();try{await client.query('BEGIN');for(const table of ['t08_challenges','t08_invitations','t08_sessions','t08_credentials','t08_private_items','t08_users'])await client.query('DELETE FROM '+table+' WHERE '+(table==='t08_users'?'id':'user_id')+' = ANY($1::text[])',[ids]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await db.end();}
  await writeFile('test-results/passkey-vercel-preview.json',JSON.stringify(evidence,null,2));
}
