// Faux Supabase minimal : enregistre les requêtes et répond juste assez pour l'extension.
const http = require('http');
const log = [];
let htmlCapture = { mode: 'allowed', domains: [] };
// Sandbox v2 : garde-fou d'espace (autorisé par défaut), modifiable par le test
let sandboxLive = true;
// L64 §1 : espaces de la personne (menu ⋯), modifiables par le test ; null : le seul espace Acme
let members = null;
// L64 §3 : assistance IA de l'espace (réglage) et échec simulé du fournisseur, modifiables par le test
let ai = { enabled: true, fail: false };
let tusOffset = 0;
// EXT-02 §2.4 : adresses que le faux serveur signale (liens gardés qu'il refuse)
let blocked = [];
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
      if (req.url === '/__sandbox-live') {
        sandboxLive = JSON.parse(buf.toString() || 'true') !== false;
        return send(200, { sandboxLive });
      }
      if (req.url === '/__ai') {
        ai = { enabled: true, fail: false, ...JSON.parse(buf.toString() || '{}') };
        return send(200, ai);
      }
      if (req.url.startsWith('/rest/v1/rpc/ai_status'))
        return send(200, { enabled: ai.enabled, features: { write: ai.enabled } });
      // L64 §3 : rédaction automatique d'une étape (faux fournisseur, aucune donnée réelle)
      if (req.url.startsWith('/functions/v1/ai')) {
        const b = JSON.parse(buf.toString() || '{}');
        if (b.task !== 'step_draft') return send(400, { error: 'BAD_TASK' });
        if (!ai.enabled) return send(403, { error: 'AI_DISABLED' });
        if (ai.fail) return send(502, { error: 'PROVIDER' });
        // Comme le serveur : au-delà de 4 s, demande rendue au quota et refusée (TIMEOUT)
        if ((ai.delay || 0) > 4000) return setTimeout(() => send(504, { error: 'TIMEOUT' }), 4000);
        const label = String(b.input?.label ?? '');
        return setTimeout(
          () =>
            send(200, {
              result: {
                title: label ? `Ouvrir ${label}` : 'Étape',
                text: `Cliquez sur « ${label} » pour continuer.`,
              },
              redacted: 0,
            }),
          ai.delay || 0,
        );
      }
      if (req.url === '/__members') {
        members = JSON.parse(buf.toString() || 'null');
        return send(200, members);
      }
      if (req.url === '/__blocked') {
        blocked = JSON.parse(buf.toString() || '[]');
        return send(200, blocked);
      }
      if (req.url.startsWith('/rest/v1/workspaces') && req.method === 'GET')
        return send(200, { settings: { htmlCapture } });
      if (req.url.startsWith('/auth/v1/token')) return send(200, session);
      if (req.url.startsWith('/auth/v1/user')) return send(200, user);
      if (req.url.startsWith('/rest/v1/members')) {
        const list = members ?? [
          { id: '11111111-1111-1111-1111-111111111111', name: 'Acme', role: 'owner', count: 1 },
        ];
        // Nombre de membres par espace : une ligne par membre
        if (req.url.includes('select=workspace_id'))
          return send(
            200,
            list.flatMap((w) => Array.from({ length: w.count ?? 1 }, () => ({ workspace_id: w.id }))),
          );
        return send(
          200,
          list.map((w) => ({ role: w.role, workspaces: { id: w.id, name: w.name } })),
        );
      }
      // L64 §2 : dossiers de l'espace et démos modifiables (vue Destination du popup), fictifs
      if (req.method === 'GET' && req.url.startsWith('/rest/v1/folders'))
        return send(200, [
          { id: 'f-ventes', name: 'Ventes', parent_id: null },
          { id: 'f-nouveaux', name: 'Nouveaux clients', parent_id: 'f-ventes' },
          { id: 'f-support', name: 'Support', parent_id: null },
        ]);
      if (
        req.method === 'GET' &&
        req.url.startsWith('/rest/v1/demos') &&
        req.url.includes('folder_id') &&
        !/[?&]id=eq\./.test(req.url)
      )
        return send(200, [
          {
            id: '44444444-4444-4444-8444-444444444444',
            title: 'Prise en main du CRM',
            folder_id: 'f-ventes',
            steps: [{ count: 4 }],
          },
          {
            id: '55555555-5555-4555-8555-555555555555',
            title: 'Créer une facture',
            folder_id: 'f-support',
            steps: [{ count: 7 }],
          },
          {
            id: '66666666-6666-4666-8666-666666666666',
            title: 'Relancer un client',
            folder_id: 'f-nouveaux',
            steps: [{ count: 2 }],
          },
        ]);
      // EXT-02 §8 : ajout d'étapes à une démo existante (titre de la démo, étapes dans l'ordre)
      if (req.method === 'GET' && req.url.startsWith('/rest/v1/demos') && req.url.includes('workspace_id'))
        return send(
          200,
          req.url.includes('22222222-2222-4222-8222-222222222222')
            ? {
                id: '22222222-2222-4222-8222-222222222222',
                title: 'Démo CRM',
                workspace_id: '11111111-1111-1111-1111-111111111111',
              }
            : null,
        );
      if (
        req.method === 'GET' &&
        req.url.startsWith('/rest/v1/steps') &&
        req.url.includes('select=id%2Ctitle') &&
        !req.url.includes('to_capture')
      )
        return send(200, [
          { id: '44444444-4444-4444-8444-444444444441', title: 'Ouvrir les clients' },
          { id: '44444444-4444-4444-8444-444444444442', title: 'Créer une opportunité' },
          { id: '44444444-4444-4444-8444-444444444443', title: 'Merci !' },
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
      // Vidéo : page fictive pour le masquage en direct. Fiche au-dessus et très en dessous de la ligne de
      // flottaison, nom au milieu d'un long paragraphe, faux nom « Assistant IA », panneau qui s'ouvre
      // par-dessus une donnée masquée. Données inventées (domaine .example).
      if (req.url.startsWith('/masque')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Fiches fictives</title><style>body{font-family:sans-serif;margin:0;padding:24px}' +
            '#panneau{position:fixed;top:40px;left:16px;width:420px;height:260px;background:#fff;border:1px solid #99a;z-index:50;padding:16px}' +
            '.bloc{height:1400px}</style></head><body>' +
            '<h1>Fiches</h1><button id="assistant" type="button">Assistant IA</button> <button id="ouvrir" type="button">Ouvrir le panneau</button>' +
            '<p id="haut">Contact : camille.martin@exemple.example</p>' +
            '<p id="long">Ce dossier, ouvert en mars et relu deux fois par le service, est suivi par Camille MARTIN depuis la réunion de lancement du projet fictif.</p>' +
            '<div class="bloc"></div>' +
            '<p id="bas">Tél. 06 12 34 56 78</p>' +
            '<div class="bloc"></div><p id="fin">Contact : alex.durand@exemple.example</p>' +
            '<script>document.getElementById("ouvrir").addEventListener("click",function(){var d=document.createElement("div");' +
            'd.id="panneau";d.textContent="Panneau ouvert par-dessus la page";document.body.appendChild(d);});</script></body></html>',
        );
      }
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
            '<script src="/spa-suivi.js"></script>' +
            // Script de suivi fictif (aucun envoi : la fonction ne fait qu'empiler)
            '<script>window.dataLayer=[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());</script>' +
            '</head><body>' +
            '<nav id="nav"><a href="/spa" data-route>Accueil</a><a href="/spa/clients" data-route>Clients</a>' +
            '<button id="reglages" type="button">Réglages</button><button id="aide" type="button">Aide</button>' +
            '<button id="plus" type="button" aria-expanded="false">Plus</button></nav>' +
            '<div id="liste" role="menu" hidden></div>' +
            '<main id="vue"></main><iframe src="/spa-cadre" title="Cadre fictif" width="200" height="60"></iframe>' +
            '<script>(function(){' +
            'var vues={"/spa":"<h1>Accueil</h1><p>Bienvenue dans l\u2019appli fictive.</p>",' +
            '"/spa/clients":"<h1>Clients</h1><ul><li>Société Exemple</li><li>Mairie de Testville</li></ul>",' +
            '"/spa/rapports":"<h1>Rapports</h1><p>Rapport mensuel fictif.</p>"};' +
            'function rendre(){var v=document.getElementById("vue");v.innerHTML="<p>Chargement…</p>";' +
            // Rendu en deux temps, comme une appli qui attend ses données
            'setTimeout(function(){v.innerHTML=vues[location.pathname]||"<h1>Introuvable</h1>";},250);}' +
            'document.addEventListener("click",function(e){var a=e.target.closest("a[data-route]");if(!a)return;' +
            'e.preventDefault();history.pushState({}, "", a.getAttribute("href"));' +
            'var l=document.getElementById("liste");l.hidden=true;l.innerHTML="";' +
            'document.getElementById("plus").setAttribute("aria-expanded","false");rendre();});' +
            // Menu : ses entrées n'existent dans la page qu'une fois ouvert
            'document.getElementById("plus").addEventListener("click",function(){var l=document.getElementById("liste");' +
            'l.hidden=!l.hidden;l.innerHTML=l.hidden?"":"<a href=\\"/spa/rapports\\" role=\\"menuitem\\" data-route>Rapports</a>";' +
            'this.setAttribute("aria-expanded",String(!l.hidden));});' +
            // Écran qui change sans changement d'adresse
            'document.getElementById("reglages").addEventListener("click",function(){' +
            'document.getElementById("vue").innerHTML="<h1>Réglages</h1><p>Langue : français. Thème : clair.</p>";});' +
            // Fenêtre par-dessus la page : état passager, jamais une nouvelle page
            'document.getElementById("aide").addEventListener("click",function(){var d=document.createElement("div");' +
            'd.setAttribute("role","dialog");d.setAttribute("aria-label","Aide");' +
            'd.style.cssText="position:fixed;inset:5%;background:#fff;border:1px solid #ccd;padding:24px";' +
            'd.innerHTML="<h1>Aide</h1><p>Texte d\u2019aide fictif.</p><button type=\\"button\\">Fermer</button>";' +
            'd.querySelector("button").addEventListener("click",function(){d.remove();});document.body.appendChild(d);});' +
            'window.addEventListener("popstate",rendre);rendre();})();</script></body></html>',
        );
      }
      // A8 : seconde page (script, gestionnaire, mot de passe rempli, données fictives) et ingestion
      // EXT-02 §2 : pages fictives pour l'écran « Vérifier avant l'envoi » (scripts, suivi, cadre,
      // formulaire, données inventées, liens externes en https et en http)
      if (req.url.startsWith('/verif2')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Agenda</title><script>window.__v2=1</script></head>' +
            '<body style="font-family:sans-serif"><h1>Agenda</h1><p>Tél. 06 12 34 56 78</p>' +
            '<a href="/verif">Retour</a></body></html>',
        );
      }
      if (req.url.startsWith('/verif')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Fiche client</title><script>window.__v=1</script>' +
            '<script>function gtag(){} gtag("config","fictif")</script><script src="/spa-suivi.js"></script></head>' +
            '<body style="font-family:sans-serif"><h1>Fiche client</h1><p id="suivi">Suivi par Camille MARTIN</p>' +
            '<p id="mail">Contact : camille.martin@exemple.example</p>' +
            '<form action="/envoi" method="post" aria-label="Recherche"><input name="q"><button type="button">Chercher</button></form>' +
            '<iframe src="/spa-cadre" title="Cadre fictif" width="200" height="60"></iframe>' +
            '<p><a id="aide" href="https://aide.example.com/guide">Aide en ligne</a> ' +
            '<a id="cg" href="https://legal.example.com/cg">Conditions générales</a> ' +
            '<a id="vieux" href="http://ancien.example.com/">Ancien site</a></p>' +
            '<a id="suite" href="/verif2">Suite</a></body></html>',
        );
      }
      if (req.url.startsWith('/page2')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Agenda</title><link rel="stylesheet" href="/style.css"><script>window.__x=1</script></head>' +
            '<body><nav id="menu"><a href="/page">Accueil</a><a href="/page2">Agenda</a></nav><h1 class="titre">Agenda</h1>' +
            '<button onclick="alert(1)">Valider</button><p>Conseillère : Camille MARTIN</p><p>Tél. 06 12 34 56 78</p>' +
            '<input type="password" value="secret"><input name="q" value="recherche"><img src="/img.png" alt="Logo Acme">' +
            // Ressources que l'extension ne doit pas rapporter : autre hôte interne, mauvais type, trop lourde
            '<img id="r-hote" src="http://127.0.0.1:54400/img.png?autre-hote" alt="">' +
            '<img id="r-type" src="/pas-une-image.png" alt="">' +
            '<img id="r-poids" src="/trop-lourde.png" alt=""></body></html>',
        );
      }
      if (req.url.startsWith('/style.css')) {
        res.writeHead(200, { 'content-type': 'text/css' });
        return res.end('.titre{color:rgb(163, 25, 91)} body{background:url(/img.png) no-repeat -999px 0}');
      }
      if (req.url.startsWith('/pas-une-image.png')) {
        // Une page servie à une adresse d'image : jamais rapportée dans la capture
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<html><body>Contenu réservé fictif</body></html>');
      }
      if (req.url.startsWith('/trop-lourde.png')) {
        res.writeHead(200, { 'content-type': 'image/png' });
        return res.end(Buffer.alloc(3 * 1024 * 1024 + 10));
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
        // Sandbox v2 : seconde requête, enregistrement vivant d'une page déjà déposée (gardé tel quel au journal)
        if (b.live) {
          log[log.length - 1].body = JSON.stringify({
            workspaceId: b.workspaceId,
            demoId: b.demoId,
            path: b.path,
          });
          log[log.length - 1].live = b.live;
          if (!sandboxLive) return send(403, { error: 'SANDBOX_LIVE_DISABLED' });
          return send(200, {
            livePath: String(b.path).replace(/\.html$/, '.json'),
            live: {
              scripts: b.live.scripts.map((x) => ({
                id: x.id,
                source: x.source,
                category: x.category,
                keep: x.keep,
                bytes: x.code.length,
              })),
              responses: b.live.responses.length,
            },
          });
        }
        log[log.length - 1].body = JSON.stringify({
          workspaceId: b.workspaceId,
          demoId: b.demoId,
          size: (b.html || '').length,
          security: b.security,
        });
        log[log.length - 1].html = b.html;
        return send(200, {
          path: `${b.workspaceId}/${b.demoId}/${require('crypto').randomUUID()}.html`,
          security: { blocked },
        });
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
      // L60 §3 : page sans aucune donnée personnelle (Terminer envoie sans écran de vérification)
      if (req.url.startsWith('/propre')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Projets</title></head><body style="font-family:sans-serif;padding:24px">' +
            '<h1>Projets</h1><p>Organisez vos projets par équipe.</p>' +
            '<button id="nouveau" style="font-size:18px;padding:10px">Nouveau projet</button> ' +
            '<button id="filtrer" style="font-size:18px;padding:10px">Filtrer</button></body></html>',
        );
      }
      // L60 §3 : onglet de l'app déjà ouvert (adresse en #/), réutilisé pour ouvrir l'éditeur après l'envoi
      if (req.url === '/' || req.url.startsWith('/?')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>TutoClick</title></head><body>App</body></html>',
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
