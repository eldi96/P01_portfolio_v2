import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');

// Publish only browser assets. Server code, configuration, credentials, and
// verification evidence must never become static download routes.
const publicEntries = ['index.html', 'private.html', 'assets', 'css', 'js'];
const drafts = new Set(['contact-charcoal-curves-v1.png','contact-charcoal-gold-v2.png','contact-charcoal-gold-v3.png','contact-charcoal-gold-v4.png']);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of publicEntries) {
  await cp(resolve(root, entry), resolve(output, entry), { recursive: true, filter: source => !drafts.has(source.split(/[\\/]/).at(-1)) });
}
await mkdir(resolve(output, 'js/vendor'), { recursive: true });
await cp(resolve(root, 'node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js'),
  resolve(output, 'js/vendor/simplewebauthn.js'));
await cp(resolve(root, 'node_modules/@simplewebauthn/browser/LICENSE.md'),
  resolve(output, 'js/vendor/SimpleWebAuthn-LICENSE.md'));

console.log('Static output: dist/');
console.log('Published entries:', (await readdir(output)).join(', '));
