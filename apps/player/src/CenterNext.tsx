/**
 * L38-4 : fin d'un module ouvert depuis le centre de formation (#/d/<démo>?c=<centre>&f=<formation>).
 * Bouton principal « Module suivant : … », ou « Voir mon attestation » quand la formation est terminée ;
 * « Retour au centre » en second. L'état vient du centre (open-center), le module en cours étant compté
 * comme validé s'il vient de l'être (les statistiques partent par lot, quelques secondes plus tard).
 */
import { useEffect, useState } from 'preact/hooks';
import { ArrowRight, Award, GraduationCap } from 'lucide-preact';
import { centerLinkToken, openCenter } from './api';
import { pathView, type CenterModule, type CenterPath } from './center';
import { fmt, type Dict } from './i18n';

export interface FromCenter {
  slug: string;
  pathId: string;
}

const ICON = { size: 16, 'aria-hidden': true } as const;

/** Lien d'un module ouvert depuis le centre (le jeton personnel reste en session, jamais dans l'adresse). */
export const centerModuleHref = (demoId: string, from: FromCenter) =>
  `#/d/${demoId}?${new URLSearchParams({ c: from.slug, f: from.pathId })}`;

/** Origine « centre » d'un module, lue dans l'adresse (valeurs contrôlées), ou null. */
export function fromCenterParams(search: string): FromCenter | null {
  const q = new URLSearchParams(search);
  const slug = q.get('c') ?? '';
  const pathId = q.get('f') ?? '';
  if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug) || !/^[0-9a-f-]{36}$/i.test(pathId)) return null;
  return { slug, pathId };
}

/**
 * Suite de la formation après ce module : module suivant (premier non validé et ouvert, ou, sans apprenant
 * identifié, le module qui suit dans l'ordre) et formation terminée (attestation).
 */
export function nextInPath(
  path: CenterPath,
  demoId: string,
  identified: boolean,
  done: boolean,
): { next: CenterModule | null; finished: boolean } {
  const modules = path.modules.map((m) =>
    m.demoId === demoId && done ? { ...m, status: 'validated' as const } : m,
  );
  const v = pathView({ ...path, modules }, identified);
  if (identified) {
    const next = v.next && v.next.demoId !== demoId ? v.next : null;
    return { next, finished: v.done };
  }
  const i = modules.findIndex((m) => m.demoId === demoId);
  const next = modules.slice(i + 1).find((m) => m.access !== 'expired') ?? null;
  return { next: i >= 0 ? next : null, finished: false };
}

export function CenterNext({
  from,
  demoId,
  done,
  t,
}: {
  from: FromCenter;
  demoId: string;
  done: boolean;
  t: Dict;
}) {
  const [s, setS] = useState<{ next: CenterModule | null; finished: boolean } | null>(null);
  useEffect(() => {
    let off = false;
    void openCenter(from.slug, centerLinkToken(from.slug, null)).then((r) => {
      const path = r.status === 'ok' ? r.paths?.find((p) => p.id === from.pathId) : undefined;
      if (!off && path) setS(nextInPath(path, demoId, !!r.visitor, done));
    });
    return () => {
      off = true;
    };
  }, [from.slug, from.pathId, demoId, done]);
  const center = `#/c/${from.slug}`;
  return (
    <>
      {s?.finished ? (
        <a class="p-btn p-btn-primary" href={`${center}/f/${from.pathId}`}>
          <Award {...ICON} />
          {t.seeCertificate}
        </a>
      ) : s?.next ? (
        <a class="p-btn p-btn-primary" href={centerModuleHref(s.next.demoId, from)}>
          {fmt(t.quiz as unknown as Record<string, string>, 'nextModule', { module: s.next.title })}
          <ArrowRight {...ICON} />
        </a>
      ) : null}
      <a class="p-btn p-btn-secondary" href={center}>
        <GraduationCap {...ICON} />
        {t.backToCenter}
      </a>
    </>
  );
}
