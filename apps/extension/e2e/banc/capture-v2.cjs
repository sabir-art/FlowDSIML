/**
 * Sandbox v2, étape 3 (docs/tech/sandbox-v2.md §6) : capture v2 RÉELLE sur le banc. L'extension construite
 * et chargée capture chaque site d'essai en mode Sandbox (enregistreur dans le monde de la page, document
 * source, scripts, réponses), l'écran « Vérifier avant l'envoi » montre le groupe « Sandbox vivant », la
 * démo est envoyée (faux Supabase), puis chaque enregistrement vivant TEL QU'IL A ÉTÉ ENVOYÉ est relu par
 * buildLiveSrcdoc et le parcours du visiteur y est joué.
 *
 * Contrôles : groupe « Sandbox vivant » et Garder / Bloquer dans l'écran de vérification ; enregistrement
 * envoyé (marques de scripts, réponses, aucune donnée personnelle lisible) ; critères à 100 % b, c, d ;
 * fidélité d'interaction relevée (objectif 90 %).
 * Prérequis : node e2e/mock-supabase.cjs, node e2e/banc/serveur.cjs, build WXT_E2E=1.
 * Usage : node e2e/banc/capture-v2.cjs [RAPPORT=…] [SHOTS_DIR=…]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const { capturer } = require('./etat-html.cjs');
const { SITES } = require('./mesure-sandbox.cjs');
const { lire } = require('./lecture-v2.cjs');
const MOCK = 'http://localhost:54400';
const SHOTS = process.env.SHOTS_DIR;
const RAPPORT = process.env.RAPPORT;

const journal = async () => (await fetch(`${MOCK}/__log`)).json();
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 100);

/** Capture en Sandbox, vérification, envoi ; rend ce que l'extension a envoyé. */
async function envoyer(s) {
  const debut = (await journal()).length;
  let groupe = null;
  const r = await capturer(
    { ...s, gestes: s.capture },
    async (review) => {
      await review.click('#kind [data-kind="sandbox"]');
      const reg = review.getByRole('region', { name: 'Sandbox vivant', exact: true });
      groupe = { present: (await reg.count()) === 1 };
      if (groupe.present) {
        groupe.etat = (await reg.locator('.mu').first().innerText()).trim();
        await reg.getByRole('button', { name: 'Voir : Sandbox vivant' }).click();
        groupe.lignes = await reg.locator('li.el2').allInnerTexts();
        if (SHOTS)
          await review.screenshot({ path: `${SHOTS}/capture-v2-${s.id}-verification.png`, fullPage: true });
      }
      await review.click('#send');
      // Fin d'envoi : chaque étape écrite (une par page)
      const fin = Date.now() + 60000;
      while (Date.now() < fin) {
        const log = (await journal()).slice(debut);
        const pages = log.filter((l) => l.u.startsWith('/functions/v1/html-ingest') && l.html).length;
        const steps = log.filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps')).length;
        if (pages && steps >= pages) break;
        await new Promise((x) => setTimeout(x, 300));
      }
    },
    { kind: 'sandbox' },
  );
  const log = (await journal()).slice(debut);
  const lives = log.filter((l) => l.u.startsWith('/functions/v1/html-ingest') && l.live).map((l) => l.live);
  const steps = log
    .filter((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/steps') && l.body)
    .map((l) => JSON.parse(l.body));
  const demo = log.find((l) => l.m === 'POST' && l.u.startsWith('/rest/v1/demos'));
  return { capture: r, groupe, lives, steps, demo: demo ? JSON.parse(demo.body) : null };
}

async function principal() {
  require('node:module').register(
    `data:text/javascript,${encodeURIComponent(
      "export async function resolve(s, c, n) { try { return await n(s, c); } catch (e) { if (s.startsWith('.') && !/\\.\\w+$/.test(s)) return n(s + '.ts', c); throw e; } }",
    )}`,
  );
  const { buildLiveSrcdoc, mergeResponses } =
    await import('../../../../packages/player-core/src/liveFrame.ts');
  await fetch(`${MOCK}/__html-capture`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'allowed', domains: [] }),
  });
  await fetch(`${MOCK}/__sandbox-live`, { method: 'POST', body: 'true' });
  const b = await chromium.launch();
  const rapport = [];
  for (const s of SITES) {
    const e = await envoyer(s);
    const envoyees = e.lives.map((l) => ({
      url: l.url,
      html: l.html,
      scripts: l.scripts,
      responses: l.responses,
    }));
    // Comme le lecteur : réponses de la page, puis celles des autres pages de la démo
    const pages = envoyees.map((p) => ({ ...p, responses: mergeResponses(p, envoyees) }));
    const r = pages.length
      ? await lire(b, s, pages, buildLiveSrcdoc, { suffixe: '-capture' })
      : { res: [], total: { replayed: 0, unreplayed: 0, writes: 0 }, sorties: [], temoin: true, erreurs: [] };
    const envoyes = JSON.stringify(e.lives);
    rapport.push({
      site: s.id,
      nom: s.nom,
      erreurCapture: e.capture.erreur,
      groupe: e.groupe,
      pages: e.capture.pages.length,
      vivantes: pages.length,
      stepsVivantes: e.steps.filter((x) => x.html_live_path && x.html_meta?.live).length,
      demoLive: e.demo?.sandbox?.live === true,
      scripts: pages.flatMap((p) => p.scripts.map((x) => `${x.category}:${x.keep ? 'gardé' : 'bloqué'}`)),
      reponses: envoyees.reduce((n, p) => n + p.responses.length, 0),
      marques: pages.every((p) => p.scripts.every((x) => p.html.includes(`data-fd-script="${x.id}"`))),
      // Données personnelles saisies ou affichées pendant la capture : jamais lisibles dans l'envoi
      fuites: ['Camille Durand'].filter((t) => s.id === 'formulaire' && envoyes.includes(t)),
      interaction: {
        reussis: r.res.filter(Boolean).length,
        gestes: s.parcours.length,
        detail: s.parcours.map((g, i) => ({ geste: g.nom, reprise: r.res[i] ?? false })),
      },
      lecture: r.total,
      sorties: r.sorties,
      temoin: r.temoin,
      erreurs: r.erreurs,
    });
    const x = rapport[rapport.length - 1];
    console.error(
      `${s.id} : ${x.vivantes}/${x.pages} pages vivantes, groupe ${x.groupe?.present ? x.groupe.etat : 'absent'}, scripts ${x.scripts.join(' ')}, réponses ${x.reponses}, interaction ${x.interaction.reussis}/${x.interaction.gestes}, écritures fictives ${r.total.writes}, sorties ${r.sorties.length}${x.erreurCapture ? `, capture : ${x.erreurCapture}` : ''}${r.erreurs.length ? `, erreurs : ${r.erreurs.join(' | ').slice(0, 300)}` : ''}`,
    );
  }
  await b.close();
  const tot = (f) => rapport.reduce((a, x) => a + f(x), 0);
  const total = {
    interaction: pct(
      tot((x) => x.interaction.reussis),
      tot((x) => x.interaction.gestes),
    ),
    sorties: tot((x) => x.sorties.length),
  };
  console.log(JSON.stringify({ total, sites: rapport }, null, 2));
  const tiers = rapport.find((x) => x.site === 'tiers');
  const formulaire = rapport.find((x) => x.site === 'formulaire');
  const criteres = [
    ['Chaque site est capturé sans erreur', rapport.every((x) => !x.erreurCapture)],
    [
      'Chaque page capturée a son enregistrement vivant, envoyé et rattaché à son étape ; démo « live »',
      rapport.every((x) => x.vivantes === x.pages && x.stepsVivantes === x.pages && x.demoLive),
    ],
    ['« Sandbox vivant » dans l’écran de vérification', rapport.every((x) => x.groupe?.present)],
    ['Scripts à leur place (marques) dans chaque enregistrement', rapport.every((x) => x.marques)],
    [
      'b) Scripts d’un autre site bloqués par défaut (fiche envoyée, rétablissable), ceux de la page gardés',
      tiers.scripts.filter((x) => x === 'third:bloqué').length >= 2 && tiers.scripts.includes('page:gardé'),
    ],
    [
      'c) Aucune sortie réseau depuis la lecture (témoin vérifié)',
      total.sorties === 0 && rapport.every((x) => x.temoin),
    ],
    [
      'd) L’envoi du formulaire reçoit un succès fictif, la page avance',
      formulaire.lecture.writes >= 1 && formulaire.interaction.detail[1].reprise,
    ],
    ['Aucune donnée personnelle saisie lisible dans l’envoi', rapport.every((x) => !x.fuites.length)],
  ];
  for (const [nom, ok] of criteres) {
    console.error(`${ok ? 'ok' : 'NOT OK'} - ${nom}`);
    if (!ok) process.exitCode = 1;
  }
  console.error(`Fidélité d’interaction (capture v2 réelle) : ${total.interaction} % (objectif 90 %)`);
  if (RAPPORT) {
    const l = [
      '| Site d’essai | Pages vivantes | Scripts | Réponses | Interaction | Écritures fictives | Sorties |',
      '|---|---|---|---|---|---|---|',
    ];
    for (const x of rapport)
      l.push(
        `| ${x.nom} | ${x.vivantes}/${x.pages} | ${x.scripts.join(', ') || '–'} | ${x.reponses} | ${x.interaction.reussis}/${x.interaction.gestes} | ${x.lecture.writes} | ${x.sorties.length} |`,
      );
    l.push(`| **Total** | | | | **${total.interaction} %** | | **${total.sorties}** |`, '', '### Gestes', '');
    for (const x of rapport)
      l.push(
        `- **${x.nom}** : ${x.interaction.detail.map((d) => `${d.reprise ? '✓' : '✗'} ${d.geste}`).join(' · ')}`,
      );
    l.push('', '### Critères', '');
    for (const [nom, ok] of criteres) l.push(`- ${ok ? '✓' : '✗'} ${nom}`);
    fs.writeFileSync(RAPPORT, `${l.join('\n')}\n`);
  }
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
