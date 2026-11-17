// Faux Supabase minimal : enregistre les requêtes et répond juste assez pour l'extension.
const http = require('http');
const log = [];
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
      if (req.url.startsWith('/storage/v1/object/')) return send(200, { Key: req.url, Id: 'x' });
      if (req.url.startsWith('/rest/v1/')) return send(201, null);
      if (req.url.startsWith('/page')) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(
          '<html><head><meta charset="utf-8"><title>Page test</title></head><body style="font-family:sans-serif"><h1>App de test</h1><button id="go" style="font-size:20px;padding:10px">Créer un projet</button><p><input type="password" value="secret"></p><a href="/page2">Suivant</a></body></html>',
        );
      }
      send(404, {});
    });
  })
  .listen(54400, () => console.log('mock ready'));
