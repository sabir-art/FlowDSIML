// Logique d'open-center (L14), sans dépendance Deno : testée par vitest (apps/web/src/lib/openCenter.test.ts).
// - Toute réponse autre que « ok » passe par le même délai minimal et ne contient que le statut renvoyé
//   par center_open (un centre inconnu, non publié ou aux liens publics désactivés répondent pareil).
// - Seule la couverture d'un module OUVERT est signée ; pour un module en mot de passe ou expiré, la
//   couverture est retirée même si la base en renvoyait une.

export const MAX_BODY = 4_000;
export const SIGN_TTL = 3600;
const SLUG = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;
const ASSET = /^assets\/[\w.-]+$/;

export interface CenterModule {
  demoId: string;
  access: 'open' | 'password' | 'expired';
  cover?: string | null;
  [k: string]: unknown;
}
export interface CenterGate {
  status: string;
  paths?: Array<{ modules: CenterModule[]; [k: string]: unknown }>;
  /** A8 : Demo Center (démos ouvertes seulement, choisies par center_demos). */
  demos?: Array<{ demoId: string; cover?: string | null; [k: string]: unknown }> | null;
  [k: string]: unknown;
}

export interface Deps {
  gate(args: {
    p_slug: string;
    p_password: string | null;
    p_grant: string | null;
    p_client: string;
    p_link_token: string | null;
    p_visitor: string | null;
  }): Promise<CenterGate | null>;
  /** Chemins « <demoId>/assets/… » → URL signées (bucket privé « published »). */
  sign(paths: string[], ttl: number): Promise<Map<string, string>>;
  clientKey(slug: string): Promise<string>;
  /** Attend la fin du délai minimal (réponses refusées). */
  pause(): Promise<void>;
}

export type Reply = { status: number; body: unknown };

const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null);

export async function openCenter(text: string, deps: Deps): Promise<Reply> {
  if (text.length > MAX_BODY) return { status: 413, body: { error: 'too_large' } };
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return { status: 400, body: { error: 'bad_json' } };
  }
  const notFound = async (): Promise<Reply> => {
    await deps.pause();
    return { status: 200, body: { status: 'not_found' } };
  };
  const slug = typeof body.slug === 'string' && SLUG.test(body.slug) ? body.slug : null;
  if (!slug) return notFound();

  const gate = await deps.gate({
    p_slug: slug,
    p_password: str(body.password, 200),
    p_grant: str(body.grant, 100),
    p_client: await deps.clientKey(slug),
    p_link_token: str(body.linkToken, 128),
    p_visitor: str(body.visitorId, 64),
  });
  if (!gate) return { status: 500, body: { error: 'gate_failed' } };
  if (gate.status === 'not_found') return notFound();
  if (gate.status !== 'ok') {
    await deps.pause();
    return { status: 200, body: gate };
  }

  // Couvertures : seulement les modules ouverts ; les autres n'en ont jamais.
  const paths = (gate.paths ?? []).map((p) => ({
    ...p,
    modules: p.modules.map((m) => ({
      ...m,
      cover: m.access === 'open' && typeof m.cover === 'string' && ASSET.test(m.cover) ? m.cover : null,
    })),
  }));
  // A8 : démos d'un Demo Center (toutes ouvertes : liens publics sans mot de passe ni expiration)
  const demos = Array.isArray(gate.demos)
    ? gate.demos.map((d) => ({
        ...d,
        cover: typeof d.cover === 'string' && ASSET.test(d.cover) ? d.cover : null,
      }))
    : null;
  const wanted = [
    ...paths.flatMap((p) => p.modules.filter((m) => m.cover).map((m) => `${m.demoId}/${m.cover}`)),
    ...(demos ?? []).filter((d) => d.cover).map((d) => `${d.demoId}/${d.cover}`),
  ];
  const signed = wanted.length ? await deps.sign([...new Set(wanted)], SIGN_TTL) : new Map<string, string>();
  return {
    status: 200,
    body: {
      ...gate,
      paths: paths.map((p) => ({
        ...p,
        modules: p.modules.map((m) => ({
          ...m,
          cover: m.cover ? (signed.get(`${m.demoId}/${m.cover}`) ?? null) : null,
        })),
      })),
      demos: demos
        ? demos.map((d) => ({ ...d, cover: d.cover ? (signed.get(`${d.demoId}/${d.cover}`) ?? null) : null }))
        : null,
    },
  };
}
