#!/usr/bin/env node
/**
 * Vérifie que chaque appel `.rpc('nom', { p_a: …, p_b })` des Edge Functions correspond à une
 * signature de fonction existante dans les migrations (état final, fichiers lus dans l'ordre) :
 *  - la fonction existe encore (pas retirée par un `drop function` ultérieur) ;
 *  - chaque paramètre passé existe dans une des signatures de ce nom ;
 *  - chaque paramètre sans valeur par défaut de cette signature est passé.
 * Un appel dont le second argument n'est pas un objet littéral doit déclarer ses paramètres dans un
 * commentaire « @rpc-params p_a, p_b » juste au-dessus, sinon il compte comme erreur.
 * Usage : node scripts/check-rpc-signatures.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const migDir = join(root, 'supabase/migrations');
const fnDir = join(root, 'supabase/functions');

/** Découpe une liste au premier niveau (virgules hors parenthèses, crochets, accolades et chaînes). */
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  let quote = null;
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Contenu entre la parenthèse (ou accolade) ouvrante à `start` et sa fermante. */
function balanced(s, start) {
  const open = s[start];
  const close = open === '(' ? ')' : '}';
  let depth = 0;
  let quote = null;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === quote && s[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return s.slice(start + 1, i);
  }
  return null;
}

// ---- Signatures finales d'après les migrations
/** nom → Map(clé des types → { params: [{name, optional}] }) */
const sigs = new Map();
const typeKey = (params) => params.map((p) => p.type).join(',');
for (const file of readdirSync(migDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  const sql = readFileSync(join(migDir, file), 'utf8').replace(/--[^\n]*/g, '');
  const re =
    /\b(create(?:\s+or\s+replace)?\s+function|drop\s+function(?:\s+if\s+exists)?)\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*(\()?/gi;
  let m;
  while ((m = re.exec(sql))) {
    const name = m[2].toLowerCase();
    const isDrop = /^drop/i.test(m[1]);
    if (!m[3]) {
      // drop function nom; (sans liste) : toutes les surcharges
      if (isDrop) sigs.delete(name);
      continue;
    }
    const inner = balanced(sql, m.index + m[0].length - 1) ?? '';
    const params = splitTop(inner)
      .filter(Boolean)
      .map((p) => {
        const optional = /\bdefault\b|=/i.test(p);
        const words = p
          .replace(/\b(default\b|=).*$/is, '')
          .trim()
          .split(/\s+/)
          .filter((w) => !/^(in|out|inout|variadic)$/i.test(w));
        // « p_x type » ou « type » seul (drop function nom(uuid, text))
        const named = words.length > 1;
        return {
          name: named ? words[0].toLowerCase() : null,
          type: (named ? words.slice(1) : words).join(' ').toLowerCase(),
          optional,
        };
      });
    const all = sigs.get(name) ?? new Map();
    if (isDrop) all.delete(typeKey(params));
    else all.set(typeKey(params), { params });
    if (all.size) sigs.set(name, all);
    else sigs.delete(name);
  }
}

// ---- Appels des Edge Functions
function* tsFiles(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* tsFiles(p);
    else if (/\.ts$/.test(f) && !/_test\.ts$/.test(f)) yield p;
  }
}

const errors = [];
let calls = 0;
for (const file of tsFiles(fnDir)) {
  const src = readFileSync(file, 'utf8');
  const re = /\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*(,\s*)?/g;
  let m;
  while ((m = re.exec(src))) {
    calls++;
    const line = src.slice(0, m.index).split('\n').length;
    const where = `${relative(root, file)}:${line}`;
    const name = m[1];
    const cands = [...(sigs.get(name)?.values() ?? [])];
    if (!cands.length) {
      errors.push(`${where} : la fonction ${name} n'existe pas (ou plus) dans les migrations`);
      continue;
    }
    let keys = [];
    if (m[2]) {
      const at = m.index + m[0].length;
      if (src[at] === '{') {
        keys = splitTop(balanced(src, at) ?? '')
          .filter(Boolean)
          .map((e) => (e.match(/^['"]?([a-z_][a-z0-9_]*)['"]?\s*(:|$)/i) ?? [])[1])
          .filter(Boolean);
      } else {
        // Objet construit ailleurs : paramètres déclarés dans un commentaire « @rpc-params a, b » au-dessus
        const prev = src.slice(0, m.index).split('\n').slice(-3).join('\n');
        const decl = prev.match(/@rpc-params\s+([a-z0-9_,\s]+)/i);
        if (!decl) {
          errors.push(`${where} : ${name} appelé sans objet littéral ni commentaire « @rpc-params »`);
          continue;
        }
        keys = decl[1].split(/[\s,]+/).filter(Boolean);
      }
    }
    const fits = (sig) => {
      const names = sig.params.map((p) => p.name);
      return (
        keys.every((k) => names.includes(k)) &&
        sig.params.every((p) => p.optional || !p.name || keys.includes(p.name))
      );
    };
    if (!cands.some(fits)) {
      const shown = cands
        .map((c) => `(${c.params.map((p) => p.name + (p.optional ? '?' : '')).join(', ')})`)
        .join(' ou ');
      errors.push(`${where} : ${name}({ ${keys.join(', ')} }) ne correspond à aucune signature : ${shown}`);
    }
  }
}

if (errors.length) {
  console.error(`Appels RPC des Edge Functions incompatibles avec les migrations (${errors.length}) :`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Appels RPC des Edge Functions : ${calls} vérifiés, tous conformes aux migrations.`);
