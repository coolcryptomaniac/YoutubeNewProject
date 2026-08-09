import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../studio-v2-credentials.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../studio-v2.html',import.meta.url),'utf8');

assert.match(js,/ridge\.credentials\.v1/,'must use a version-independent credential namespace');
assert.match(js,/ridge\.v25\.groq/,'must migrate current Groq session key');
assert.match(js,/ridge\.v25\.pollinationsKey/,'must migrate current Pollinations key');
assert.match(js,/ridge\.v25\.youtubeClient/,'must migrate current YouTube client ID');
assert.match(js,/ridge\.v2\.simple\.groq/,'must migrate older simple-mode Groq key');
assert.match(js,/ridge\.v2\.simple\.pexels/,'must preserve legacy Pexels key for compatibility');
assert.match(js,/AES-GCM/,'backup must use authenticated encryption');
assert.match(js,/PBKDF2/,'backup must derive an encryption key from a passphrase');
assert.ok(!/access[_ -]?token\s*[:=].*localStorage/i.test(js),'must not persist YouTube access tokens');
for(const id of ['backupCredentials','restoreCredentials','forgetCredentials','credentialFile','credentialState'])assert.ok(html.includes(`id="${id}"`),`${id} missing`);
assert.ok(html.includes('./studio-v2-credentials.js'),'credential vault module must load on V2 page');

console.log('studio-v2-credentials-selftest: PASS — stable migration + encrypted backup + no OAuth token persistence');
