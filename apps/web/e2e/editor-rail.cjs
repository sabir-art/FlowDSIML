/**
 * Éditeur (L48-E) : un rail d'outils à gauche et un seul panneau ouvert. Les anciens onglets
 * (« Étape », « Design », « Réglages »…) sont devenus des outils du rail.
 * openTool(page, 'design') ouvre l'outil s'il ne l'est pas déjà (un clic sur l'outil ouvert le ferme)
 * et renvoie le panneau. Outils : step, cta, hotspots, voice, next, blur, zoom, crop, image, design,
 * comments, assistant, settings.
 */
async function openTool(page, tool) {
  const panel = page.locator(`[data-tool-panel="${tool}"]`);
  if ((await panel.count()) === 0) await page.locator(`[data-tool="${tool}"]`).first().click();
  await panel.waitFor();
  return panel;
}

module.exports = { openTool };
