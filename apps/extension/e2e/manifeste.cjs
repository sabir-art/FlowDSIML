/**
 * EXT-STORE : manifeste figé. La référence est le manifeste publié sur le Store (0.2.0). Toute autorisation
 * ajoutée relancerait un examen de Google : ce contrôle échoue alors, et la référence ne se change qu'avec
 * l'accord du chef. À lancer sur la construction de la boutique (sans WXT_E2E ni WXT_DEBUGGER) :
 *   WXT_SUPABASE_URL=… WXT_SUPABASE_ANON_KEY=… pnpm build && node e2e/manifeste.cjs
 */
const fs = require('fs');
const path = require('path');
const REF = {
  permissions: ['activeTab', 'storage', 'scripting', 'tabs', 'tabCapture', 'offscreen'],
  optional_host_permissions: ['<all_urls>'],
};
// Clés qui donnent un accès : absentes du manifeste publié
const FORBIDDEN = [
  'host_permissions',
  'optional_permissions',
  'web_accessible_resources',
  'content_security_policy',
];
const file = process.argv[2] || path.resolve(__dirname, '../.output/chrome-mv3/manifest.json');
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
const ok = (c, l) => {
  console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
  if (!c) process.exitCode = 1;
};
const same = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...b].sort());
ok(m.manifest_version === 3, 'manifeste en version 3');
ok(
  same(m.permissions, REF.permissions),
  `permissions identiques au manifeste publié (${(m.permissions ?? []).join(', ')})`,
);
ok(
  same(m.optional_host_permissions, REF.optional_host_permissions),
  `accès aux sites facultatif seulement (${JSON.stringify(m.optional_host_permissions)})`,
);
for (const k of FORBIDDEN) ok(!(k in m), `pas de « ${k} »`);
ok(
  (m.content_scripts ?? []).every((c) => !(c.matches ?? []).length),
  'aucun script injecté d’office sur les sites',
);
const ext = m.externally_connectable?.matches ?? [];
ok(
  ext.length === 1 && /^https?:\/\/[a-z0-9.-]+(:\d+)?\/\*$/.test(ext[0]) && !ext[0].includes('*.'),
  `externally_connectable : une seule origine exacte, sans joker (${JSON.stringify(ext)})`,
);
