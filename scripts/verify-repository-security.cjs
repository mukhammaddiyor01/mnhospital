// Read-only check. Never print credential values or source lines.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const forbidden = files.filter((file) => {
  const name = path.basename(file);
  return (name === '.env' || name.startsWith('.env.')) && name !== '.env.example'
    || /^(?:secrets|credentials|service-account).*\.json$/i.test(name)
    || /(?:\.credentials\.json|\.(?:pem|key|p12|pfx|jks|keystore))$/i.test(name);
});
const secrets = new Map();
for (const name of fs.readdirSync(root)) {
  if (!(name === '.env' || name.startsWith('.env.')) || name === '.env.example') continue;
  const filename = path.join(root, name);
  if (!fs.statSync(filename).isFile()) continue;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    const value = raw.replace(/^(['"])(.*)\1$/, '$2');
    if (!key.startsWith('NEXT_PUBLIC_') && /SECRET|PASSWORD|PRIVATE|TOKEN|API_KEY|MONGO_(?:DEV|PROD)/i.test(key)
      && value.length >= 8 && !/^(?:your[-_]|replace[-_]|change[-_]|<)/i.test(value)) secrets.set(key, value);
  }
}
const leaks = [];
for (const file of files) {
  const filename = path.join(root, file);
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) continue;
  const contents = fs.readFileSync(filename);
  for (const [key, value] of secrets) if (contents.includes(Buffer.from(value))) leaks.push({ file, key });
}
for (const file of forbidden) console.error(`Forbidden tracked credential file: ${file}`);
for (const { file, key } of leaks) console.error(`Local credential appears in tracked content: ${file} (${key})`);
if (forbidden.length || leaks.length) process.exitCode = 1;
else console.log(`Repository security: ${files.length} tracked paths checked; no private environment files or current local credential values found.`);
