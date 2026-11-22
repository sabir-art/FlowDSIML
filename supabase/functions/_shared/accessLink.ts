// Lien d'accès personnel à copier (action « link » d'access-email) : jeton signé, limité à UNE démo et à
// UNE adresse. Il ne passe jamais par Supabase Auth : aucun compte n'est créé et aucune session n'est
// ouverte. open-demo le vérifie, puis demo_gate décide (l'adresse doit toujours être invitée).
const PREFIX = 'tcl1';
/** Durée de validité d'un lien copié. */
export const ACCESS_LINK_TTL_S = 7 * 24 * 3600;

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Clé dérivée du secret du projet (jamais le secret lui-même). */
async function keyOf(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`access-link|v1|${secret}`));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const payload = (demoId: string, email: string, exp: number) =>
  enc.encode(`${demoId.toLowerCase()}|${email.toLowerCase()}|${exp}`);

export const isAccessLink = (token: string) => token.startsWith(`${PREFIX}.`);

export async function signAccessLink(
  secret: string,
  demoId: string,
  email: string,
  nowS: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const exp = nowS + ACCESS_LINK_TTL_S;
  const sig = await crypto.subtle.sign('HMAC', await keyOf(secret), payload(demoId, email, exp));
  return `${PREFIX}.${b64url(enc.encode(email.toLowerCase()))}.${exp}.${b64url(new Uint8Array(sig))}`;
}

/** Adresse prouvée par le jeton pour CETTE démo ; null s'il est invalide, expiré ou fait pour une autre démo. */
export async function verifyAccessLink(
  secret: string,
  demoId: string,
  token: string,
  nowS: number = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX || !/^\d{1,12}$/.test(parts[2])) return null;
  const mail = fromB64url(parts[1]);
  const sig = fromB64url(parts[3]);
  const exp = Number(parts[2]);
  if (!mail || !sig || exp <= nowS) return null;
  const email = new TextDecoder().decode(mail);
  const ok = await crypto.subtle.verify('HMAC', await keyOf(secret), sig, payload(demoId, email, exp));
  return ok ? email : null;
}
