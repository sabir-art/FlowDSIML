/**
 * Sandbox v2, étape 3 (docs/tech/sandbox-v2.md §3.1) : enregistreur exécuté dans le monde de la page
 * (scripting.executeScript, world: 'MAIN', au début du chargement). Il enveloppe fetch et XMLHttpRequest et
 * copie les réponses des LECTURES (GET) : adresse, statut, type, corps texte. Rien d'autre :
 *  - jamais les en-têtes (ni cookies, ni Set-Cookie, ni authentification), jamais le corps d'une écriture ;
 *  - corps texte seulement (JSON, texte, XML), 1 Mo au plus ;
 *  - la page n'est pas ralentie : la copie se fait sur un clone, après coup.
 * Chaque réponse est transmise au script de capture (monde isolé) par un évènement du document dont le nom
 * est tiré au hasard à l'injection ; le détail est une chaîne JSON (copiable entre les mondes).
 * Fonction autonome : elle est sérialisée par executeScript, elle ne peut rien importer.
 */
export function liveRecorder(eventName: string): void {
  const w = window as unknown as Record<string, unknown>;
  const flag = '__fdLiveRecorder';
  if (w[flag]) return;
  w[flag] = true;
  const MAX = 1024 * 1024;
  const textual = (t: string) =>
    /^(application\/([a-z0-9.+-]*\+)?json|application\/(xml|x-www-form-urlencoded)|text\/(plain|xml|csv))/i.test(
      t,
    );
  const send = (url: string, status: number, type: string, body: string) => {
    if (!/^https?:/i.test(url) || body.length > MAX) return;
    try {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          detail: JSON.stringify({ url, status, type: type.split(';')[0], body }),
        }),
      );
    } catch {
      /* jamais d'erreur visible de la page */
    }
  };

  const origFetch = window.fetch;
  window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    const method = String(
      init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET'),
    ).toUpperCase();
    const p = origFetch.call(this as typeof window, input, init);
    if (method === 'GET') {
      p.then((res) => {
        const type = res.headers.get('content-type') ?? '';
        if (!textual(type) || res.type === 'opaque') return;
        const len = Number(res.headers.get('content-length') ?? '0');
        if (len > MAX) return;
        res
          .clone()
          .text()
          .then((body) => send(res.url, res.status, type, body))
          .catch(() => undefined);
      }).catch(() => undefined);
    }
    return p;
  } as typeof window.fetch;

  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;
  const meta = new WeakMap<XMLHttpRequest, { method: string }>();
  XHR.open = function (this: XMLHttpRequest, method: string, ...rest: unknown[]) {
    meta.set(this, { method: String(method).toUpperCase() });
    return (origOpen as (...a: unknown[]) => void).call(this, method, ...rest);
  } as typeof XHR.open;
  XHR.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    if (meta.get(this)?.method === 'GET') {
      this.addEventListener('load', () => {
        try {
          const type = this.getResponseHeader('content-type') ?? '';
          if (!textual(type)) return;
          const text =
            this.responseType === '' || this.responseType === 'text'
              ? this.responseText
              : this.responseType === 'json'
                ? JSON.stringify(this.response)
                : null;
          if (text !== null) send(this.responseURL, this.status, type, text);
        } catch {
          /* réponse illisible : ignorée */
        }
      });
    }
    return origSend.call(this, body);
  };
}
