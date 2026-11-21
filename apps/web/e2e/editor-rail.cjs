/**
 * Éditeur (L48-E) : un rail d'outils à gauche et un seul panneau ouvert. Les anciens onglets
 * (« Étape », « Design », « Réglages »…) sont devenus des outils du rail.
 * openTool(page, 'design') ouvre l'outil s'il ne l'est pas déjà (un clic sur l'outil ouvert le ferme)
 * et renvoie le panneau. Outils : step, cta, hotspots, voice, next, blur, zoom, crop, image, design,
 * comments, assistant, settings.
 */
async function openTool(page, tool, timeout = 15000) {
  // L'état réel est aria-pressed du bouton du rail. Le panneau mémorisé peut s'ouvrir après le
  // premier rendu, ce qui fermerait l'outil si l'on cliquait trop tôt. On ne clique donc que si
  // l'outil n'est pas actif, et au plus une fois par seconde, jusqu'à ce que son panneau soit visible.
  await page.waitForFunction(
    (id) => {
      const panel = document.querySelector(`[data-tool-panel="${id}"]`);
      if (panel && panel.getClientRects().length > 0) return true;
      const btn = document.querySelector(`.ed-rail button[data-tool="${id}"]`);
      if (!btn || btn.getAttribute('aria-pressed') === 'true') return false;
      const last = Number(btn.dataset.e2eClick || 0);
      if (Date.now() - last > 1000) {
        btn.dataset.e2eClick = String(Date.now());
        btn.click();
      }
      return false;
    },
    tool,
    { timeout, polling: 100 },
  );
  return page.locator(`[data-tool-panel="${tool}"]`);
}

/** L48-E §6 : actions de la démo dans le menu « Plus d’options » de la barre (Présenter, Exporter…). */
async function fromMore(page, label) {
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

module.exports = { openTool, fromMore };
