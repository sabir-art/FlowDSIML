import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { manifestSchema, type Manifest } from '@flowdsiml/manifest';
import { variablesFromSearch, type VariableValues } from '@flowdsiml/core';
import {
  learnerResume,
  openDemo,
  resolveLink,
  submitLead,
  Tracker,
  type GateInfo,
  type ResumeInfo,
} from './api';
import { ResumeCard, resumable } from './Resume';
import { CenterApp } from './Center';
import { embedAllowed, parseRoute } from './logic';
import { strings } from './i18n';
import { APP_ORIGIN } from './config';
import { Player, type PresentState } from './Player';
import { PasswordGate, StartScreen, SysScreen } from './Gate';
import { PublicPage } from './PublicPage';
import '@flowdsiml/player-core/player-core.css';
import './player.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; kind: 'notFound' | 'expired' | 'blocked'; locale: string; info?: GateInfo }
  | { status: 'gate'; demoId: string; info: GateInfo; open: (r: GateInfo) => void }
  | {
      status: 'ready';
      manifest: Manifest;
      values: VariableValues;
      linkToken: string | null;
      /** L25-13 : ligne du jeu de données choisie pour le lien personnalisé. */
      datasetRow?: number | null;
      /** L26-08 : mesure des visites de l'espace. */
      visitMeasure?: boolean;
      preview: boolean;
      startQuiz?: boolean;
      /** L13 : reprise proposée (« Bon retour ») tant que l'apprenant n'a pas choisi. */
      resume?: ResumeInfo;
      startStep?: number;
      /** L22 : présentation pilotée par l'app (vue présentateur, écran public). */
      present?: PresentState;
      /** L16 : intégration avec démarrage au clic (?start=click), langue imposée (?lang=fr|en). */
      clickToStart?: boolean;
      uiLocale?: 'fr' | 'en';
      /** L19b : lecteur affiché dans la page publique (statistiques « Page publique »). */
      channel?: 'page' | null;
    };

const inIframe = window.parent !== window;
// L16 : intégré (widget bouton + pop-up), Échap non traité par le lecteur ferme la fenêtre hôte :
// le focus est dans l'iframe, la page hôte ne reçoit pas la touche autrement.
if (inIframe)
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Après les gestionnaires du lecteur (menu, pop-up), qui marquent la touche comme traitée
    setTimeout(() => {
      if (!e.defaultPrevented) parent.postMessage({ type: 'tutoclick:escape' }, '*');
    });
  });
const parentOrigin = (() => {
  const a = location.ancestorOrigins?.[0];
  if (a) return a;
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
})();

function App() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const t = strings(navigator.language.startsWith('en') ? 'en' : 'fr');

  useEffect(() => {
    const route = parseRoute(location.hash);
    let cancelled = false;
    const fail = (kind: 'notFound' | 'expired' | 'blocked', locale = navigator.language, info?: GateInfo) =>
      !cancelled && setState({ status: 'error', kind, locale, info });

    async function boot() {
      if (route.kind === 'preview') {
        // Aperçu : le manifeste vient de l'éditeur (origine vérifiée), rien n'est enregistré.
        const onMsg = (e: MessageEvent) => {
          if (e.origin !== APP_ORIGIN) return;
          // L22 : la vue présentateur impose l'étape, l'écran noir et le masquage des points chauds
          if ((e.data as { type?: string })?.type === 'fd:present') {
            const p = e.data as { index?: unknown; black?: unknown; hideHotspots?: unknown };
            const present: PresentState = {
              index: typeof p.index === 'number' ? p.index : 0,
              black: p.black === true,
              hideHotspots: p.hideHotspots === true,
            };
            setState((st) => (st.status === 'ready' ? { ...st, present } : st));
            return;
          }
          if ((e.data as { type?: string })?.type !== 'fd:preview') return;
          const parsed = manifestSchema.safeParse((e.data as { manifest: unknown }).manifest);
          if (parsed.success)
            setState({
              status: 'ready',
              manifest: parsed.data,
              values: variablesFromSearch(
                location.search,
                parsed.data.variables.map((v) => v.key),
              ),
              linkToken: null,
              preview: true,
              // « Tester le quiz » (éditeur) : l'aperçu s'ouvre directement sur le quiz
              startQuiz: (e.data as { startQuiz?: boolean }).startQuiz === true,
            });
        };
        addEventListener('message', onMsg);
        // Aperçu en onglet (opener) ou intégré dans l'éditeur (parent)
        (window.opener ?? (window.parent !== window ? window.parent : null))?.postMessage(
          { type: 'fd:preview-ready' },
          APP_ORIGIN,
        );
        return;
      }
      let demoId: string;
      let linkVars: VariableValues = {};
      let linkToken: string | null = null;
      let linkRow: number | null = null;
      let search = '';
      if (route.kind === 'demo') {
        demoId = route.id;
        search = route.search;
      } else if (route.kind === 'link') {
        const link = await resolveLink(route.token).catch(() => null);
        if (!link) return fail('expired');
        demoId = link.demoId;
        linkVars = link.variables ?? {};
        linkRow = typeof link.datasetRow === 'number' ? link.datasetRow : null;
        linkToken = route.token;
        search = route.search;
      } else {
        return fail('notFound');
      }
      // L13 : reprise d'un apprenant identifié par son lien personnalisé (en parallèle de l'ouverture)
      const resumeP = linkToken ? learnerResume(linkToken, demoId).catch(() => null) : Promise.resolve(null);
      // L11 : l'accès est décidé côté serveur (open-demo), qui sert le manifeste et des images signées
      const gate = await openDemo(demoId);
      const start = async (r: GateInfo) => {
        const manifest = r.manifest;
        if (!manifest) return fail('notFound');
        // L16 : réglages d'intégration (code iframe, widget)
        const q = (k: string) =>
          new URLSearchParams(search).get(k) ?? new URLSearchParams(location.search).get(k);
        // L19b : le lecteur intégré dans la page publique (même origine) n'est pas une intégration tierce
        const onPage = q('ch') === 'page' && parentOrigin === location.origin;
        if (!onPage && !embedAllowed(manifest.allowedEmbedOrigins, inIframe, parentOrigin))
          return fail('blocked', manifest.locale);
        document.title = manifest.title;
        document.documentElement.lang = manifest.locale;
        const keys = manifest.variables.map((v) => v.key);
        // Priorité : URL (?company=…) > lien personnalisé > valeurs par défaut
        const values = {
          ...linkVars,
          ...variablesFromSearch(search, keys),
          ...variablesFromSearch(location.search, keys),
        };
        // P12 : « Ouvrir l'aperçu » depuis l'app (?preview=1) n'enregistre pas de statistiques
        const preview = [search, location.search].some((q) => new URLSearchParams(q).get('preview') === '1');
        const resume = preview ? null : await resumeP;
        const lang = q('lang');
        if (!cancelled)
          setState({
            status: 'ready',
            channel: onPage ? 'page' : null,
            manifest,
            values,
            linkToken,
            datasetRow: linkRow,
            visitMeasure: r.visitMeasure !== false,
            preview,
            resume: resumable(resume) ? resume : undefined,
            clickToStart: q('start') === 'click' && !preview,
            uiLocale: lang === 'fr' || lang === 'en' ? lang : undefined,
          });
      };
      if (gate.status === 'ok') return void start(gate);
      if (gate.status === 'expired' || gate.status === 'unavailable')
        return fail('expired', navigator.language, gate);
      if (
        gate.status === 'password_required' ||
        gate.status === 'password_wrong' ||
        gate.status === 'locked'
      ) {
        if (gate.title) document.title = gate.title;
        if (!cancelled) setState({ status: 'gate', demoId, info: gate, open: (r) => void start(r) });
        return;
      }
      return fail('notFound');
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // L11 : les URL d'images signées valent 1 h ; on les renouvelle avant (sessions longues), sans
  // recharger la démo (les adresses sont remplacées sur place, l'étape en cours ne bouge pas).
  useEffect(() => {
    if (state.status !== 'ready') return;
    const m = state.manifest;
    if (!m.steps.some((st) => st.image?.url.includes('/object/sign/'))) return;
    const id = setInterval(
      () => {
        void openDemo(m.demoId).then((r) => {
          if (r.status !== 'ok' || !r.manifest) return;
          const fresh = new Map(r.manifest.steps.map((st) => [st.id, st.image?.url]));
          for (const st of m.steps) {
            const u = fresh.get(st.id);
            if (st.image && u) st.image.url = u;
          }
        });
      },
      50 * 60 * 1000,
    );
    return () => clearInterval(id);
  }, [state]);

  const tracker = useMemo(
    () =>
      state.status === 'ready'
        ? Object.assign(
            new Tracker(state.manifest.demoId, state.manifest.versionId, state.linkToken, !state.preview, {
              workspaceId: state.manifest.workspaceId,
              measure: state.visitMeasure !== false && !state.preview,
            }),
            { channel: state.channel ?? null },
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.status === 'ready' ? state.manifest : null],
  );

  if (state.status === 'loading') return <div class="p-center">{t.loading}</div>;
  if (state.status === 'error')
    return <SysScreen kind={state.kind} locale={state.locale} info={state.info} />;
  if (state.status === 'gate')
    return (
      <PasswordGate demoId={state.demoId} locale={navigator.language} info={state.info} onOpen={state.open} />
    );
  const m = state.manifest;
  if (state.clickToStart)
    return (
      <StartScreen
        t={strings(state.uiLocale ?? (m.locale === 'en' ? 'en' : 'fr'))}
        title={m.title}
        workspace={m.workspaceName}
        onStart={() => setState({ ...state, clickToStart: false })}
      />
    );
  if (state.resume) {
    const resume = state.resume;
    return (
      <ResumeCard
        t={t}
        info={resume}
        title={m.title}
        workspace={m.workspaceName}
        onResume={() => setState({ ...state, resume: undefined, startStep: resume.module!.seen })}
        onRestart={() => setState({ ...state, resume: undefined, startStep: 0 })}
      />
    );
  }
  return (
    <Player
      manifest={m}
      values={state.values}
      datasetRowIndex={state.datasetRow ?? null}
      tracker={tracker!}
      preview={state.preview}
      startQuiz={state.startQuiz}
      startStep={state.startStep}
      present={state.present}
      uiLocale={state.uiLocale}
      measureInfo={!state.preview && !state.present && state.visitMeasure !== false}
      onLead={async (_form, data) => {
        if (state.preview) return;
        await submitLead({
          demoId: m.demoId,
          versionId: m.versionId,
          email: data.email,
          fields: data.fields,
          consent: data.consent,
          visitorId: tracker!.visitorId,
          linkToken: state.linkToken,
        });
      }}
    />
  );
}

// L14 : le centre de formation a sa propre page ; passer du centre à un module (ou l'inverse) recharge
// le lecteur, qui ne démarre qu'une fois par chargement. La navigation interne au centre ne recharge pas.
const first = parseRoute(location.hash);
addEventListener('hashchange', () => {
  const next = parseRoute(location.hash);
  const sameCenter = first.kind === 'center' && next.kind === 'center' && next.slug === first.slug;
  if (!sameCenter) location.reload();
});
render(
  first.kind === 'center' ? (
    <CenterApp route={first} />
  ) : first.kind === 'page' ? (
    <PublicPage id={first.id} code={first.code} />
  ) : (
    <App />
  ),
  document.getElementById('root')!,
);
