import { generateKeyPairSync, randomBytes, createHash, sign } from 'node:crypto';
import { encodeCBOR } from '@levischuck/tiny-cbor';
const sha = bytes => createHash('sha256').update(bytes).digest();
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const encoder = { encode: encodeCBOR };

// Test-only software authenticator. Real signatures are checked by SimpleWebAuthn;
// this is not evidence of an OS/browser passkey ceremony or of Neon connectivity.
export function authenticator(userId, origin = 'https://portfolio.test') {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const id = randomBytes(32); let count = 0;
  const data = (challenge, type, site = origin) => Buffer.from(JSON.stringify({ type, challenge, origin: site, crossOrigin: false }));
  function authData(flags, counter) {
    const n = Buffer.alloc(4); n.writeUInt32BE(counter);
    return Buffer.concat([sha(Buffer.from(new URL(origin).hostname)), Buffer.from([flags]), n]);
  }
  return {
    id: b64(id),
    register(challenge, site = origin) {
      const cose = encoder.encode(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
      const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
      const auth = Buffer.concat([authData(0x45, 0), Buffer.alloc(16), length, id, cose]);
      return { id: b64(id), rawId: b64(id), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: b64(data(challenge, 'webauthn.create', site)),
          attestationObject: b64(encoder.encode(new Map([['fmt','none'],['attStmt',new Map()],['authData',auth]]))), transports: ['internal'] } };
    },
    login(challenge, { site = origin, corrupt = false, flags = 0x05 } = {}) {
      const client = data(challenge, 'webauthn.get', site), auth = authData(flags, ++count);
      const signature = sign('sha256', Buffer.concat([auth, sha(client)]), privateKey);
      if (corrupt) signature[signature.length - 1] ^= 1;
      return { id: b64(id), rawId: b64(id), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: b64(client), authenticatorData: b64(auth), signature: b64(signature), userHandle: b64(Buffer.from(userId)) } };
    }
  };
}
