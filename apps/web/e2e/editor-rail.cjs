/**
 * Éditeur (L48-E) : un rail d'outils à gauche et un seul panneau ouvert. Les anciens onglets
 * (« Étape », « Design », « Réglages »…) sont devenus des outils du rail.
 * openTool(page, 'design') ouvre l'outil s'il ne l'est pas déjà (un clic sur l'outil ouvert le ferme)
 * et renvoie le panneau. Outils : step, cta, hotspots, voice, next, blur, zoom, crop, image, design,
 * comments, assistant, settings.
 */
async function openTool(page, tool) {
  // Le rail et le panneau mémorisé apparaissent au même rendu : attendre le rail avant de décider
  await page.locator('.ed-rail').waitFor();
  const panel = page.locator(`[data-tool-panel="${tool}"]`);
  if ((await panel.count()) === 0) await page.locator(`[data-tool="${tool}"]`).first().click();
  await panel.waitFor();
  return panel;
}

/** L48-E §6 : actions de la démo dans le menu « Plus d’options » de la barre (Présenter, Exporter…). */
async function fromMore(page, label) {
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

module.exports = { openTool, fromMore };
