import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { manifestSchema, type Manifest } from '@flowdsiml/manifest';
import { variablesFromSearch, type VariableValues } from '@flowdsiml/core';
import { openDemo, resolveLink, submitLead, Tracker, type GateInfo } from './api';
import { embedAllowed, parseRoute } from './logic';
import { strings } from './i18n';
import { APP_ORIGIN } from './config';
import { Player } from './Player';
import { PasswordGate, SysScreen } from './Gate';
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
    const fail = (kind: 'notFound' | 'expired' | 'blocked', locale = navigator.language, info?: GateInfo) =>
      !cancelled && setState({ status: 'error', kind, locale, info });

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
      // L11 : l'accès est décidé côté serveur (open-demo), qui sert le manifeste et des images signées
      const gate = await openDemo(demoId);
      const start = (r: GateInfo) => {
        const manifest = r.manifest;
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
      };
      if (gate.status === 'ok') return start(gate);
      if (gate.status === 'expired' || gate.status === 'unavailable')
        return fail('expired', navigator.language, gate);
      if (
        gate.status === 'password_required' ||
        gate.status === 'password_wrong' ||
        gate.status === 'locked'
      ) {
        if (gate.title) document.title = gate.title;
        if (!cancelled) setState({ status: 'gate', demoId, info: gate, open: start });
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
        ? new Tracker(state.manifest.demoId, state.manifest.versionId, state.linkToken, !state.preview)
        : null,
    [state],
  );

  if (state.status === 'loading') return <div class="p-center">{t.loading}</div>;
  if (state.status === 'error')
    return <SysScreen kind={state.kind} locale={state.locale} info={state.info} />;
  if (state.status === 'gate')
    return (
      <PasswordGate demoId={state.demoId} locale={navigator.language} info={state.info} onOpen={state.open} />
    );
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
