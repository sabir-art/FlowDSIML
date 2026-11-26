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

/** L60 §1 : modes du popup (nom, phrase, nom accessible, désactivé, dernier choix). */
const modes = (popup) =>
  popup.locator('#modes .mode').evaluateAll((els) =>
    els.map((el) => ({
      mode: el.dataset.mode,
      name: el.querySelector('b')?.textContent ?? '',
      desc: el.querySelector('small')?.textContent ?? '',
      label: el.getAttribute('aria-label') ?? '',
      disabled: el.getAttribute('aria-disabled') === 'true',
      last: el.classList.contains('is-last'),
    })),
  );
/** Ouvre la vue Réglages de capture. */
async function openPrefs(popup) {
  if (await popup.locator('#settings').isHidden()) await popup.click('#open-prefs');
}

module.exports = { options, pick, isOn, setSwitch, openOptions, rows, modes, openPrefs };
