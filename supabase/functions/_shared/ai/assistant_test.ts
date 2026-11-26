// L41 étape 4 : menu de l'assistant, Auto, repli, contrôle du modèle demandé ; actions de la Console.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  DEFAULT_RULES,
  autoPick,
  fallbackOf,
  replacementOf,
  kindOf,
  menuOf,
  requested,
  type AssistantRow,
} from './assistant.ts';
import { consoleAction, type ConsoleDeps } from './console.ts';

const ROWS: AssistantRow[] = [
  { model: 'claude-sonnet-5-5', position: 1, proposed: true, tag: 'recommended' },
  { model: 'claude-opus-5-5', position: 2, proposed: true, tag: 'recommended' },
  { model: 'claude-haiku-5-5', position: 3, proposed: false, tag: 'none' },
];
const ALL = new Set(['anthropic', 'openai', 'elevenlabs'] as const);

Deno.test('menu : proposés, utilisables, dans l’ordre, avec leur étiquette', () => {
  assertEquals(menuOf(ROWS, ALL), [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet', tag: 'recommended', speed: 2, cost: 2 },
    { id: 'claude-opus-5-5', label: 'Claude Opus', tag: 'recommended', speed: 3, cost: 3 },
  ]);
  // Fournisseur sans clé : rien ; modèle inconnu du catalogue : ignoré
  assertEquals(menuOf(ROWS, new Set(['elevenlabs'] as const)), []);
  assertEquals(
    menuOf([...ROWS, { model: 'claude-ancien-4', position: 0, proposed: true, tag: 'beta' }], ALL).length,
    2,
  );
});

Deno.test('Auto : demande courte ou analyse de toute la démo ; repli', () => {
  assertEquals(kindOf('Rends ce titre plus court'), 'short');
  assertEquals(kindOf('Vérifie la cohérence de toute la démo'), 'whole_demo');
  assertEquals(kindOf('x'.repeat(401)), 'whole_demo');
  const menu = menuOf(ROWS, ALL);
  const rules = { ...DEFAULT_RULES, whole_demo: 'claude-opus-5-5' };
  assertEquals(autoPick(rules, menu, 'Raccourcis cette bulle'), 'claude-sonnet-5-5');
  assertEquals(autoPick(rules, menu, 'Analyse toutes les étapes'), 'claude-opus-5-5');
  // Règle hors du menu : le premier Recommandé (ici Sonnet) ; menu vide : aucun
  assertEquals(autoPick({ ...rules, short: 'claude-haiku-5-5' }, menu, 'court'), 'claude-sonnet-5-5');
  assertEquals(autoPick(rules, [], 'court'), null);
  assertEquals(fallbackOf(DEFAULT_RULES, menu, 'claude-sonnet-5-5'), 'claude-opus-5-5');
  assertEquals(fallbackOf(DEFAULT_RULES, menu, 'claude-opus-5-5'), 'claude-sonnet-5-5');
  assertEquals(fallbackOf({ ...DEFAULT_RULES, fallback: 'claude-opus-5-5' }, menu, 'claude-opus-5-5'), null);
});

Deno.test(
  'règle dont le modèle n’est plus proposé : premier Recommandé du menu, jamais un Bêta avant',
  () => {
    // Menu : Haiku (Bêta) en tête, puis Opus (Recommandé) ; Sonnet n'est plus proposé
    const menu = menuOf(
      [
        { model: 'claude-haiku-5-5', position: 1, proposed: true, tag: 'beta' },
        { model: 'claude-opus-5-5', position: 2, proposed: true, tag: 'recommended' },
        { model: 'claude-sonnet-5-5', position: 3, proposed: false, tag: 'recommended' },
      ],
      ALL,
    );
    assertEquals(replacementOf(menu), 'claude-opus-5-5');
    assertEquals(autoPick(DEFAULT_RULES, menu, 'Raccourcis cette bulle'), 'claude-opus-5-5');
    assertEquals(autoPick(DEFAULT_RULES, menu, 'Analyse toute la démo'), 'claude-opus-5-5');
    // Aucun Recommandé : le premier du menu
    const plain = menu.map((m) => ({ ...m, tag: 'none' as const }));
    assertEquals(autoPick(DEFAULT_RULES, plain, 'court'), 'claude-haiku-5-5');
    // Repli sur un modèle non proposé : le remplaçant, autre que le modèle qui vient d'échouer
    const fb = { ...DEFAULT_RULES, fallback: 'claude-sonnet-5-5' };
    assertEquals(fallbackOf(fb, menu, 'claude-haiku-5-5'), 'claude-opus-5-5');
    assertEquals(fallbackOf(fb, menu, 'claude-opus-5-5'), 'claude-haiku-5-5');
  },
);

Deno.test('modèle demandé : Auto, modèle du menu, anciens choix ; sinon refusé', () => {
  const menu = menuOf(ROWS, ALL);
  assertEquals(requested('auto', menu), { auto: true });
  assertEquals(requested('claude-opus-5-5', menu), { auto: false, model: 'claude-opus-5-5' });
  assertEquals(requested('opus', menu), { auto: false, model: 'claude-opus-5-5' });
  assertEquals(requested('claude-haiku-5-5', menu), null);
  assertEquals(requested('gpt-5', menu), null);
});

function deps(admin = true) {
  let rows = ROWS.map((r) => ({ ...r }));
  const rules = { ...DEFAULT_RULES };
  const labels: string[] = [];
  const d: ConsoleDeps = {
    role: () => Promise.resolve({ uid: 'u1', admin }),
    vault: () => Promise.resolve(null),
    rows: () => Promise.resolve([]),
    save: () => Promise.resolve({ replaced: false }),
    tested: () => Promise.resolve(),
    test: () => Promise.resolve({ ok: true, ms: 1 }),
    env: (n) => (n === 'ANTHROPIC_API_KEY' ? 'sk-fictive-assistant-01' : undefined),
    fnModels: () => Promise.resolve({}),
    setModel: () => Promise.resolve({ old: null }),
    setCut: () => Promise.resolve(),
    assistantRows: () => Promise.resolve(rows),
    autoRules: () => Promise.resolve(rules),
    setAssistant: (r, _u, label) => {
      rows = r;
      labels.push(label);
      return Promise.resolve();
    },
    setRule: (rule, model, _u, label) => {
      const old = rules[rule];
      rules[rule] = model;
      labels.push(label);
      return Promise.resolve({ old });
    },
  };
  return {
    d,
    labels,
    get rows() {
      return rows;
    },
    rules,
  };
}

Deno.test('console_assistant : liste, règles et aperçu du menu', async () => {
  const x = deps();
  const r = (await consoleAction({ action: 'console_assistant' }, x.d)).body.result as Record<
    string,
    unknown
  >;
  const models = r.models as Array<{ model: string; available: boolean; label: string }>;
  assertEquals(
    models.map((m) => m.model),
    ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
  );
  assert(models.every((m) => m.available));
  assertEquals(
    (r.menu as Array<{ id: string }>).map((m) => m.id),
    ['claude-sonnet-5-5', 'claude-opus-5-5'],
  );
  assert(!JSON.stringify(r).includes('sk-fictive'));
});

Deno.test(
  'console_assistant_set : ordre, cases, étiquettes ; au moins un modèle ; journal lisible',
  async () => {
    const x = deps();
    const set = (models: unknown) => consoleAction({ action: 'console_assistant_set', models }, x.d);
    const ok = await set([
      { model: 'claude-opus-5-5', proposed: true, tag: 'recommended' },
      { model: 'claude-haiku-5-5', proposed: true, tag: 'beta' },
      { model: 'claude-sonnet-5-5', proposed: false, tag: 'none' },
    ]);
    assertEquals(ok.status, 200);
    assertEquals(
      x.rows.map((r) => `${r.position}:${r.model}:${r.proposed}`),
      ['1:claude-opus-5-5:true', '2:claude-haiku-5-5:true', '3:claude-sonnet-5-5:false'],
    );
    assertEquals(
      x.labels.at(-1),
      'Liste de l’assistant · Claude Haiku : proposé ; Claude Haiku : étiquette Bêta ; ' +
        'Claude Sonnet : retiré ; Claude Sonnet : sans étiquette',
    );
    // Ordre seul, puis étiquette seule : le journal les distingue
    await set([
      { model: 'claude-haiku-5-5', proposed: true, tag: 'beta' },
      { model: 'claude-opus-5-5', proposed: true, tag: 'recommended' },
      { model: 'claude-sonnet-5-5', proposed: false, tag: 'none' },
    ]);
    assertEquals(x.labels.at(-1), 'Liste de l’assistant · Ordre : Claude Haiku, Claude Opus');
    await set([
      { model: 'claude-haiku-5-5', proposed: true, tag: 'recommended' },
      { model: 'claude-opus-5-5', proposed: true, tag: 'recommended' },
      { model: 'claude-sonnet-5-5', proposed: false, tag: 'none' },
    ]);
    assertEquals(x.labels.at(-1), 'Liste de l’assistant · Claude Haiku : étiquette Recommandé');
    const last = await set([{ model: 'claude-opus-5-5', proposed: false, tag: 'none' }]);
    assertEquals([last.status, last.body.error], [409, 'LAST_MODEL']);
    assertEquals((await set([{ model: 'gpt-5', proposed: true, tag: 'none' }])).body.error, 'BAD_LIST');
    const ro = deps(false);
    assertEquals((await consoleAction({ action: 'console_assistant_set', models: [] }, ro.d)).status, 403);
  },
);

Deno.test(
  'console_auto_rule_set : règle changée, « le suivant » pour le repli, journal lisible',
  async () => {
    const x = deps();
    const r = await consoleAction(
      { action: 'console_auto_rule_set', rule: 'whole_demo', model: 'claude-opus-5-5' },
      x.d,
    );
    assertEquals([r.status, (r.body.result as Record<string, unknown>).old], [200, 'claude-sonnet-5-5']);
    assertEquals(x.labels.at(-1), 'Auto · analyse de toute la démo · Claude Sonnet → Claude Opus');
    assertEquals(
      (await consoleAction({ action: 'console_auto_rule_set', rule: 'short', model: 'next' }, x.d)).body
        .error,
      'BAD_MODEL',
    );
    const fb = await consoleAction(
      { action: 'console_auto_rule_set', rule: 'fallback', model: 'claude-haiku-5-5' },
      x.d,
    );
    assertEquals(fb.status, 200);
    assertEquals(x.labels.at(-1), 'Auto · modèle indisponible · le suivant de la liste → Claude Haiku');
  },
);
