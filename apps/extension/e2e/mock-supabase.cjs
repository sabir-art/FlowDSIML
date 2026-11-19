// Faux Supabase minimal : enregistre les requêtes et répond juste assez pour l'extension.
const http = require('http');
const log = [];
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
      if (req.url.startsWith('/auth/v1/token')) return send(200, session);
      if (req.url.startsWith('/auth/v1/user')) return send(200, user);
      if (req.url.startsWith('/rest/v1/members'))
        return send(200, [
          { role: 'owner', workspaces: { id: '11111111-1111-1111-1111-111111111111', name: 'Acme' } },
        ]);
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
