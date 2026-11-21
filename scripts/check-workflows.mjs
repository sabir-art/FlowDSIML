#!/usr/bin/env node
/**
 * Charge chaque workflow GitHub Actions (.github/workflows/*.yml|*.yaml) et échoue au premier fichier
 * invalide. Par exemple, un « : » non protégé dans un nom d'étape rend tout le workflow illisible
 * (ci.yml cassé deux fois). Lancé par `pnpm lint` et par la CI, avant les autres contrôles.
 * Usage : node scripts/check-workflows.mjs [dossier]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const dir = process.argv[2] ?? '.github/workflows';
const files = readdirSync(dir)
  .filter((f) => /\.ya?ml$/.test(f))
  .sort();
if (!files.length) {
  console.error(`Aucun workflow dans ${dir}`);
  process.exit(1);
}
for (const f of files) {
  const path = join(dir, f);
  let doc;
  try {
    doc = yaml.load(readFileSync(path, 'utf8'), { filename: path });
  } catch (e) {
    console.error(`Workflow invalide : ${path}\n${e.message}`);
    process.exit(1);
  }
  // Un workflow chargé mais sans déclencheur ni tâche n'est pas exécutable non plus
  if (!doc || typeof doc !== 'object' || !('on' in doc) || !doc.jobs || typeof doc.jobs !== 'object') {
    console.error(`Workflow invalide : ${path} (clés « on » et « jobs » attendues)`);
    process.exit(1);
  }
  for (const [id, job] of Object.entries(doc.jobs)) {
    if (!job || typeof job !== 'object' || (!Array.isArray(job.steps) && !job.uses)) {
      console.error(`Workflow invalide : ${path}, tâche « ${id} » sans étapes`);
      process.exit(1);
    }
    for (const [i, st] of (job.steps ?? []).entries())
      if (
        !st ||
        typeof st !== 'object' ||
        Array.isArray(st) ||
        (st.name != null && typeof st.name !== 'string')
      ) {
        console.error(`Workflow invalide : ${path}, tâche « ${id} », étape ${i + 1}`);
        process.exit(1);
      }
  }
}
console.log(`${files.length} workflows valides`);
