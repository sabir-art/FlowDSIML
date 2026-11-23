// Faux Supabase minimal : enregistre les requêtes et répond juste assez pour l'extension.
const http = require('http');
const log = [];
let htmlCapture = { mode: 'allowed', domains: [] };
let tusOffset = 0;
const user = {
  id: '00000000-0000-0000-0000-0000000000aa',
  email: 'a@b.c',
  aud: 'authenticated',
  role: 'authenticated',
};
const session = {
  access_token: 'tok',
  refresh_token: 'ref',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};
http
  .createServer((req, res) => {
    let body = [];
    req.on('data', (c) => body.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(body);
      log.push({
        m: req.method,
        u: req.url,
        len: buf.length,
        ct: req.headers['content-type'],
        body: req.headers['content-type']?.includes('json') ? buf.toString() : undefined,
      });
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
        'content-type': 'application/json',
      };
      if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
      const send = (code, obj) => res.writeHead(code, cors).end(JSON.stringify(obj));
      if (req.url === '/__log') return send(200, log);
      // L49 : réglage « Captures HTML » de l'espace, modifiable par le test
      if (req.url === '/__html-capture') {
        htmlCapture = JSON.parse(buf.toString() || '{}');
        return send(200, htmlCapture);
      }
      if (req.url.startsWith('/rest/v1/workspaces') && req.method === 'GET')
        return send(200, { settings: { htmlCapture } });
      if (req.url.startsWith('/auth/v1/token')) return send(200, session);
      if (req.url.startsWith('/auth/v1/user')) return send(200, user);
      if (req.url.startsWith('/rest/v1/members'))
        return send(200, [
          { role: 'owner', workspaces: { id: '11111111-1111-1111-1111-111111111111', name: 'Acme' } },
        ]);
      // L26-04 : étapes « À capturer » d'une démo créée depuis un modèle (capture guidée)
      if (req.url.startsWith('/rest/v1/steps') && req.method === 'GET') {
        if (req.url.includes('to_capture=eq.true') && req.url.includes('demos'))
          return send(200, [
            {
              id: 's-a',
              title: 'Se connecter',
              position: 0,
              demo_id: '33333333-3333-3333-3333-333333333333',
              demos: { title: 'Prise en main' },
            },
            {
              id: 's-b',
              title: 'Repérer le menu',
              position: 1,
              demo_id: '33333333-3333-3333-3333-333333333333',
              demos: { title: 'Prise en main' },
            },
          ]);
        if (req.url.includes('to_capture=eq.true'))
          return send(200, [
            { id: 's-a', options: {} },
            { id: 's-b', options: { animation: { type: 'typing', text: 'x' } } },
          ]);
        return send(200, [{ position: 7 }]);
      }
      if (req.url.startsWith('/rest/v1/hotspots') && req.method === 'GET') return send(200, [{ id: 'h-1' }]);
      if (req.url.startsWith('/rest/v1/demos'))
        return send(201, { id: '22222222-2222-2222-2222-222222222222' });
      // F7 : envoi par reprise (protocole TUS) de la vidéo
      if (req.url.startsWith('/storage/v1/upload/resumable')) {
        const tus = {
          ...cors,
          'tus-resumable': '1.0.0',
          'access-control-expose-headers': 'Location, Upload-Offset, Upload-Length, Tus-Resumable',
        };
        const meta = Object.fromEntries(
          String(req.headers['upload-metadata'] ?? '')
            .split(',')
            .filter(Boolean)
            .map((kv) => {
              const [k, v] = kv.trim().split(' ');
              return [k, v ? Buffer.from(v, 'base64').toString() : ''];
            }),
        );
        log[log.length - 1].tus = {
          meta,
          length: req.headers['upload-length'],
          auth: !!req.headers.authorization,
        };
        if (req.method === 'POST') {
          tusOffset = buf.length;
          return res
            .writeHead(201, {
              ...tus,
              location: 'http://localhost:54400/storage/v1/upload/resumable/up1',
              'upload-offset': String(tusOffset),
            })
            .end();
        }
        if (req.method === 'PATCH') {
          tusOffset += buf.length;
          return res.writeHead(204, { ...tus, 'upload-offset': String(tusOffset) }).end();
        }
        if (req.method === 'HEAD')
          return res
            .writeHead(200, { ...tus, 'upload-offset': String(tusOffset), 'cache-control': 'no-store' })
            .end();
      }
      if (req.url.startsWith('/storage/v1/object/')) {
        if (process.env.MOCK_DUMP) require('fs').writeFileSync(process.env.MOCK_DUMP, buf);
        return send(200, { Key: req.url, Id: 'x' });
      }
      if (req.url.startsWith('/rest/v1/')) return send(201, null);
      // A8 : application à page unique fictive (routeur côté client, sans rechargement), riche en scripts :
      // scripts en ligne, script de suivi externe, cadre intégré, menu déroulant. Données inventées.
      if (req.url.startsWith('/spa-suivi.js')) {
        res.writeHead(200, { 'content-type': 'text/javascript' });
        return res.end('window.__suivi = (window.__suivi || 0) + 1;');
      }
      if (req.url.startsWith('/spa-cadre')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<html><body><p>Cadre intégré fictif</p></body></html>');
      }
      if (req.url.startsWith('/spa')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        const inline = Array.from({ length: 24 }, (_, i) => `<script>window.__m${i} = ${i};</script>`).join(
          '',
        );
        return res.end(
          '<html><head><meta charset="utf-8"><title>Appli fictive</title>' +
            '<style>body{font-family:sans-serif;margin:0}nav{display:flex;gap:12px;padding:12px;background:#eef}' +
            '#liste{position:absolute;background:#fff;border:1px solid #ccd;padding:8px}main{padding:24px}</style>' +
            inline +
            '<script src="/spa-suivi.js"></script></head><body>' +
            '<nav id="nav"><a href="/spa" data-route>Accueil</a><a href="/spa/clients" data-route>Clients</a>' +
            '<button id="plus" type="button" aria-expanded="false">Plus</button></nav>' +
            '<div id="liste" hidden><a href="/spa/rapports" data-route>Rapports</a></div>' +
            '<main id="vue"></main><iframe src="/spa-cadre" title="Cadre fictif" width="200" height="60"></iframe>' +
            '<script>(function(){' +
            'var vues={"/spa":"<h1>Accueil</h1><p>Bienvenue dans l’appli fictive.</p>",' +
            '"/spa/clients":"<h1>Clients</h1><ul><li>Société Exemple</li><li>Mairie de Testville</li></ul>",' +
            '"/spa/rapports":"<h1>Rapports</h1><p>Rapport mensuel fictif.</p>"};' +
            'function rendre(){var v=document.getElementById("vue");v.innerHTML="<p>Chargement…</p>";' +
            // Rendu en deux temps, comme une appli qui attend ses données
            'setTimeout(function(){v.innerHTML=vues[location.pathname]||"<h1>Introuvable</h1>";},250);}' +
            'document.addEventListener("click",function(e){var a=e.target.closest("a[data-route]");if(!a)return;' +
            'e.preventDefault();history.pushState({}, "", a.getAttribute("href"));' +
            'document.getElementById("liste").hidden=true;rendre();});' +
            'document.getElementById("plus").addEventListener("click",function(){var l=document.getElementById("liste");' +
            'l.hidden=!l.hidden;this.setAttribute("aria-expanded",String(!l.hidden));});' +
            'window.addEventListener("popstate",rendre);rendre();})();</script></body></html>',
        );
      }
      // A8 : seconde page (script, gestionnaire, mot de passe rempli, données fictives) et ingestion
      if (req.url.startsWith('/page2')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Agenda</title><link rel="stylesheet" href="/style.css"><script>window.__x=1</script></head>' +
            '<body><nav id="menu"><a href="/page">Accueil</a><a href="/page2">Agenda</a></nav><h1 class="titre">Agenda</h1>' +
            '<button onclick="alert(1)">Valider</button><p>Conseillère : Camille MARTIN</p><p>Tél. 06 12 34 56 78</p>' +
            '<input type="password" value="secret"><input name="q" value="recherche"><img src="/img.png" alt="Logo Acme"></body></html>',
        );
      }
      if (req.url.startsWith('/style.css')) {
        res.writeHead(200, { 'content-type': 'text/css' });
        return res.end('.titre{color:rgb(163, 25, 91)} body{background:url(/img.png) no-repeat -999px 0}');
      }
      if (req.url.startsWith('/img.png')) {
        res.writeHead(200, { 'content-type': 'image/png' });
        return res.end(
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64',
          ),
        );
      }
      if (req.url.startsWith('/functions/v1/html-ingest')) {
        const b = JSON.parse(buf.toString() || '{}');
        log[log.length - 1].body = JSON.stringify({
          workspaceId: b.workspaceId,
          demoId: b.demoId,
          size: (b.html || '').length,
          security: b.security,
        });
        log[log.length - 1].html = b.html;
        return send(200, { path: `${b.workspaceId}/${b.demoId}/${require('crypto').randomUUID()}.html` });
      }
      // L25-01 : page haute (capture pleine page) qui ouvre l'aide dans un nouvel onglet
      if (req.url.startsWith('/tabs')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Rapports</title></head><body style="margin:0;font-family:sans-serif">' +
            '<header style="height:64px;background:#1f2a44;color:#fff;padding:16px">ExampleCRM</header>' +
            '<main style="padding:24px"><h1>Rapports</h1><button id="new" style="font-size:18px;padding:10px">Nouveau rapport</button> ' +
            '<a id="help" href="/aide" target="_blank">Aide</a><div style="height:1800px"></div>' +
            // Donnée fictive tout en bas de la page (hors du viewport au clic)
            '<p id="bas">Contact : lea.martin@acme.example</p></main></body></html>',
        );
      }
      if (req.url.startsWith('/aide')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Aide</title></head><body style="font-family:sans-serif">' +
            '<h1>Centre d’aide</h1><button id="ok" style="font-size:18px;padding:10px">Lire l’article</button></body></html>',
        );
      }
      // L26-04 : app de démo fictive ExampleCRM (preuve de la capture guidée)
      if (req.url.startsWith('/crm')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>ExampleCRM</title></head><body style="margin:0;font-family:sans-serif;color:#1d2433">' +
            '<header style="display:flex;justify-content:space-between;align-items:center;background:#1f2638;color:#fff;padding:14px 20px"><b>ExampleCRM</b><span>alice@acme.example</span></header>' +
            '<div style="display:flex"><nav style="width:180px;padding:16px;display:grid;gap:12px;align-content:start;background:#f6f7fb;min-height:600px"><span>Tableau de bord</span><span>Contacts</span><b>Opportunités</b><span>Rapports</span><span>Paramètres</span></nav>' +
            '<main style="padding:24px;flex:1"><h1 style="margin-top:0">Opportunités</h1>' +
            '<div style="display:flex;gap:16px;margin-bottom:20px"><div style="padding:12px 16px;border:1px solid #e3e6ee;border-radius:8px">Prospection <b>12</b></div><div style="padding:12px 16px;border:1px solid #e3e6ee;border-radius:8px">Négociation <b>5</b></div><div style="padding:12px 16px;border:1px solid #e3e6ee;border-radius:8px">Gagné <b>8</b></div></div>' +
            '<button id="go" style="background:#4b3fe0;color:#fff;border:0;border-radius:6px;padding:10px 16px;font-size:15px">+ Nouvelle opportunité</button></main></div></body></html>',
        );
      }
      if (req.url.startsWith('/page')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Page test</title></head><body style="font-family:sans-serif"><h1>App de test</h1><button id="go" style="font-size:20px;padding:10px">Créer un projet</button><p><input type="password" value="secret"></p><a href="/page2">Suivant</a>' +
            // Fiche fictive (données inventées, domaine .example) pour la détection F1
            '<h2>Fiche usager</h2><table><thead><tr><th>Nom</th><th>Statut</th></tr></thead><tbody><tr><td>DURAND</td><td>Actif</td></tr></tbody></table>' +
            '<p>Suivi par Camille MARTIN</p><p>Tél. 06 12 34 56 78</p><p>Contact : camille.martin@exemple.example</p>' +
            '<p>NIR 2 04 07 75 123 456 78</p><p>Née le 14/02/2007</p><p>12 rue des Lilas</p><p>Rendez-vous le 12/03/2026</p></body></html>',
        );
      }
      send(404, {});
    });
  })
  .listen(54400, () => console.log('mock ready'));
