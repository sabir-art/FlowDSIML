import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Check,
  CircleCheck,
  Crosshair,
  EyeOff,
  MousePointerClick,
  Puzzle,
  ShieldCheck,
} from 'lucide-react';
import { AppPage } from '../../components/AppPage';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { supabase } from '../../lib/supabase';
import { EXTENSION_LATEST, EXTENSION_URL } from '../../lib/env';
import { formatRelativeShort } from '../../lib/format';
import { versionState } from './extension';
import './extension.css';

/**
 * Retours du 24/11 (2e série) §7 : page Extension.
 *  - absente et publiée sur le Store : bloc d'accueil (bénéfices, « Installer depuis le Chrome Web Store ») ;
 *  - absente et pas encore publiée : « Bientôt disponible », une phrase ;
 *  - présente (elle s'est déclarée pour ce compte) : « L'extension est prête », « Capturer une démo »,
 *    trois faits (version, dernière capture, raccourcis) et « Bien capturer ».
 */
export function ExtensionPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { current } = useWorkspace();
  const seen = profile?.extension_seen_at ?? null;
  const lastDemoId = profile?.extension_last_demo ?? null;
  const [lastTitle, setLastTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!lastDemoId) return setLastTitle(null);
    let live = true;
    void supabase
      .from('demos')
      .select('title')
      .eq('id', lastDemoId)
      .maybeSingle()
      .then(({ data }) => live && setLastTitle(data?.title ?? null));
    return () => {
      live = false;
    };
  }, [lastDemoId]);

  return (
    <AppPage title={t('nav.extension')} className="mk xt">
      {seen ? (
        <Ready
          space={current?.name ?? ''}
          version={profile?.extension_version}
          lastAt={profile?.extension_last_capture_at ?? null}
          lastTitle={lastTitle}
        />
      ) : EXTENSION_URL ? (
        <Welcome />
      ) : (
        <section className="xt-card xt-soon" aria-labelledby="xt-soon-t">
          <h2 id="xt-soon-t">
            {t('extension.soonTitle')} <span className="fd-badge">{t('extension.soon')}</span>
          </h2>
          <p>{t('extension.soonBody')}</p>
        </section>
      )}
    </AppPage>
  );
}

function Welcome() {
  const { t } = useTranslation();
  return (
    <section className="xt-card xt-hero" aria-labelledby="xt-hero-t">
      <div className="xt-hero__txt">
        <span className="xt-chip">
          <Puzzle aria-hidden="true" />
          {t('extension.browsers')}
        </span>
        <h2 id="xt-hero-t">{t('extension.heroTitle')}</h2>
        <ul className="xt-benefits">
          {(['b1', 'b2', 'b3'] as const).map((k) => (
            <li key={k}>
              <Check aria-hidden="true" />
              {t(`extension.${k}`)}
            </li>
          ))}
        </ul>
        <div className="xt-hero__act">
          <a
            className="fd-btn fd-btn--primary"
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('extension.installStore')}
            <ArrowUpRight aria-hidden="true" />
            <span className="sr-only">{t('extension.newTab')}</span>
          </a>
        </div>
        <p className="xt-help">{t('extension.already')}</p>
      </div>
      {/* Illustration maison (aucune capture de la boutique) : une page, un clic, la fenêtre de l'extension */}
      <div className="xt-ill" aria-hidden="true">
        <div className="xt-ill__page">
          <span className="xt-ill__click" />
          <div className="xt-ill__pop">
            <b>TutoClick</b>
            <span>{t('extension.illStatus')}</span>
            <i />
          </div>
        </div>
      </div>
    </section>
  );
}

function Ready({
  space,
  version,
  lastAt,
  lastTitle,
}: {
  space: string;
  version: string | null | undefined;
  lastAt: string | null;
  lastTitle: string | null;
}) {
  const { t } = useTranslation();
  const v = versionState(version, EXTENSION_LATEST);
  return (
    <>
      <section className="xt-card xt-ready" aria-labelledby="xt-ready-t">
        <span className="xt-ready__icon" aria-hidden="true">
          <CircleCheck />
        </span>
        <div className="xt-ready__txt">
          <h2 id="xt-ready-t">{t('extension.readyHeading')}</h2>
          <p>{t('extension.readyBody', { space })}</p>
        </div>
        <Link className="fd-btn fd-btn--primary" to="/?new=1">
          <Crosshair aria-hidden="true" />
          {t('extension.captureDemo')}
        </Link>
      </section>

      <dl className="xt-facts">
        <div className="xt-fact">
          <dt>{t('extension.version')}</dt>
          <dd>
            {v.known ? v.version : t('extension.versionLegacy', { version: v.version })}
            {' · '}
            {v.upToDate ? t('extension.upToDate') : t('extension.updateAvailable')}
          </dd>
        </div>
        <div className="xt-fact">
          <dt>{t('extension.lastCapture')}</dt>
          <dd>
            {lastAt
              ? lastTitle
                ? t('extension.lastCaptureOf', { when: formatRelativeShort(lastAt), demo: lastTitle })
                : formatRelativeShort(lastAt)
              : t('extension.lastCaptureUnknown')}
          </dd>
        </div>
        <div className="xt-fact">
          <dt>{t('extension.shortcut')}</dt>
          <dd className="xt-keys">
            <span className="sr-only">{t('extension.shortcutStop')} : </span>
            <kbd>Alt</kbd>
            <span aria-hidden="true">+</span>
            <kbd>{t('editor.keys.shift')}</kbd>
            <span aria-hidden="true">+</span>
            <kbd>S</kbd>
            <span className="xt-keys__what" aria-hidden="true">
              {t('extension.shortcutStop')}
            </span>
          </dd>
        </div>
      </dl>

      <section className="xt-card" aria-labelledby="xt-tips-t">
        <h2 id="xt-tips-t">{t('extension.tipsTitle')}</h2>
        <ul className="xt-tips">
          <li>
            <MousePointerClick aria-hidden="true" />
            {t('extension.tip1')}
          </li>
          <li>
            <EyeOff aria-hidden="true" />
            {t('extension.tip2')}
          </li>
          <li>
            <ShieldCheck aria-hidden="true" />
            {t('extension.tip3')}
          </li>
        </ul>
        {EXTENSION_URL && (
          <a className="xt-manage" href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
            {t('extension.manage')}
            <ArrowUpRight aria-hidden="true" />
            <span className="sr-only">{t('extension.newTab')}</span>
          </a>
        )}
      </section>
    </>
  );
}
