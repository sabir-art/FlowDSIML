import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = new URL('./check-workflows.mjs', import.meta.url).pathname;
const run = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
};
const ok = `name: ci
on: push
jobs:
  t:
    runs-on: ubuntu-24.04
    steps:
      - name: 'Guide (lecteur : bulle)'
        run: echo ok
`;

test('workflow valide : succès', () => {
  const r = run({ 'ci.yml': ok });
  assert.equal(r.status, 0, r.stderr);
});

test('« : » non protégé dans un nom d’étape : échec, fichier nommé', () => {
  const r = run({
    'a.yml': ok,
    'ci.yml': ok.replace("'Guide (lecteur : bulle)'", 'Guide (lecteur : bulle)'),
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Workflow invalide : .*ci\.yml/);
});

test('workflow sans tâche : échec', () => {
  const r = run({ 'ci.yml': 'name: ci\non: push\n' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /« on » et « jobs »/);
});
