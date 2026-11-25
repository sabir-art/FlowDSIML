/** Gestes sur le popup (EXT-02 §1.2) : listes déroulantes, interrupteurs et section « Options ». */
const list = (popup, id) => popup.locator(`#${id} + [role=listbox]`);

/** Options d'une liste : valeur, nom, description, désactivée ou non. */
async function options(popup, id) {
  if (await list(popup, id).isHidden()) await popup.click(`#${id}`);
  const out = await list(popup, id)
    .locator('[role=option]')
    .evaluateAll((els) =>
      els.map((el) => ({
        value: el.dataset.value,
        label: el.querySelector('b')?.textContent ?? '',
        desc: el.querySelector('small')?.textContent ?? '',
        disabled: el.getAttribute('aria-disabled') === 'true',
      })),
    );
  await popup.keyboard.press('Escape');
  return out;
}
async function pick(popup, id, value) {
  if (await list(popup, id).isHidden()) await popup.click(`#${id}`);
  await list(popup, id).locator(`[data-value="${value}"]`).click();
}
const isOn = async (popup, id) => (await popup.getAttribute(`#${id}`, 'aria-checked')) === 'true';
async function setSwitch(popup, id, on) {
  if ((await isOn(popup, id)) !== on) await popup.click(`#${id}`);
}
async function openOptions(popup) {
  if ((await popup.getAttribute('#opts-toggle', 'aria-expanded')) !== 'true')
    await popup.click('#opts-toggle');
}
/** Lignes d'options visibles (libellés). */
const rows = async (popup) =>
  (await popup.locator('#opts-body .rw:not([hidden]) .k').allInnerTexts()).map((t) => t.trim());

module.exports = { options, pick, isOn, setSwitch, openOptions, rows };
