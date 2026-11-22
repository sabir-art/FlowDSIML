/**
 * COMP-01 §1 : choisir une option d'un Select maison (déclencheur `role="combobox"`, liste en portail).
 * `choice` : la valeur ou le libellé, ou `{ label }`, `{ value }`, `{ index }`.
 * Usage : const { pick } = require('./_select.cjs'); await pick(page.getByLabel('Statut'), 'published');
 */
async function pick(select, choice) {
  const page = select.page();
  await select.click();
  // Une seule liste peut être ouverte à la fois (elle est rendue dans le portail)
  const list = page.locator('.fd-sel-pop [role="listbox"]');
  await list.waitFor();
  const byValue = (v) => list.locator(`[role="option"][data-value=${JSON.stringify(String(v))}]`);
  const byLabel = (l) => list.getByRole('option', { name: l, exact: true });
  let option;
  if (typeof choice === 'object' && choice !== null)
    option =
      choice.index !== undefined
        ? list.locator('[role="option"]').nth(choice.index)
        : choice.label !== undefined
          ? byLabel(choice.label)
          : byValue(choice.value);
  else option = (await byValue(choice).count()) ? byValue(choice) : byLabel(String(choice));
  await option.click();
  // La liste se referme : l'état suivant de la page est celui du choix fait
  await list.waitFor({ state: 'detached' });
}

/** Valeur courante d'un Select maison (l'équivalent de `inputValue()` d'un `<select>`). */
const picked = (select) => select.evaluate((el) => el.dataset.value ?? '');

/** Libellé affiché par le déclencheur (l'équivalent de `option:checked`). */
const pickedLabel = (select) => select.locator('.fd-sel__value').innerText();

/**
 * Options d'un Select maison : la liste est ouverte, lue, puis refermée par Échap.
 * Par défaut, les libellés ; `{ disabled: true }` : seulement les options désactivées ;
 * `{ raw: true }` : `{ value, label, disabled }` pour chaque option.
 */
async function optionsOf(select, { disabled = false, raw = false } = {}) {
  const page = select.page();
  await select.click();
  // Une seule liste peut être ouverte à la fois (elle est rendue dans le portail)
  const list = page.locator('.fd-sel-pop [role="listbox"]');
  await list.waitFor();
  const all = await list.locator('[role="option"]').evaluateAll((els) =>
    els.map((el) => ({
      value: el.dataset.value ?? '',
      label: (el.querySelector('.fd-opt__label') ?? el).textContent.trim(),
      disabled: el.getAttribute('aria-disabled') === 'true',
    })),
  );
  await page.keyboard.press('Escape');
  await list.waitFor({ state: 'detached' });
  const kept = disabled ? all.filter((o) => o.disabled) : all;
  return raw ? kept : kept.map((o) => o.label);
}

module.exports = { pick, picked, pickedLabel, optionsOf };
