/**
 * L26-01 : « Prise en main de votre espace », en tête de la page Démos (remplace « Premiers pas »).
 * 7 étapes cochées automatiquement (calculées côté serveur : workspace_onboarding). Propriétaires et
 * administrateurs voient les 7 étapes, éditeurs les étapes 3 à 5, lecteurs rien. La prochaine étape
 * conseillée a le bouton principal. « Masquer » vaut pour la personne ; « Reprendre » est dans l'aide.
 * À 7 sur 7 : « Votre espace est prêt » pendant 7 jours.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Circle, CircleCheck, Info, Play, PartyPopper, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useHelp } from '../../help/HelpProvider';
import { TourDialog } from '../../help/TourDialog';
import { MODULE_TOUR, loadTours } from '../../help/tours';

const STEPS = ['brand', 'extension', 'capture', 'pii', 'publish', 'invite', 'distribute'] as const;
type Step = (typeof STEPS)[number];
const EDITOR_STEPS: Step[] = ['capture', 'pii', 'publish'];
const WEEK = 7 * 24 * 3600 * 1000;

interface State {
  steps: Record<Step, boolean>;
  doneAt: string | null;
  hiddenAt: string | null;
}

/**
 * État de la prise en main, chargé par la page Démos avant son premier affichage (la carte arrive en
 * même temps que la liste : aucun saut de mise en page).
 */
export function useOnboarding() {
  const { current, can } = useWorkspace();
  const wsId = current?.id;
  const editor = can('demo.edit');
  const [state, setState] = useState<State | null>(null);
  const [ready, setReady] = useState(!editor);
  const load = useCallback(() => {
    if (!editor || !wsId) return setReady(true);
    void supabase
      .rpc('workspace_onboarding', { p_ws: wsId })
      .then(({ data }) => setState(data as State | null))
      .then(() => setReady(true));
  }, [wsId, editor]);
  useEffect(load, [load]);
  // « Reprendre la prise en main » depuis l'aide
  useEffect(() => {
    addEventListener('fd:onboarding', load);
    return () => removeEventListener('fd:onboarding', load);
  }, [load]);
  return { state, setState, ready };
}
export type Onboarding = ReturnType<typeof useOnboarding>;

export function OnboardingCard({
  onb,
  onCapture,
  latestDemoId,
  publishedDemoId,
}: {
  onb: Onboarding;
  onCapture: () => void;
  latestDemoId: string | null;
  publishedDemoId: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const help = useHelp();
  const { current, can } = useWorkspace();
  const ws = current!;
  const admin = ws.role === 'owner' || ws.role === 'admin';
  const { state, setState } = onb;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(`fd.onb.collapsed.${ws.id}`) !== '1';
    } catch {
      return true;
    }
  });
  const [tour, setTour] = useState<{ id: string; title: string } | null>(null);

  if (!state || !can('demo.edit') || state.hiddenAt) return null;
  const visible = admin ? [...STEPS] : EDITOR_STEPS;
  const n = visible.filter((s) => state.steps[s]).length;
  const complete = n === visible.length;
  // 7 sur 7 : « Votre espace est prêt » pendant 7 jours, puis la carte disparaît
  if (complete && admin && state.doneAt && Date.now() - Date.parse(state.doneAt) > WEEK) return null;
  if (complete && !admin) return null;

  const hide = () => {
    setState((s) => (s ? { ...s, hiddenAt: new Date().toISOString() } : s));
    void supabase
      .from('onboarding_prefs')
      .upsert(
        { workspace_id: ws.id, hidden_at: new Date().toISOString() },
        { onConflict: 'user_id,workspace_id' },
      )
      .then(() => undefined);
  };
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(`fd.onb.collapsed.${ws.id}`, o ? '1' : '0');
      } catch {
        /* préférence non gardée */
      }
      return !o;
    });
  };
  const howTo = async (el: HTMLElement) => {
    // « Voir comment » : visite guidée de l'étape (§3.3), sinon l'article d'aide
    const data = (await loadTours()).find((x) => x.key === MODULE_TOUR.flouter);
    if (data) setTour({ id: data.id, title: data.title });
    else help?.openArticle('flouter-donnees', el);
  };
  const action = (s: Step): { label: string; go: (el: HTMLElement) => void; play?: boolean } => {
    switch (s) {
      case 'brand':
        return { label: t('onb.a.brand'), go: () => navigate('/settings/brand') };
      case 'extension':
        return { label: t('onb.a.extension'), go: (el) => help?.openArticle('creer-demo-extension', el) };
      case 'capture':
        return { label: t('onb.a.capture'), go: onCapture };
      case 'pii':
        return { label: t('onb.a.pii'), go: (el) => void howTo(el), play: true };
      case 'publish': {
        const id = publishedDemoId ?? latestDemoId;
        return {
          label: t('onb.a.publish'),
          go: () => (id ? navigate(`/demos/${id}/${publishedDemoId ? 'share' : 'edit'}`) : onCapture()),
        };
      }
      case 'invite':
        return { label: t('onb.a.invite'), go: () => navigate('/settings/members?invite=1') };
      case 'distribute': {
        const id = publishedDemoId ?? latestDemoId;
        return {
          label: t('onb.a.distribute'),
          go: () => (id ? navigate(`/demos/${id}/distribute`) : onCapture()),
        };
      }
    }
  };
  const next = visible.find((s) => !state.steps[s]);
  const half = Math.ceil(visible.length / 2);

  if (complete)
    return (
      <section className="fd-card onb-card onb-card--done" aria-labelledby="onb-t">
        <div className="onb-head">
          <span className="fd-icon-chip" aria-hidden="true">
            <PartyPopper />
          </span>
          <div className="onb-titles">
            <h2 id="onb-t">{t('onb.ready')}</h2>
            <p>{t('onb.readyBody')}</p>
          </div>
          <button type="button" className="fd-btn fd-btn--ghost fd-btn--sm" onClick={hide}>
            {t('onb.hideShort')}
          </button>
        </div>
      </section>
    );

  return (
    <section className="fd-card onb-card" aria-labelledby="onb-t">
      <div className="onb-head">
        <span className="fd-icon-chip" aria-hidden="true">
          <Sparkles />
        </span>
        <div className="onb-titles">
          <h2 id="onb-t">{t('onb.title')}</h2>
          <p>{t('onb.sub', { count: n, total: visible.length })}</p>
        </div>
        <div
          className="onb-bar"
          role="progressbar"
          aria-label={t('onb.title')}
          aria-valuemin={0}
          aria-valuemax={visible.length}
          aria-valuenow={n}
          aria-valuetext={t('onb.valuetext', { count: n, total: visible.length })}
        >
          <span style={{ width: `${(n / visible.length) * 100}%` }} />
        </div>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon"
          aria-label={t(open ? 'onb.collapse' : 'onb.expand')}
          aria-expanded={open}
          aria-controls={open ? 'onb-list' : undefined}
          onClick={toggle}
        >
          {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <>
          <ol id="onb-list" className="onb-list" style={{ gridTemplateRows: `repeat(${half}, auto)` }}>
            {visible.map((s) => {
              const ok = state.steps[s];
              const a = action(s);
              const isNext = s === next;
              return (
                <li key={s} className={ok ? 'done' : isNext ? 'next' : undefined}>
                  {ok ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />}
                  <span>
                    <b>{t(`onb.s.${s}`)}</b>
                    <small>{isNext ? t('onb.nextHint') : t(`onb.h.${s}`)}</small>
                  </span>
                  {ok ? (
                    <span className="sr-only">{t('onb.done')}</span>
                  ) : (
                    <button
                      type="button"
                      className={`fd-btn fd-btn--sm ${isNext ? 'fd-btn--primary' : 'fd-btn--ghost'}`}
                      onClick={(e) => a.go(e.currentTarget)}
                    >
                      {a.play && <Play aria-hidden="true" />}
                      {a.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="onb-foot">
            <Info aria-hidden="true" />
            <span className="onb-grow">{t(admin ? 'onb.footAdmin' : 'onb.footEditor')}</span>
            <button type="button" className="fd-btn fd-btn--ghost fd-btn--sm" onClick={hide}>
              {t('onb.hide')}
            </button>
          </div>
        </>
      )}
      {tour && <TourDialog tourId={tour.id} title={tour.title} onClose={() => setTour(null)} />}
    </section>
  );
}
