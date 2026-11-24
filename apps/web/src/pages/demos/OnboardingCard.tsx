/**
 * ONB-01 (COMP-01 §17, variante B « étape suivante ») : la prise en main sort du flux de la page Démos.
 * Un bouton « Prise en main 2/7 » avec son anneau, dans le PageHeader, ouvre un panneau à droite qui
 * partage l'espace avec la page (tiroir par la droite sous 1 024 px). Le panneau montre la prochaine étape
 * en grand, puis « À faire ensuite » en lignes, puis « Terminées » replié.
 * 7 étapes cochées automatiquement (calculées côté serveur : workspace_onboarding). Propriétaires et
 * administrateurs voient les 7 étapes, éditeurs les étapes 3 à 5, lecteurs rien. Quand tout est fait, le
 * bouton passe à « n/n » et le panneau dit « Votre espace est prêt », pendant 7 jours ou jusqu'à
 * « Masquer » ; puis ils disparaissent. « Reprendre la prise en main » reste dans l'aide.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  EyeOff,
  Info,
  Palette,
  Play,
  Puzzle,
  Rocket,
  Send,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useHelp } from '../../help/HelpProvider';
import { TourDialog } from '../../help/TourDialog';
import { MODULE_TOUR, loadTours } from '../../help/tours';
import { EXTENSION_URL } from '../../lib/env';
import { modalOnTop } from '../../lib/modalOnTop';

const STEPS = ['brand', 'extension', 'capture', 'pii', 'publish', 'invite', 'distribute'] as const;
type Step = (typeof STEPS)[number];
const EDITOR_STEPS: Step[] = ['capture', 'pii', 'publish'];
const ICONS: Record<Step, LucideIcon> = {
  brand: Palette,
  extension: Puzzle,
  capture: Camera,
  pii: EyeOff,
  publish: Rocket,
  invite: UserPlus,
  distribute: Send,
};

interface State {
  steps: Record<Step, boolean>;
  doneAt: string | null;
  hiddenAt: string | null;
}

/**
 * État de la prise en main, chargé par la page Démos avant son premier affichage (la carte arrive en
 * même temps que la liste : aucun saut de mise en page).
 */
export function useOnboarding({ deferred = false }: { deferred?: boolean } = {}) {
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
  // L32 : la page Démos fournit l'état reçu avec sa requête de démarrage (deferred), sans requête à part
  useEffect(() => {
    if (!deferred) load();
  }, [load, deferred]);
  const provide = useCallback(
    (data: unknown) => {
      if (data === undefined) return load();
      setState((data as State | null) ?? null);
      setReady(true);
    },
    [load],
  );
  // « Reprendre la prise en main » depuis l'aide
  useEffect(() => {
    addEventListener('fd:onboarding', load);
    return () => removeEventListener('fd:onboarding', load);
  }, [load]);
  return { state, setState, ready, provide };
}
export type Onboarding = ReturnType<typeof useOnboarding>;

/** Durée d'affichage de l'état terminé après le dernier pas (jours). */
const DONE_DAYS = 7;

/** §18.4 : extension pas encore publiée, l'étape est en « Bientôt » (ni action, ni compte). */
const isSoon = (s: Step) => s === 'extension' && !EXTENSION_URL;

/**
 * Étapes visibles pour la personne, et avancement ; null si la prise en main ne la concerne pas.
 * Une étape « Bientôt » reste affichée mais sort du total : n/6 tant que l'extension n'est pas disponible.
 */
export function onboardingProgress(state: State | null, admin: boolean, editor: boolean) {
  if (!state || !editor) return null;
  const visible: Step[] = admin ? [...STEPS] : EDITOR_STEPS;
  const counted = visible.filter((s) => !isSoon(s));
  const done = counted.filter((s) => state.steps[s]);
  const complete = done.length === counted.length;
  // État terminé : « Votre espace est prêt » reste proposé 7 jours, ou jusqu'à « Masquer »
  const fresh = !state.doneAt || Date.now() - Date.parse(state.doneAt) < DONE_DAYS * 864e5;
  const finished = complete && !state.hiddenAt && fresh;
  return { visible, done, n: done.length, total: counted.length, complete, finished };
}

/**
 * Préférence « panneau ouvert », gardée par personne et par espace. Sans choix encore fait, le panneau
 * s'ouvre si `defaultOpen` (première visite d'un espace tout neuf par son propriétaire ou un admin).
 */
export function useOnboardingOpen(wsId: string, defaultOpen: boolean) {
  const key = `fd.onb.open.${wsId}`;
  const [choice, setOpenState] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? null : v === '1';
    } catch {
      return null;
    }
  });
  const open = choice ?? defaultOpen;
  // La première ouverture par défaut devient le choix gardé
  useEffect(() => {
    if (choice !== null || !defaultOpen) return;
    setOpenState(true);
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* préférence non gardée */
    }
  }, [choice, defaultOpen, key]);
  const setOpen = useCallback(
    (v: boolean) => {
      setOpenState(v);
      try {
        localStorage.setItem(key, v ? '1' : '0');
      } catch {
        /* préférence non gardée */
      }
    },
    [key],
  );
  // « Reprendre la prise en main » depuis l'aide : le panneau s'ouvre (même quand tout est fait)
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    const on = () => {
      setResumed(true);
      setOpen(true);
    };
    addEventListener('fd:onboarding', on);
    return () => removeEventListener('fd:onboarding', on);
  }, [setOpen]);
  return [open, setOpen, resumed] as const;
}

/** Anneau de progression de 18 px (décoratif : le nombre est dans le libellé du bouton). */
function Ring({ n, total }: { n: number; total: number }) {
  const c = 2 * Math.PI * 7;
  return (
    <svg className="onb-ring" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7" fill="none" stroke="var(--fd-color-border)" strokeWidth="2.5" />
      {n > 0 && (
        <circle
          cx="9"
          cy="9"
          r="7"
          fill="none"
          stroke="var(--fd-color-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${(n / total) * c} ${c}`}
          transform="rotate(-90 9 9)"
        />
      )}
    </svg>
  );
}

/** Point d'entrée dans le PageHeader : « Prise en main 2/7 » (l'anneau seul, 44 px, sous 1 024 px). */
export function OnboardingButton({
  onb,
  open,
  onToggle,
}: {
  onb: Onboarding;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const admin = current?.role === 'owner' || current?.role === 'admin';
  const p = onboardingProgress(onb.state, admin, can('demo.edit'));
  // Tout est fait : la pastille reste en « n/n » tant que l'état terminé est proposé, puis disparaît
  if (!p || (p.complete && !p.finished)) return null;
  return (
    <button
      type="button"
      id="onb-toggle"
      className={`fd-btn onb-btn${open ? ' is-open' : ''}${p.complete ? ' is-done' : ''}`}
      aria-expanded={open}
      aria-controls={open ? 'onb-panel' : undefined}
      onClick={onToggle}
    >
      <Ring n={p.n} total={p.total} />
      <span className="onb-btn__t">{t('onb.button')}</span>
      {/* Le nom accessible reprend le texte visible (« Prise en main 3/7 »), suivi de sa lecture en clair */}
      <span className="onb-btn__n">{`${p.n}/${p.total}`}</span>
      <span className="sr-only">{t('onb.buttonHint', { count: p.n, total: p.total })}</span>
    </button>
  );
}

export function OnboardingPanel({
  onb,
  drawer,
  onClose,
  onCapture,
  latestDemoId,
  publishedDemoId,
}: {
  onb: Onboarding;
  /** Sous 1 024 px : tiroir modal par la droite. */
  drawer: boolean;
  onClose: () => void;
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
  const { state } = onb;
  // « Masquer la prise en main » : préférence de la personne pour cet espace ; la pastille disparaît
  const hide = async () => {
    const hiddenAt = new Date().toISOString();
    await supabase
      .from('onboarding_prefs')
      .upsert({ workspace_id: ws.id, hidden_at: hiddenAt }, { onConflict: 'user_id,workspace_id' });
    onb.setState((cur) => (cur ? { ...cur, hiddenAt } : cur));
    onClose();
  };
  const [tour, setTour] = useState<{ id: string; title: string } | null>(null);
  // « Terminées » : repliée pendant la prise en main, dépliée quand tout est fait (choix gardé ensuite)
  const [doneChoice, setShowDone] = useState<boolean | null>(null);
  const panel = useRef<HTMLElement>(null);

  // Tiroir : focus dans le panneau à l'ouverture, piégé ; Échap ferme et rend le focus au bouton d'entrée
  useEffect(() => {
    if (!drawer) return;
    const el = panel.current;
    el?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Une fenêtre modale ouverte par-dessus (« Nouvelle démo ») garde Échap et Tab
      if (modalOnTop()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>('button, a[href]')].filter(
        (x) => !x.hasAttribute('disabled'),
      );
      const first = f[0];
      const last = f[f.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.getElementById('onb-toggle')?.focus();
    };
  }, [drawer, onClose]);

  const p = onboardingProgress(state, admin, can('demo.edit'));
  if (!p || !state) return null;

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
  const soon = isSoon;
  // Une étape « Bientôt » n'est jamais cochée ni proposée : elle vient en dernier, en gris
  const todo = p.visible.filter((s) => !soon(s) && !state.steps[s]);
  const next = todo[0] ?? null;
  const later = [...todo.slice(1), ...p.visible.filter(soon)];
  const NextIcon = next ? ICONS[next] : null;
  const nextAction = next ? action(next) : null;

  const showDone = doneChoice ?? p.complete;
  const content = (
    <aside
      ref={panel}
      id="onb-panel"
      className={`onb-panel${drawer ? ' onb-panel--drawer' : ''}`}
      aria-labelledby="onb-t"
      role={drawer ? 'dialog' : undefined}
      aria-modal={drawer ? true : undefined}
    >
      <div className="onb-panel__head">
        <h2 id="onb-t">{t('onb.panelTitle')}</h2>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
          aria-label={t('onb.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div
        className="onb-bar"
        role="progressbar"
        aria-label={t('onb.title')}
        aria-valuemin={0}
        aria-valuemax={p.total}
        aria-valuenow={p.n}
        aria-valuetext={t('onb.valuetext', { count: p.n, total: p.total })}
      >
        <span style={{ width: `${(p.n / p.total) * 100}%` }} />
      </div>
      {!p.complete && <p className="onb-panel__sub">{t('onb.sub', { count: p.n, total: p.total })}</p>}

      {p.complete && (
        // §9 (retours client du 24/11) : carte de succès, puis « Masquer la prise en main »
        <div className="onb-fin" role="status" data-gap-exempt="">
          <span className="onb-tile onb-tile--ok" aria-hidden="true">
            <CircleCheck />
          </span>
          <b>{t('onb.finTitle')}</b>
          <span className="onb-fin__t">{t('onb.finBody', { total: p.total })}</span>
          <button type="button" className="fd-btn fd-btn--primary fd-btn--sm" onClick={() => void hide()}>
            {t('onb.hide')}
          </button>
          <span className="onb-fin__h">{t('onb.finHint')}</span>
        </div>
      )}
      {next && NextIcon && nextAction && (
        // §18.6 : carte de l'étape conseillée, écarts internes de 6 px (maquette onb-b)
        <div className="onb-next" data-gap-exempt="">
          <span className="onb-next__k">{t('onb.nextKicker')}</span>
          <span className="onb-tile" aria-hidden="true">
            <NextIcon />
          </span>
          <b>{t(`onb.s.${next}`)}</b>
          <span className="onb-next__h">{t(`onb.h.${next}`)}</span>
          <button
            type="button"
            className="fd-btn fd-btn--primary"
            onClick={(e) => nextAction.go(e.currentTarget)}
          >
            {nextAction.play && <Play aria-hidden="true" />}
            {nextAction.label}
          </button>
        </div>
      )}

      {later.length > 0 && (
        <>
          {/* Il ne reste que des étapes « Bientôt » : la section ne se présente plus comme une tâche */}
          <h3 className="onb-h3">
            {t(later.every(isSoon) ? 'onb.soonOnly' : 'onb.todo')}{' '}
            <span className="onb-n">{later.length}</span>
          </h3>
          {/* §18.6 : lignes à filets de 44 px, l'écart est porté par leur hauteur */}
          <ul className="onb-rows" data-gap-exempt="">
            {later.map((s) => {
              const Icon = ICONS[s];
              const a = action(s);
              return (
                <li key={s}>
                  {soon(s) ? (
                    <div className="onb-row">
                      <span className="onb-tile onb-tile--sm" aria-hidden="true">
                        <Icon />
                      </span>
                      <b>{t(`onb.s.${s}`)}</b>
                      <span className="onb-soon">{t('shell.soon')}</span>
                    </div>
                  ) : (
                    <button type="button" className="onb-row" onClick={(e) => a.go(e.currentTarget)}>
                      <span className="onb-tile onb-tile--sm" aria-hidden="true">
                        <Icon />
                      </span>
                      <b>{t(`onb.s.${s}`)}</b>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {p.n > 0 && (
        <>
          <button
            type="button"
            className="onb-done"
            aria-expanded={showDone}
            aria-controls={showDone ? 'onb-done-list' : undefined}
            onClick={() => setShowDone(!showDone)}
          >
            {showDone ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
            {t('onb.doneList')} <span className="onb-n">{p.n}</span>
          </button>
          {showDone && (
            <ul id="onb-done-list" className="onb-rows onb-rows--done" data-gap-exempt="">
              {p.done.map((s) => (
                <li key={s}>
                  <div className="onb-row">
                    <CircleCheck aria-hidden="true" />
                    <b>{t(`onb.s.${s}`)}</b>
                    <span className="sr-only">{t('onb.done')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="onb-panel__foot">
        <Info aria-hidden="true" />
        <span>{t(admin ? 'onb.footShort' : 'onb.footEditor')}</span>
      </div>
      {tour && <TourDialog tourId={tour.id} title={tour.title} onClose={() => setTour(null)} />}
    </aside>
  );
  if (!drawer) return content;
  return (
    <div className="onb-sheet" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {content}
    </div>
  );
}
