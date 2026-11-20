// Tests du transport épinglé (L37) : serveur TCP local, le nom d'hôte de l'URL n'est jamais résolu.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { dechunk, pinnedFetch, type Dial } from './pinned.ts';
import { MAX_RESPONSE } from './lib.ts';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Serveur local qui renvoie `reply` et garde la requête reçue ; `dial` y mène quelle que soit l'URL. */
function server(reply: string | null) {
  const l = Deno.listen({ hostname: '127.0.0.1', port: 0 });
  const port = (l.addr as Deno.NetAddr).port;
  const seen: { ip: string; port: number; host: string }[] = [];
  let request = '';
  const done = (async () => {
    const c = await l.accept();
    const buf = new Uint8Array(65536);
    const n = await c.read(buf);
    request = dec.decode(buf.subarray(0, n ?? 0));
    if (reply === null) {
      // Ne répond jamais (délai dépassé côté client)
      await new Promise((r) => setTimeout(r, 300));
    } else await c.write(enc.encode(reply));
    try {
      c.close();
    } catch {
      /* fermée par le client */
    }
    l.close();
  })();
  const dial: Dial = (ip, p, host) => {
    seen.push({ ip, port: p, host });
    return Deno.connect({ hostname: '127.0.0.1', port });
  };
  return { dial, seen, done, request: () => request };
}

const init = (extra: RequestInit = {}): RequestInit => ({
  method: 'POST',
  redirect: 'manual',
  headers: { 'content-type': 'application/json', 'tutoclick-event': 'lead.created' },
  body: '{"id":"e1"}',
  ...extra,
});

Deno.test('connexion à l’IP fournie, TLS pour le nom de l’URL, requête HTTP/1.1 complète', async () => {
  const s = server('HTTP/1.1 200 OK\r\ncontent-type: text/plain\r\ncontent-length: 2\r\n\r\nok');
  const res = await pinnedFetch(s.dial)('https://hooks.acme.example:8443/tc?x=1', init(), '93.184.215.14');
  await s.done;
  assertEquals(s.seen, [{ ip: '93.184.215.14', port: 8443, host: 'hooks.acme.example' }]);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), 'ok');
  const req = s.request();
  assert(req.startsWith('POST /tc?x=1 HTTP/1.1\r\n'), req);
  assert(req.includes('\r\nhost: hooks.acme.example:8443\r\n'));
  assert(req.includes('\r\nconnection: close\r\n'));
  assert(req.includes('\r\ncontent-length: 11\r\n'));
  assert(req.includes('\r\ntutoclick-event: lead.created\r\n'));
  assert(req.endsWith('\r\n\r\n{"id":"e1"}'));
});

Deno.test('port 443 par défaut, réponse « chunked » décodée', async () => {
  const s = server(
    'HTTP/1.1 201 Created\r\ntransfer-encoding: chunked\r\n\r\n3\r\nabc\r\n2\r\nde\r\n0\r\n\r\n',
  );
  const res = await pinnedFetch(s.dial)('https://hooks.acme.example/', init(), '93.184.215.14');
  await s.done;
  assertEquals(s.seen[0]!.port, 443);
  assertEquals(res.status, 201);
  assertEquals(await res.text(), 'abcde');
});

Deno.test('redirection rendue telle quelle (non suivie), corps borné à 2 Ko', async () => {
  const s = server(`HTTP/1.1 302 Found\r\nlocation: http://10.0.0.1/\r\n\r\n${'x'.repeat(5000)}`);
  const res = await pinnedFetch(s.dial)('https://hooks.acme.example/', init(), '93.184.215.14');
  await s.done;
  assertEquals(res.status, 302);
  assertEquals(res.headers.get('location'), 'http://10.0.0.1/');
  assertEquals((await res.text()).length, MAX_RESPONSE);
});

Deno.test('204 sans corps', async () => {
  const s = server('HTTP/1.1 204 No Content\r\n\r\n');
  const res = await pinnedFetch(s.dial)('https://hooks.acme.example/', init(), '93.184.215.14');
  await s.done;
  assertEquals(res.status, 204);
});

Deno.test('délai dépassé : la connexion est fermée et l’erreur TimeoutError remonte', async () => {
  const s = server(null);
  const err = await assertRejects(() =>
    pinnedFetch(s.dial)(
      'https://hooks.acme.example/',
      init({ signal: AbortSignal.timeout(100) }),
      '93.184.215.14',
    ),
  );
  assertEquals((err as Error).name, 'TimeoutError');
  await s.done;
});

Deno.test('réponse invalide ou en-tête avec retour à la ligne : refus', async () => {
  const s = server('n’importe quoi\r\n\r\n');
  await assertRejects(() => pinnedFetch(s.dial)('https://hooks.acme.example/', init(), '93.184.215.14'));
  await s.done;
  await assertRejects(() =>
    pinnedFetch(() => Promise.reject(new Error('jamais appelé')))(
      'https://hooks.acme.example/',
      init({ headers: { 'tutoclick-event': 'a\r\nx-injecte: 1' } }),
      '93.184.215.14',
    ),
  );
});

Deno.test('dechunk : morceaux bornés', () => {
  assertEquals(dec.decode(dechunk(enc.encode('5\r\nhello\r\n5\r\nworld\r\n0\r\n\r\n'), 7)), 'hellowo');
});

Deno.test('délai dépassé pendant la connexion (TCP ou TLS qui ne répond pas) : TimeoutError', async () => {
  const t0 = Date.now();
  const err = await assertRejects(() =>
    pinnedFetch(() => new Promise<Deno.Conn>(() => {}))(
      'https://hooks.acme.example/',
      init({ signal: AbortSignal.timeout(100) }),
      '93.184.215.14',
    ),
  );
  assertEquals((err as Error).name, 'TimeoutError');
  assert(Date.now() - t0 < 1000, 'le délai couvre la connexion');
});

Deno.test('connexion aboutie après l’abandon : fermée aussitôt, rien n’est envoyé', async () => {
  let closed = false;
  let written = 0;
  let resolveDial: (c: Deno.Conn) => void = () => {};
  const late = {
    write: (b: Uint8Array) => {
      written += b.length;
      return Promise.resolve(b.length);
    },
    read: () => Promise.resolve(null),
    close: () => {
      closed = true;
    },
  } as unknown as Deno.Conn;
  const p = pinnedFetch(() => new Promise<Deno.Conn>((r) => (resolveDial = r)))(
    'https://hooks.acme.example/',
    init({ signal: AbortSignal.timeout(50) }),
    '93.184.215.14',
  );
  await assertRejects(() => p);
  resolveDial(late);
  await new Promise((r) => setTimeout(r, 10));
  assert(closed, 'connexion tardive fermée');
  assertEquals(written, 0);
});
