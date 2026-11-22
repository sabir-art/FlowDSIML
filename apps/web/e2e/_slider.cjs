/**
 * COMP-01 §6 : régler un curseur maison (`role="slider"`) au clavier, comme le ferait une personne :
 * Début, puis Flèche droite jusqu'à la valeur voulue.
 * Usage : const { slide } = require('./_slider.cjs'); await slide(page.locator('#qz-th'), 80);
 */
async function slide(slider, value) {
  const page = slider.page();
  const now = async () => Number(await slider.getAttribute('aria-valuenow'));
  await slider.focus();
  await page.keyboard.press('Home');
  for (let guard = 0; (await now()) < value && guard < 500; guard++) await page.keyboard.press('ArrowRight');
  if ((await now()) !== value) throw new Error(`Curseur : ${await now()} au lieu de ${value}`);
}

module.exports = { slide };
