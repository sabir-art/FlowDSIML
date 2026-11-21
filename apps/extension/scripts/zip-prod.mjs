/**
 * EXT-STORE : archive de l'extension pour le Chrome Web Store (`pnpm --filter @flowdsiml/extension zip:prod`).
 * Les adresses et la clé publique viennent de l'environnement, jamais du dépôt :
 *   WXT_SUPABASE_URL       adresse https du projet Supabase de production
 *   WXT_SUPABASE_ANON_KEY  clé publique « anon » (jamais la clé service_role)
 *   WXT_APP_URL            adresse https de l'application
 * Le script refuse une valeur absente, une adresse en http ou locale, et toute clé dont le rôle n'est pas « anon ».
 */
import { spawnSync } from 'node:child_process';

const fail = (msg) => {
  console.error(`zip:prod : ${msg}`);
  process.exit(1);
};
const httpsUrl = (name) => {
  const v = (process.env[name] ?? '').trim();
  if (!v) fail(`${name} manquante (voir docs/extension/store/README.md).`);
  let u;
  try {
    u = new URL(v);
  } catch {
    fail(`${name} n'est pas une adresse valide.`);
  }
  if (u.protocol !== 'https:') fail(`${name} doit commencer par https://.`);
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname) || u.hostname.endsWith('.example'))
    fail(`${name} doit être l'adresse de production, pas une adresse locale ou d'exemple.`);
  return v.replace(/\/$/, '');
};

httpsUrl('WXT_SUPABASE_URL');
httpsUrl('WXT_APP_URL');
const key = (process.env.WXT_SUPABASE_ANON_KEY ?? '').trim();
if (!key) fail('WXT_SUPABASE_ANON_KEY manquante.');
// Ancien format (JWT) : le rôle est dans la charge utile ; nouveau format : préfixe « sb_publishable_ »
if (key.startsWith('sb_secret_'))
  fail('clé secrète refusée : il faut la clé publique (anon ou publishable).');
if (!key.startsWith('sb_publishable_')) {
  const part = key.split('.')[1];
  let role = null;
  try {
    role = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')).role;
  } catch {
    fail('WXT_SUPABASE_ANON_KEY illisible (ni JWT ni clé publishable).');
  }
  if (role !== 'anon') fail(`clé de rôle « ${role} » refusée : il faut la clé publique anon.`);
}

const r = spawnSync('pnpm', ['exec', 'wxt', 'zip'], { stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
