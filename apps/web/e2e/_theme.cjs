/** Thème des scripts e2e : THEME=dark produit les captures en sombre (suffixe « -sombre »). */
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const sfx = THEME === 'dark' ? '-sombre' : '';

async function themedContext(b, opts = {}) {
  const ctx = await b.newContext({ ...opts, colorScheme: THEME });
  await ctx.addInitScript((th) => {
    try {
      localStorage.setItem('fd.theme', th);
    } catch {
      /* stockage indisponible */
    }
  }, THEME);
  return ctx;
}

module.exports = { THEME, sfx, themedContext };
