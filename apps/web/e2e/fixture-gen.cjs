/**
 * Régénère fixture.png (capture fictive « ExampleCRM », 1100 × 750) : données inventées, domaine
 * .example uniquement. Usage : node e2e/fixture-gen.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;width:1100px;height:750px;font-family:Inter,"Helvetica Neue",Arial,sans-serif;background:#f3f4f9;color:#0f172a}
  header{height:56px;background:#1f2a3c;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 24px}
  header b{font-size:16px}header span{font-size:16px}
  aside{position:absolute;top:56px;left:0;bottom:0;width:241px;background:#fff;border-right:1px solid #e2e5ee;padding:20px 20px}
  aside div{font-size:16px;color:#334155;margin:0 0 20px}
  main{position:absolute;top:56px;left:241px;right:0;padding:32px 32px}
  h1{margin:0 0 20px;font-size:32px}
  .cards{display:flex;gap:16px}.card{flex:1;height:94px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(15,23,42,.06)}
  .card b{display:block;font-size:16px}.card span{display:block;margin-top:6px;font-size:28px;color:#4f46e5}
  button{margin-top:28px;height:42px;padding:0 22px;border:0;border-radius:6px;background:#4f46e5;color:#fff;font-size:16px;font-family:inherit}
</style></head><body>
<header><b>ExampleCRM</b><span>alice@acme.example</span></header>
<aside><div>Tableau de bord</div><div>Contacts</div><div>Opportunités</div><div>Rapports</div><div>Paramètres</div></aside>
<main><h1>Opportunités</h1><div class="cards"><div class="card"><b>Prospection</b><span>12</span></div><div class="card"><b>Négociation</b><span>5</span></div><div class="card"><b>Gagné</b><span>8</span></div></div>
<button>+ Nouvelle opportunité</button></main></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
  await p.setContent(html);
  await p.screenshot({ path: path.join(__dirname, 'fixture.png') });
  await b.close();
})();
