import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { manifestSchema, type Manifest } from '@flowdsiml/manifest';
import { variablesFromSearch, type VariableValues } from '@flowdsiml/core';
import { loadManifest, resolveLink, submitLead, Tracker } from './api';
import { embedAllowed, parseRoute } from './logic';
import { strings } from './i18n';
import { APP_ORIGIN } from './config';
import { Player } from './Player';
import { Ban, Clock, SearchX } from 'lucide-preact';
import '@flowdsiml/player-core/player-core.css';
import './player.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; kind: 'notFound' | 'expired' | 'blocked'; locale: string }
  | {
      status: 'ready';
      manifest: Manifest;
      values: VariableValues;
      linkToken: string | null;
      preview: boolean;
      startQuiz?: boolean;
    };

const inIframe = window.parent !== window;
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
    const fail = (kind: 'notFound' | 'expired' | 'blocked', locale = navigator.language) =>
      !cancelled && setState({ status: 'error', kind, locale });

    async function boot() {
      if (route.kind === 'preview') {
        // Aperçu : le manifeste vient de l'éditeur (origine vérifiée), rien n'est enregistré.
        const onMsg = (e: MessageEvent) => {
          if (e.origin !== APP_ORIGIN || (e.data as { type?: string })?.type !== 'fd:preview') return;
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
      let search = '';
      if (route.kind === 'demo') {
        demoId = route.id;
        search = route.search;
      } else if (route.kind === 'link') {
        const link = await resolveLink(route.token).catch(() => null);
        if (!link) return fail('expired');
        demoId = link.demoId;
        linkVars = link.variables ?? {};
        linkToken = route.token;
        search = route.search;
      } else {
        return fail('notFound');
      }
      const manifest = await loadManifest(demoId).catch(() => null);
      if (!manifest) return fail('notFound');
      if (!embedAllowed(manifest.allowedEmbedOrigins, inIframe, parentOrigin))
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
      if (!cancelled) setState({ status: 'ready', manifest, values, linkToken, preview });
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const tracker = useMemo(
    () =>
      state.status === 'ready'
        ? new Tracker(state.manifest.demoId, state.manifest.versionId, state.linkToken, !state.preview)
        : null,
    [state],
  );

  if (state.status === 'loading') return <div class="p-center">{t.loading}</div>;
  if (state.status === 'error') {
    const e = strings(state.locale.startsWith('en') ? 'en' : 'fr');
    const view = {
      notFound: { Icon: SearchX, title: e.notFoundTitle, text: e.notFound },
      expired: { Icon: Clock, title: e.expiredTitle, text: e.expired },
      blocked: { Icon: Ban, title: e.blockedTitle, text: e.embedBlocked },
    }[state.kind];
    // PLY-06 : cadre du lecteur conservé (en-tête, capture vide, pied), message dans une carte centrée
    return (
      <div class="p-root p-sys">
        <header class="p-top" aria-hidden="true" />
        <main class="p-stage-wrap">
          <div class="p-sys-shot" aria-hidden="true" />
          <div class="p-card p-sys-card" role="alert">
            <span class="p-sys-chip" aria-hidden="true">
              <view.Icon size={22} />
            </span>
            <h1>{view.title}</h1>
            <p class="p-sub">{view.text}</p>
          </div>
        </main>
        <p class="p-branding">{e.madeWith}</p>
      </div>
    );
  }
  const m = state.manifest;
  return (
    <Player
      manifest={m}
      values={state.values}
      tracker={tracker!}
      preview={state.preview}
      startQuiz={state.startQuiz}
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

render(<App />, document.getElementById('root')!);
