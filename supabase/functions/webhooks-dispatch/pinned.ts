// L37 (dette L23, rebinding DNS) : POST HTTPS envoyé à l'adresse IP déjà contrôlée, sans nouvelle
// résolution. La connexion TCP part vers cette IP, puis TLS est négocié et vérifié pour le nom d'hôte de
// l'URL (SNI et certificat) : un serveur DNS hostile ne peut plus répondre une autre adresse entre le
// contrôle et l'envoi. HTTP/1.1, « Connection: close », réponse lue jusqu'à MAX_RESPONSE octets de corps.
import { MAX_RESPONSE, type Fetcher } from './lib.ts';

/** Ouvre la connexion vers l'IP contrôlée ; `host` sert à TLS (SNI et vérification du certificat). */
export type Dial = (ip: string, port: number, host: string) => Promise<Deno.Conn>;

export const tlsDial: Dial = async (ip, port, host) => {
  const tcp = await Deno.connect({ hostname: ip, port });
  try {
    return await Deno.startTls(tcp, { hostname: host });
  } catch (e) {
    tcp.close();
    throw e;
  }
};

const MAX_HEAD = 16 * 1024;
const enc = new TextEncoder();
const dec = new TextDecoder();
const NULL_BODY = new Set([204, 205, 304]);

function indexOf(buf: Uint8Array, seq: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer;
    return i;
  }
  return -1;
}
const CRLF2 = enc.encode('\r\n\r\n');
const LAST_CHUNK = enc.encode('\r\n0\r\n\r\n');

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** Corps « chunked » décodé, borné à `max` octets (les morceaux incomplets sont gardés tels quels). */
export function dechunk(raw: Uint8Array, max: number): Uint8Array {
  let out: Uint8Array = new Uint8Array(0);
  let i = 0;
  while (i < raw.length && out.length < max) {
    const eol = indexOf(raw, enc.encode('\r\n'), i);
    if (eol < 0) break;
    const size = parseInt(dec.decode(raw.subarray(i, eol)).split(';')[0]!.trim(), 16);
    if (!Number.isFinite(size) || size <= 0) break;
    const start = eol + 2;
    out = concat(out, raw.subarray(start, Math.min(start + size, raw.length)));
    i = start + size + 2;
  }
  return out.subarray(0, max);
}

/** Fetcher qui n'utilise que l'IP fournie (troisième argument) ; `dial` est injecté pour les tests. */
export function pinnedFetch(dial: Dial = tlsDial): Fetcher {
  return async (rawUrl, init, ip) => {
    const url = new URL(rawUrl);
    const port = Number(url.port || 443);
    const headers = new Headers(init.headers);
    const body = enc.encode(typeof init.body === 'string' ? init.body : '');
    const lines = [
      `${init.method ?? 'POST'} ${url.pathname}${url.search} HTTP/1.1`,
      `host: ${url.host}`,
      'connection: close',
      `content-length: ${body.length}`,
      ...[...headers].map(([k, v]) => `${k}: ${v}`),
    ];
    // Pas d'injection d'en-tête : aucune valeur ne peut contenir de retour à la ligne
    if (lines.some((l) => /[\r\n]/.test(l))) throw new TypeError('en-tête invalide');
    const signal = init.signal;
    if (signal?.aborted) throw signal.reason;
    const conn = await dial(ip, port, url.hostname);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try {
        conn.close();
      } catch {
        /* déjà fermée */
      }
    };
    const aborted = new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => {
        close();
        reject(signal.reason);
      });
    });
    const exchange = async (): Promise<Response> => {
      await writeAll(conn, concat(enc.encode(lines.join('\r\n') + '\r\n\r\n'), body));
      let raw: Uint8Array = new Uint8Array(0);
      let headEnd = -1;
      let limit = MAX_HEAD;
      const chunk = new Uint8Array(4096);
      let chunked = false;
      for (;;) {
        const n = await conn.read(chunk);
        if (n === null) break;
        raw = concat(raw, chunk.subarray(0, n));
        if (headEnd < 0) {
          headEnd = indexOf(raw, CRLF2);
          if (headEnd < 0) {
            if (raw.length > MAX_HEAD) throw new TypeError('en-têtes trop longs');
            continue;
          }
          const head = dec.decode(raw.subarray(0, headEnd)).toLowerCase();
          chunked = /\r\ntransfer-encoding:[^\r\n]*chunked/.test(head);
          const cl = /\r\ncontent-length:\s*(\d+)/.exec(head);
          // Corps lu au plus jusqu'à MAX_RESPONSE (plus l'enveloppe des morceaux en « chunked »)
          limit =
            headEnd +
            4 +
            (chunked ? MAX_RESPONSE * 2 + 512 : Math.min(MAX_RESPONSE, cl ? Number(cl[1]) : MAX_RESPONSE));
        }
        if (raw.length >= limit) break;
        if (chunked && indexOf(raw, LAST_CHUNK, headEnd + 2) >= 0) break;
      }
      if (headEnd < 0) throw new TypeError('réponse incomplète');
      const [statusLine, ...headerLines] = dec.decode(raw.subarray(0, headEnd)).split('\r\n');
      const m = /^HTTP\/1\.[01] (\d{3})/.exec(statusLine ?? '');
      const status = m ? Number(m[1]) : 0;
      if (status < 200 || status > 599) throw new TypeError('statut invalide');
      const out = new Headers();
      for (const h of headerLines) {
        const i = h.indexOf(':');
        if (i > 0) out.append(h.slice(0, i).trim(), h.slice(i + 1).trim());
      }
      out.delete('content-length');
      out.delete('transfer-encoding');
      const rest = raw.subarray(headEnd + 4);
      const data = (chunked ? dechunk(rest, MAX_RESPONSE) : rest).slice(0, MAX_RESPONSE);
      return new Response(NULL_BODY.has(status) ? null : data, { status, headers: out });
    };
    try {
      return await Promise.race([exchange(), aborted]);
    } finally {
      close();
    }
  };
}

async function writeAll(conn: Deno.Conn, data: Uint8Array) {
  for (let off = 0; off < data.length;) off += await conn.write(data.subarray(off));
}
