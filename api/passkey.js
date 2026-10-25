import { database } from '../lib/db.mjs';
import { createPasskeyHandler } from '../lib/passkeys.mjs';

let handler;
export default async function passkey(req, res) {
  try {
    handler ||= createPasskeyHandler({ db: database(), origin: process.env.APP_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) });
    await handler(req, res);
  } catch {
    res.setHeader('Cache-Control', 'private, no-store');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: '나만의 공간 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.' }));
  }
}
