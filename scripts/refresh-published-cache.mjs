#!/usr/bin/env node
/**
 * L37 (dette L11, cache CDN des anciennes URL publiques) : réécrit à l'identique les fichiers du bucket
 * « published » écrits avant son passage en privé (migration 20261118090000). Une mise à jour d'objet
 * invalide le Smart CDN de Supabase, qui ne peut alors plus servir l'ancienne copie publique en cache.
 *
 * À lancer une fois par l'exploitant, avec la clé service role passée dans l'environnement (jamais écrite
 * dans le dépôt) :
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/refresh-published-cache.mjs          # liste
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/refresh-published-cache.mjs --apply  # réécrit
 * Option : --before <date ISO> (par défaut, l'heure de la migration L11).
 */
import { pathToFileURL } from 'node:url';

export const BUCKET = 'published';
export const L11_SWITCH = '2026-11-18T09:00:00Z';

/** Parcourt récursivement le bucket ; `list(prefix)` rend les entrées d'un dossier (API Storage). */
export async function* walk(list, prefix = '') {
  for (let offset = 0; ; offset += 1000) {
    const page = await list(prefix, offset);
    for (const e of page) {
      if (e.id === null) yield* walk(list, `${prefix}${e.name}/`);
      else yield { path: `${prefix}${e.name}`, ...e };
    }
    if (page.length < 1000) return;
  }
}

/**
 * Réécrit (ou liste, sans `apply`) les objets antérieurs à `before`. Type et durée de cache conservés.
 * Renvoie les chemins concernés.
 */
export async function refresh({
  list,
  download,
  upload,
  before = L11_SWITCH,
  apply = false,
  log = () => {},
}) {
  const limit = Date.parse(before);
  if (!Number.isFinite(limit)) throw new Error(`date invalide : ${before}`);
  const touched = [];
  for await (const o of walk(list)) {
    const at = Date.parse(o.updated_at ?? o.created_at ?? '');
    if (!(at < limit)) continue;
    touched.push(o.path);
    if (!apply) {
      log(`à réécrire : ${o.path}`);
      continue;
    }
    const body = await download(o.path);
    await upload(o.path, body, {
      contentType: o.metadata?.mimetype ?? 'application/octet-stream',
      cacheControl: o.metadata?.cacheControl ?? 'max-age=3600',
    });
    log(`réécrit : ${o.path}`);
  }
  return touched;
}

/** Client de l'API Storage (fetch natif, aucune dépendance). */
export function storageClient(url, key, fetchImpl = fetch) {
  const base = `${url.replace(/\/$/, '')}/storage/v1/object`;
  const auth = { authorization: `Bearer ${key}`, apikey: key };
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const ok = async (res, what) => {
    if (!res.ok) throw new Error(`${what} : HTTP ${res.status}`);
    return res;
  };
  return {
    list: async (prefix, offset) => {
      const res = await fetchImpl(`${base}/list/${BUCKET}`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
      });
      return (await ok(res, `liste ${prefix || '/'}`)).json();
    },
    download: async (path) =>
      new Uint8Array(
        await (
          await ok(await fetchImpl(`${base}/${BUCKET}/${enc(path)}`, { headers: auth }), `lecture ${path}`)
        ).arrayBuffer(),
      ),
    upload: async (path, body, { contentType, cacheControl }) => {
      await ok(
        await fetchImpl(`${base}/${BUCKET}/${enc(path)}`, {
          method: 'PUT',
          headers: {
            ...auth,
            'content-type': contentType,
            'cache-control': cacheControl,
            'x-upsert': 'true',
          },
          body,
        }),
        `écriture ${path}`,
      );
    },
  };
}

async function main(argv) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (variables d’environnement).');
    process.exit(2);
  }
  const i = argv.indexOf('--before');
  const before = i >= 0 ? argv[i + 1] : L11_SWITCH;
  const apply = argv.includes('--apply');
  const paths = await refresh({ ...storageClient(url, key), before, apply, log: (l) => console.log(l) });
  console.log(`${paths.length} fichier(s) ${apply ? 'réécrit(s)' : 'à réécrire (relancer avec --apply)'}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
