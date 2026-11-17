/** Test e2e : la liste des commentaires s'ouvre sur le premier non lu (pilule « n plus anciens ↑ »). */
const { chromium } = require('playwright');
const { install, seed } = require('./fake-supabase.cjs');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = '0b5c1f0e-0000-4000-8000-000000000001';

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, l) => {
    console.log(`${c ? 'ok' : 'NOT OK'} - ${l}`);
    if (!c) process.exitCode = 1;
  };
  const state = seed();
  state.extraMembers = [{ user_id: 'u-bob', email: 'bob@example.test', full_name: 'Bob', role: 'editor' }];
  const at = (min) => new Date(Date.UTC(2026, 10, 17, 9, min)).toISOString();
  state.tables.step_comments = Array.from({ length: 10 }, (_, i) => ({
    id: `c${i}`,
    step_id: 's1',
    demo_id: DEMO,
    workspace_id: 'ws-1',
    author_id: 'u-bob',
    body: `Remarque ${i + 1}`,
    created_at: at(i),
    updated_at: at(i),
    resolved_at: null,
    resolved_by: null,
  }));
  // Lu jusqu'à la remarque 7 : les remarques 8 à 10 sont non lues
  await page.addInitScript(
    (seenAt) => {
      localStorage.setItem('fd.editor.comments.seen', JSON.stringify({ s1: seenAt }));
    },
    at(6) + '',
  );
  await install(page, state);
  await page.goto(`${APP}/#/demos/${DEMO}/edit`);
  await page.waitForSelector('[data-comment="c7"]');
  await page.waitForTimeout(300);
  const list = page.locator('.cm-list');
  const top = await list.evaluate((el) => el.scrollTop);
  const firstUnread = await page.locator('[data-comment="c7"]').evaluate((el) => el.offsetTop);
  ok(top > 0 && Math.abs(top - (firstUnread - 8)) < 4, 'liste ouverte sur le premier non lu (remarque 8)');
  ok((await page.locator('.cm-item--new').count()) === 3, 'les 3 non lus sont marqués « Nouveau »');
  const pill = page.locator('.cm-older');
  ok(
    (await pill.textContent()).includes('7 commentaires plus anciens'),
    'pilule « 7 commentaires plus anciens ↑ »',
  );
  if (process.env.SHOTS_DIR)
    await page.screenshot({ path: `${process.env.SHOTS_DIR}/cm-premier-non-lu.png` });
  await pill.click();
  await page.waitForTimeout(600);
  ok(
    (await list.evaluate((el) => el.scrollTop)) < 8 && (await pill.count()) === 0,
    'la pilule remonte en haut puis disparaît',
  );
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('fd.editor.comments.seen')).s1);
  ok(Date.parse(seen) > Date.parse(state.tables.step_comments[9].created_at), 'étape marquée comme lue');
  ok(errors.length === 0, `aucune erreur JS (${errors.join(' | ')})`);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
