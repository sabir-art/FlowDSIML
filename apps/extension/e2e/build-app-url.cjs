/**
 * Garde des e2e qui ouvrent l'éditeur après l'envoi (capture, video, guided, html) : l'extension doit être
 * construite avec WXT_APP_URL=http://localhost:54400 (le faux serveur). Sinon l'éditeur s'ouvre sur
 * l'adresse par défaut de l'app (localhost:5173), souvent fermée : l'onglet tombe sur une page d'erreur
 * et « après envoi : ouverture de l'éditeur » échoue sans dire pourquoi. Ici, l'échec est immédiat et clair.
 */
const fs = require('fs');
const path = require('path');

module.exports = function checkAppUrl() {
  const out = path.resolve(__dirname, '../.output/chrome-mv3');
  const files = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (p.endsWith('.js')) files.push(p);
    }
  };
  walk(out);
  if (files.some((f) => fs.readFileSync(f, 'utf8').includes('"http://localhost:5173"'))) {
    console.log(
      'NOT OK - extension construite sans WXT_APP_URL=http://localhost:54400 : reconstruire avec ' +
        'WXT_E2E=1 WXT_DEBUGGER=1 WXT_SUPABASE_URL=http://localhost:54400 WXT_SUPABASE_ANON_KEY=anon ' +
        'WXT_APP_URL=http://localhost:54400 pnpm build',
    );
    process.exit(1);
  }
};
