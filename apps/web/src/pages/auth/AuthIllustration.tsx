/**
 * AUTH-ILL (docs/ux/specs/auth-illustration.md) : panneau illustré des pages de connexion, d'inscription,
 * d'invitation et de mot de passe oublié. Une fenêtre stylisée de l'app (que des formes, aucun texte hors
 * de la bulle), un hotspot et sa bulle qui passent de l'étape 1 à l'étape 2, puis l'accroche et la
 * signature de la DSIML. Couleurs de la marque seulement. Décoratif : `aria-hidden`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './auth-illustration.css';

/** Durée d'affichage d'une étape, et du fondu de sortie de la bulle (MOTION-01). */
const STEP_MS = 4000;
const FADE_MS = 120;

/**
 * Fenêtre de l'app et bulle. `step` fige l'étape (tests, captures).
 * `data-gap-exempt` (§18.6) : ce sont les traits d'un dessin décoratif aux cotes de la spec AUTH-ILL
 * (barres de 5 px espacées de 4 px…), pas des éléments d'interface.
 */
function AppWindow({ step: fixed }: { step?: 1 | 2 }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2>(fixed ?? 1);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (fixed) return;
    // Mouvement réduit : tout reste figé sur 1/6
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const aside = ref.current?.closest('.auth-ill');
    let hover = false;
    let swap = 0;
    const enter = () => (hover = true);
    const leave = () => (hover = false);
    aside?.addEventListener('pointerenter', enter);
    aside?.addEventListener('pointerleave', leave);
    const timer = window.setInterval(() => {
      // En pause au survol du panneau et quand l'onglet est caché
      if (hover || document.hidden) return;
      setFade(true);
      swap = window.setTimeout(() => {
        setStep((n) => (n === 1 ? 2 : 1));
        setFade(false);
      }, FADE_MS);
    }, STEP_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(swap);
      aside?.removeEventListener('pointerenter', enter);
      aside?.removeEventListener('pointerleave', leave);
    };
  }, [fixed]);

  return (
    <div className="auth-ill__win" data-step={step} ref={ref}>
      <div className="auth-ill__nav">
        <div className="auth-ill__logo" data-gap-exempt="">
          <i />
          <span />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`auth-ill__item${i === 0 ? ' is-on' : ''}`}>
            <i />
            <span />
          </div>
        ))}
      </div>
      <div className="auth-ill__main">
        <div className="auth-ill__head">
          <span className="auth-ill__title" />
          <span className="auth-ill__new" />
        </div>
        <div className="auth-ill__cards">
          {[0, 1, 2].map((i) => (
            <div key={i} className="auth-ill__card" data-gap-exempt="">
              <div className="auth-ill__thumb" />
              <div className="auth-ill__meta" data-gap-exempt="">
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
        <div className="auth-ill__rows" data-gap-exempt="">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} />
          ))}
        </div>
      </div>
      <span className="auth-ill__hs" />
      <div className={`auth-ill__tip${fade ? ' is-fade' : ''}`}>
        <small>{step} / 6</small>
        <b>{t(`auth.ill.tip${step}Title`)}</b>
        <span>{t(`auth.ill.tip${step}Body`)}</span>
        <span className="auth-ill__go">{t('auth.ill.next')}</span>
      </div>
    </div>
  );
}

/** Signature : un trait, puis les quatre points de la DSIML (décoratifs, comme sur le logo). */
function Signature() {
  return (
    <div className="auth-ill__dots" data-gap-exempt="">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  // `?ill=1` ou `?ill=2` fige l'étape de la bulle (recette, captures)
  const fixed = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('ill');
  return (
    <aside className="auth-aside auth-ill" aria-hidden="true">
      <AppWindow step={fixed === '1' ? 1 : fixed === '2' ? 2 : undefined} />
      <div className="auth-ill__quote">
        {children}
        <Signature />
      </div>
    </aside>
  );
}

/** Connexion, invitation, mot de passe oublié : la fenêtre et l'accroche. */
export function DemoAside() {
  const { t } = useTranslation();
  return (
    <Panel>
      <p className="auth-ill__h">{t('auth.asideQuote')}</p>
      <p className="auth-ill__sub">{t('auth.asideQuoteSub')}</p>
    </Panel>
  );
}

/** Inscription : la même fenêtre, « Capturez · Guidez · Diffusez » et les trois étapes. */
export function StepsAside() {
  const { t } = useTranslation();
  return (
    <Panel>
      <p className="auth-ill__h">{t('auth.stepsTitle')}</p>
      <ol className="auth-ill__steps">
        {[1, 2, 3].map((n) => (
          <li key={n}>
            <span className="auth-ill__n">{n}</span>
            <div>
              <b>{t(`auth.step${n}Title`)}</b>
              {t(`auth.step${n}Body`)}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
