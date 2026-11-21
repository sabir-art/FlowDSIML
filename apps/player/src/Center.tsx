import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  ArrowRight,
  Award,
  BookOpen,
  ChevronRight,
  Clock,
  Code,
  Download,
  Key,
  Mail,
  Search,
  User,
  X,
} from 'lucide-preact';
import { centerLinkToken, issueCertificate, openCenter, type CenterGateInfo } from './api';
import { centerModuleHref } from './CenterNext';
import {
  currentPath,
  demoSections,
  demoTagCounts,
  filterDemos,
  filterPaths,
  highlight,
  pathView,
  pathTags,
  themeVars,
  DEFAULT_BRAND,
  type CenterData,
  type CenterDemo,
  type CenterPath,
  type PathView,
} from './center';
import { brandingUrl } from './config';
import { fmt, strings, type Dict } from './i18n';
import { PasswordGate, SysScreen } from './Gate';
import { initials, useMedia } from './Player';
import './center.css';

type Route = { slug: string; pathId: string | null; params: URLSearchParams };
type C = Record<string, string>;

const TAG_CLASS: Record<string, string> = {
  blue: 'b',
  green: 'v',
  orange: 'o',
  raspberry: 'f',
  plum: 'p',
};
const tagCls = (color: string) => TAG_CLASS[color] ?? 'b';

const frDate = (iso: string) =>
  new Intl.DateTimeFormat(navigator.language.startsWith('en') ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(iso));

/** Lien interne au centre (le jeton du lien personnel reste en session, jamais dans l'adresse). */
const centerHref = (slug: string, pathId?: string, params?: Record<string, string>) => {
  const q = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v)).toString();
  return `#/c/${slug}${pathId ? `/f/${pathId}` : ''}${q ? `?${q}` : ''}`;
};
const moduleHref = (demoId: string) => `#/d/${demoId}`;

function Hl({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlight(text, q).map((s, i) =>
        s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

function Tag({ name, color, q = '' }: { name: string; color: string; q?: string }) {
  const k = tagCls(color);
  return (
    <span class={`tg tg--${k}`}>
      <span class={`dot dot--${k}`} aria-hidden="true" />
      <Hl text={name} q={q} />
    </span>
  );
}

/** L14 : centre de formation public (#/c/<slug>, #/c/<slug>/f/<formation>). */
export function CenterApp({ route }: { route: Route }) {
  const t = strings(navigator.language.startsWith('en') ? 'en' : 'fr');
  const c = t.center as unknown as C;
  const [token] = useState(() => centerLinkToken(route.slug, route.params.get('l')));
  const [state, setState] = useState<CenterGateInfo | null>(null);
  const [r, setR] = useState(route);

  useEffect(() => {
    let alive = true;
    void openCenter(route.slug, token).then((x) => alive && setState(x));
    return () => {
      alive = false;
    };
  }, [route.slug, token]);
  // Navigation interne (recherche, étiquette, page d'une formation) sans recharger les données
  useEffect(() => {
    const on = () => {
      const h = location.hash.replace(/^#/, '');
      const [path = '', search = ''] = h.split('?');
      const parts = path.split('/').filter(Boolean);
      if (parts[0] !== 'c' || parts[1] !== route.slug) return;
      setR({
        slug: route.slug,
        pathId: parts[2] === 'f' ? (parts[3] ?? null) : null,
        params: new URLSearchParams(search),
      });
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, [route.slug]);
  // Le jeton du lien personnel ne reste pas dans l'adresse (partage d'écran, historique)
  useEffect(() => {
    if (route.params.has('l')) {
      const p = new URLSearchParams(route.params);
      p.delete('l');
      history.replaceState(
        null,
        '',
        centerHref(route.slug, route.pathId ?? undefined, Object.fromEntries(p)),
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state?.status !== 'ok' || !state.center) return;
    // A11Y-15 : page d'une formation → « {{formation}} · {{titre du centre}} »
    const site = state.center.title || state.center.workspace;
    const path = r.pathId ? state.paths?.find((x) => x.id === r.pathId) : undefined;
    document.title = path ? `${path.title} · ${site}` : site;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = state.center.indexable ? 'index, follow' : 'noindex, nofollow';
  }, [state, r.pathId]);

  if (!state) return <div class="p-center">{c.loading}</div>;
  if (state.status === 'password_required' || state.status === 'password_wrong' || state.status === 'locked')
    return (
      <PasswordGate
        demoId=""
        locale={navigator.language}
        info={state}
        onOpen={(x) => setState(x as CenterGateInfo)}
        submitPassword={(pw) => openCenter(route.slug, token, pw)}
      />
    );
  if (state.status !== 'ok' || !state.center || !state.paths)
    return <SysScreen kind="notFound" locale={navigator.language} />;
  return <Center t={t} data={state as CenterData} route={r} token={token} />;
}

function Center({
  t,
  data,
  route,
  token,
}: {
  t: Dict;
  data: CenterData;
  route: Route;
  token: string | null;
}) {
  const c = t.center as unknown as C;
  const info = data.center;
  const identified = !!data.visitor;
  const views = useMemo(() => data.paths.map((p) => pathView(p, identified)), [data, identified]);
  // Sombre : style « Sombre », ou préférence de l'appareil (sauf « Contraste renforcé »). Comme dans le
  // lecteur, une couleur principale propre au workspace est gardée ; seules les couleurs par défaut passent en sombre.
  const prefersDark = useMedia('(prefers-color-scheme: dark)');
  const dark = info.style === 'dark' || (prefersDark && info.style !== 'contrast');
  const customBrand =
    info.style === 'workspace' && !!info.brand && info.brand.toUpperCase() !== DEFAULT_BRAND;
  const style = info.style;
  const vars = dark && !customBrand ? themeVars({ ...info, style: 'dark' }) : themeVars(info);
  const a11y =
    info.kind === 'demo' && info.a11y === 'non_evalue'
      ? c.demoA11yNone // A8 : « non conforme » par défaut, jamais « partiellement » sans audit
      : (c[`a11y_${info.a11y}`] ?? c.a11y_non_evalue);
  const help = info.help ? (info.help.includes('@') ? `mailto:${info.help}` : info.help) : null;
  // A8 : Demo Center (démos ouvertes, sans compte ni progression)
  const demoCenter = info.kind === 'demo';

  return (
    <div class={`ctr ctr--${style}`} data-theme={dark ? 'dark' : undefined} style={vars}>
      <header class="ctr-top">
        {info.logoPath ? (
          <img
            class="ctr-logo ctr-logo--img"
            src={brandingUrl(info.logoPath)}
            alt=""
            width={40}
            height={40}
          />
        ) : (
          <span class="ctr-logo" aria-hidden="true">
            {initials(info.workspace)}
          </span>
        )}
        <a class="nm" href={centerHref(route.slug)}>
          <b>{info.workspace}</b>
          <small>{demoCenter ? c.demoSub : c.sub}</small>
        </a>
        {demoCenter && info.cta?.url && (
          <span class="sp">
            <a class="ctr-contact" href={info.cta.url} target="_blank" rel="noopener noreferrer">
              {info.cta.label || c.demoContact}
            </a>
          </span>
        )}
        {data.visitor && (
          <span class="sp">
            <span class="who">{data.visitor.firstName}</span>
            <span class="ctr-av" aria-hidden="true">
              {initials(data.visitor.firstName)}
            </span>
          </span>
        )}
      </header>
      {demoCenter ? (
        <DemoHome t={t} data={data} route={route} />
      ) : route.pathId ? (
        <PathPage t={t} data={data} views={views} route={route} token={token} />
      ) : data.paths.length === 0 ? (
        <main class="ctr-in" id="ctr-main">
          <div class="ctr-hero ctr-hero--one">
            <div>
              <h1>{info.title || info.workspace}</h1>
              {info.intro && <p>{info.intro}</p>}
            </div>
          </div>
          <div class="ctr-empty" role="status">
            <span class="ic" aria-hidden="true">
              <BookOpen />
            </span>
            <h2>{c.emptyTitle}</h2>
            <p>{fmt(c, 'emptyText', { ws: info.workspace })}</p>
            {help && (
              <div class="acts">
                <a class="cta cta--sec" href={help}>
                  <Mail aria-hidden="true" />
                  {c.help}
                </a>
              </div>
            )}
          </div>
        </main>
      ) : (
        <Home t={t} data={data} views={views} route={route} />
      )}
      <footer class="ctr-foot">
        <span>{info.workspace}</span>
        {info.a11yUrl ? <a href={info.a11yUrl}>{a11y}</a> : <span>{a11y}</span>}
        {info.privacyUrl && <a href={info.privacyUrl}>{c.privacy}</a>}
        {help && <a href={help}>{c.help}</a>}
        <span>{t.madeWith}</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accueil (L14-01 à L14-04)
// ---------------------------------------------------------------------------
function Home({ t, data, views, route }: { t: Dict; data: CenterData; views: PathView[]; route: Route }) {
  const c = t.center as unknown as C;
  const q = route.params.get('q') ?? '';
  const tag = route.params.get('tag') ?? '';
  const [input, setInput] = useState(q);
  const timer = useRef<number>();
  useEffect(() => setInput(q), [q]);
  const go = (next: { q?: string; tag?: string }) => {
    const params = { q: next.q ?? q, tag: next.tag ?? tag };
    history.replaceState(null, '', centerHref(route.slug, undefined, params));
    dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const onInput = (v: string) => {
    setInput(v);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go({ q: v.trim() }), 250);
  };
  const shown = filterPaths(data.paths, q, tag);
  const shownViews = views.filter((v) => shown.includes(v.path));
  const tags = pathTags(data.paths);
  const me = currentPath(views);
  const filtering = !!(q || tag);
  const totalModules = data.paths.reduce((s, p) => s + p.modules.length, 0);

  return (
    <main class="ctr-in" id="ctr-main">
      <div class="ctr-hero">
        <div>
          <h1>{data.center.title || data.center.workspace}</h1>
          {data.center.intro && <p>{data.center.intro}</p>}
          <div class="ctr-search" role="search">
            <Search aria-hidden="true" />
            <input
              class="q"
              type="search"
              aria-label={c.searchLabel}
              placeholder={c.searchPlaceholder}
              value={input}
              onInput={(e) => onInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && (clearTimeout(timer.current), go({ q: input.trim() }))}
            />
            {input && (
              <button
                class="clr"
                type="button"
                aria-label={c.clearSearch}
                onClick={() => (setInput(''), go({ q: '' }))}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {me ? (
          <aside class="ctr-me" aria-label={c.meLabel}>
            <span class="lbl">{fmt(c, 'meTitle', { path: me.path.title })}</span>
            <b class="big">
              {me.validated} / {me.total}
            </b>
            <span>{fmt(c, 'meCount', { count: me.validated })}</span>
            <span
              class="track"
              role="img"
              aria-label={fmt(c, 'meAria', { pct: Math.round((me.validated / Math.max(1, me.total)) * 100) })}
            >
              <span style={{ width: `${(me.validated / Math.max(1, me.total)) * 100}%` }} />
            </span>
            {/* MOB-01 M9 : le module en texte au-dessus, puis le bouton « Reprendre » (couleur du thème) */}
            {me.next && (
              <>
                <span class="nx" id="ctr-me-next">
                  {fmt(c, 'nextModule', { module: me.next.title })}
                </span>
                <a
                  href={centerModuleHref(me.next.demoId, { slug: route.slug, pathId: me.path.id })}
                  aria-describedby="ctr-me-next"
                >
                  {c.resume}
                  <ArrowRight aria-hidden="true" />
                </a>
              </>
            )}
          </aside>
        ) : !data.visitor ? (
          <aside class="ctr-anon" aria-label={c.anonLabel}>
            <span class="ic" aria-hidden="true">
              <User />
            </span>
            <b>{c.anonTitle}</b>
            <span>{c.anonText}</span>
            <span>{c.anonText2}</span>
          </aside>
        ) : null}
      </div>

      {tags.length > 0 && (
        <div class="ctr-tags" role="group" aria-label={c.tagsLabel}>
          <button type="button" aria-pressed={!tag} onClick={() => go({ tag: '' })}>
            {c.all}
          </button>
          {tags.map((x) => (
            <button
              key={x.name}
              type="button"
              aria-pressed={tag === x.name}
              onClick={() => go({ tag: tag === x.name ? '' : x.name })}
            >
              {x.name}
            </button>
          ))}
        </div>
      )}

      {filtering ? (
        shown.length > 0 && (
          <div class="ctr-res" role="status">
            <span>
              <b>{fmt(c, 'resultQ', { count: shown.length })}</b>
              {q && ` ${fmt(c, 'forQuery', { q })}`}
              {tag && ` ${fmt(c, 'withTag', { tag })}`}
            </span>
            <button class="ctr-link" type="button" onClick={() => (setInput(''), go({ q: '', tag: '' }))}>
              {c.clearFilters}
            </button>
          </div>
        )
      ) : (
        <h2 class="ctr-h2">
          {c.listTitle}{' '}
          <small>
            {fmt(c, 'listCount', {
              paths: fmt(c, 'paths', { count: data.paths.length }),
              modules: fmt(c, 'modules', { count: totalModules }),
            })}
          </small>
        </h2>
      )}

      {shown.length === 0 ? (
        <div class="ctr-empty" role="status">
          <span class="ic" aria-hidden="true">
            <Search />
          </span>
          <h2>{q ? fmt(c, 'noResult', { q }) : fmt(c, 'noResultTag', { tag })}</h2>
          <p>{c.noResultHelp}</p>
          <div class="acts">
            <button
              class="cta"
              type="button"
              onClick={() => (setInput(''), go(q ? { q: '' } : { q: '', tag: '' }))}
            >
              {q ? c.clearSearch : c.clearFilters}
            </button>
          </div>
        </div>
      ) : (
        <div class="ctr-grid">
          {shownViews.map((v) => (
            <PathCard key={v.path.id} c={c} v={v} q={q} href={centerHref(route.slug, v.path.id)} />
          ))}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// A8 (L20-03) : Demo Center
// ---------------------------------------------------------------------------
function DemoHome({ t, data, route }: { t: Dict; data: CenterData; route: Route }) {
  const c = t.center as unknown as C;
  const info = data.center;
  const demos = data.demos ?? [];
  const q = route.params.get('q') ?? '';
  const tag = route.params.get('tag') ?? '';
  const [input, setInput] = useState(q);
  const timer = useRef<number>();
  useEffect(() => setInput(q), [q]);
  const go = (next: { q?: string; tag?: string }) => {
    history.replaceState(
      null,
      '',
      centerHref(route.slug, undefined, { q: next.q ?? q, tag: next.tag ?? tag }),
    );
    dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const shown = filterDemos(demos, q, tag);
  const tags = demoTagCounts(demos);
  const sections = demoSections(shown);
  return (
    <main class="ctr-in" id="ctr-main">
      <div class="ctr-hero ctr-hero--one">
        <div>
          <h1>{info.heroTitle || c.demoHero}</h1>
          <p>{info.heroSubtitle || c.demoIntro}</p>
          <div class="ctr-search" role="search">
            <Search aria-hidden="true" />
            <input
              class="q"
              type="search"
              aria-label={c.demoSearchLabel}
              placeholder={c.demoSearchPlaceholder}
              value={input}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setInput(v);
                clearTimeout(timer.current);
                timer.current = window.setTimeout(() => go({ q: v.trim() }), 250);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (clearTimeout(timer.current), go({ q: input.trim() }))}
            />
            {input && (
              <button
                class="clr"
                type="button"
                aria-label={c.clearSearch}
                onClick={() => (setInput(''), go({ q: '' }))}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
      {tags.length > 0 && (
        <div class="ctr-tags" role="group" aria-label={c.demoFilterLabel}>
          <button type="button" aria-pressed={!tag} onClick={() => go({ tag: '' })}>
            {c.all}
          </button>
          {tags.map((x) => (
            <button
              key={x.name}
              type="button"
              aria-pressed={tag === x.name}
              onClick={() => go({ tag: tag === x.name ? '' : x.name })}
            >
              {x.name}
            </button>
          ))}
        </div>
      )}
      {(q || tag) && shown.length > 0 && (
        <div class="ctr-res" role="status">
          <span>
            <b>{fmt(c, 'demoResult', { count: shown.length })}</b>
            {q && ` ${fmt(c, 'forQuery', { q })}`}
            {tag && ` ${fmt(c, 'withTag', { tag })}`}
          </span>
          <button class="ctr-link" type="button" onClick={() => (setInput(''), go({ q: '', tag: '' }))}>
            {c.clearFilters}
          </button>
        </div>
      )}
      {shown.length === 0 ? (
        <div class="ctr-empty" role="status">
          <span class="ic" aria-hidden="true">
            {demos.length ? <Search /> : <Code />}
          </span>
          <h2>
            {!demos.length ? c.demoNone : q ? fmt(c, 'noResult', { q }) : fmt(c, 'noResultTag', { tag })}
          </h2>
          {demos.length > 0 && (
            <div class="acts">
              <button class="cta" type="button" onClick={() => (setInput(''), go({ q: '', tag: '' }))}>
                {c.clearFilters}
              </button>
            </div>
          )}
        </div>
      ) : (
        sections.map((sec, i) => (
          <section key={sec.name ?? '-'} class="ctr-dsec" aria-labelledby={`dsec-${i}`}>
            <h2 class="ctr-h2" id={`dsec-${i}`}>
              {sec.name ?? (sections.length > 1 ? c.demoOther : c.demoAll)}{' '}
              <small>{fmt(c, 'demoCount', { count: sec.demos.length })}</small>
            </h2>
            <div class="ctr-grid">
              {sec.demos.map((d) => (
                <DemoCard key={d.demoId} c={c} d={d} q={q} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function DemoCard({ c, d, q }: { c: C; d: CenterDemo; q: string }) {
  return (
    <a class="fc dc" href={moduleHref(d.demoId)}>
      <span class="cov">
        {d.cover ? <img class="fc-img" src={d.cover} alt="" loading="lazy" /> : <span class="fc-shot" />}
      </span>
      <span class="bd">
        <h3>
          <Hl text={d.title} q={q} />
        </h3>
        <span class="meta">
          {fmt(c, d.kind === 'sandbox' ? 'demoSandbox' : 'demoGuided', { count: d.steps })}
        </span>
        {d.tags.length > 0 && (
          <span class="tgs">
            {d.tags.map((x) => (
              <Tag key={x.name} name={x.name} color={x.color} q={q} />
            ))}
          </span>
        )}
      </span>
    </a>
  );
}

/** Carte de formation (MOB-01 M4) : un seul lien, vignette, titre, état, une ligne et la barre.
 *  La liste des modules reste sur la page de la formation. */
function PathCard({ c, v, q, href }: { c: C; v: PathView; q: string; href: string }) {
  const p = v.path;
  const cover = p.modules[0]?.cover ?? null;
  // Une seule ligne : « 1 module sur 4 validé · 4 modules » une fois commencée
  const line = v.started
    ? [
        fmt(c, 'cardProgress', { count: v.validated, n: v.validated, total: v.total }),
        fmt(c, 'modules', { count: p.modules.length }),
      ].join(' · ')
    : [
        fmt(c, p.ordered ? 'metaOrdered' : 'metaFree', { count: p.modules.length }),
        v.quizzes ? fmt(c, 'quiz', { count: v.quizzes }) : c.noQuizLower,
      ].join(' · ');
  const status =
    v.badge === 'current'
      ? c.badgeCurrent
      : v.badge === 'done'
        ? c.badgeDone
        : v.badge === 'new'
          ? c.badgeNew
          : null;
  return (
    <a class="fc fc--path" href={href}>
      <span class="cov">
        {cover ? <img class="fc-img" src={cover} alt="" loading="lazy" /> : <span class="fc-shot" />}
      </span>
      <span class="bd">
        <span class="fc-hd">
          <h3>
            <Hl text={p.title} q={q} />
          </h3>
          <ChevronRight class="fc-chev" aria-hidden="true" />
        </span>
        {status && <span class={`fc-st${v.badge === 'done' ? ' ok' : ''}`}>{status}</span>}
        <span class="meta">{line}</span>
        {v.started && (
          <span
            class="fc-bar"
            role="img"
            aria-label={fmt(c, 'progressAria', { n: v.validated, total: v.total })}
          >
            <span style={{ width: `${(v.validated / Math.max(1, v.total)) * 100}%` }} />
          </span>
        )}
      </span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Page d'une formation (L14-05, L14-06)
// ---------------------------------------------------------------------------
function PathPage({
  t,
  data,
  views,
  route,
  token,
}: {
  t: Dict;
  data: CenterData;
  views: PathView[];
  route: Route;
  token: string | null;
}) {
  const c = t.center as unknown as C;
  const v = views.find((x) => x.path.id === route.pathId);
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => h1.current?.focus(), [route.pathId]);
  if (!v)
    return (
      <main class="ctr-in" id="ctr-main">
        <div class="ctr-empty" role="status">
          <h2>{c.notFound}</h2>
          <div class="acts">
            <a class="cta" href={centerHref(route.slug)}>
              {c.backHome}
            </a>
          </div>
        </div>
      </main>
    );
  const p: CenterPath = v.path;
  const meta = [
    fmt(c, p.ordered ? 'metaOrdered' : 'metaFree', { count: p.modules.length }),
    v.quizzes ? fmt(c, 'quiz', { count: v.quizzes }) : c.noQuizLower,
  ]
    .filter(Boolean)
    .join(' · ');
  const protectedMod = p.modules.some((m) => m.access === 'password');
  const expiredMod = p.modules.some((m) => m.access === 'expired');
  return (
    <main class="ctr-in" id="ctr-main">
      <nav class="crumb" aria-label={c.crumb}>
        <a href={centerHref(route.slug)}>{c.sub}</a> › <span aria-current="page">{p.title}</span>
      </nav>
      <div class="fp-head">
        <div>
          <h1 tabIndex={-1} ref={h1}>
            {p.title}
          </h1>
          <p>{p.description || meta}</p>
          {p.description && <p class="fp-meta">{meta}</p>}
          {p.tags.length > 0 && (
            <div class="fp-tags">
              {p.tags.map((x) => (
                <Tag key={x.name} name={x.name} color={x.color} />
              ))}
            </div>
          )}
        </div>
        {v.identified && (
          // MOB-01 M2 : « 2 sur 2 validés » en texte de 13 px atténué (plus de pastille)
          <span class="fp-progress">
            {fmt(c, 'progress', { count: v.validated, n: v.validated, total: v.total })}
          </span>
        )}
      </div>
      {v.done && (
        <section class="fp-done" aria-labelledby="fp-done-t">
          <span class="ic" aria-hidden="true">
            <Award />
          </span>
          <div>
            <h2 id="fp-done-t">
              {data.visitor?.firstName
                ? fmt(c, 'fpDoneTitle', { name: data.visitor.firstName })
                : c.fpDoneTitleNoName}
            </h2>
            <p>{c.fpDoneText}</p>
          </div>
          {token && (
            <CertificateButton
              c={c}
              token={token}
              pathId={p.id}
              logoPath={data.center.logoPath}
              workspace={data.center.workspace}
              help={data.center.help}
              hasName={data.visitor?.hasName !== false}
            />
          )}
        </section>
      )}
      {/* A11Y-07 : niveau de titre intermédiaire avant les modules (h3) */}
      <h2 class="sr-only" id="fp-modules-t">
        {c.fpModules}
      </h2>
      <ol class="fp-list" aria-labelledby="fp-modules-t">
        {p.modules.map((m, i) => {
          const st = v.modules[i]!;
          const cls =
            st.kind === 'ok'
              ? 'ok'
              : st.kind === 'cur'
                ? 'cur'
                : st.kind === 'lock' || st.kind === 'expired'
                  ? 'lock'
                  : '';
          const line =
            st.kind === 'ok'
              ? st.best !== null
                ? fmt(c, 'fpOkScore', { score: st.best })
                : c.fpOk
              : st.kind === 'cur'
                ? fmt(c, 'fpCur', { n: st.step, total: st.total })
                : st.kind === 'lock'
                  ? fmt(c, 'fpLock', { n: st.after })
                  : st.kind === 'expired'
                    ? st.since
                      ? fmt(c, 'fpExpiredSince', { date: frDate(st.since) })
                      : c.fpExpired
                    : st.kind === 'password'
                      ? c.fpPassword
                      : c.fpTodo;
          return (
            <li key={m.demoId} class={cls || undefined}>
              <span class="n" aria-hidden="true">
                {i + 1}
              </span>
              <span class={`mini${st.kind === 'expired' ? ' mini--none' : ''}`} aria-hidden="true">
                {m.cover && st.kind !== 'expired' && <img src={m.cover} alt="" loading="lazy" />}
              </span>
              <div>
                <h3>
                  {m.title}
                  {m.access === 'password' && (
                    <span class="hb key">
                      <Key aria-hidden="true" />
                      {c.fpProtected}
                    </span>
                  )}
                  {m.access === 'expired' && (
                    <span class="hb exp">
                      <Clock aria-hidden="true" />
                      {c.expired}
                    </span>
                  )}
                </h3>
                <p>{line}</p>
              </div>
              {st.kind === 'lock' || st.kind === 'expired' ? (
                <span />
              ) : (
                <a
                  class={`cta${st.kind === 'cur' ? '' : ' cta--sec'}`}
                  href={centerModuleHref(m.demoId, { slug: route.slug, pathId: p.id })}
                >
                  {st.kind === 'ok' ? c.ctaReview : st.kind === 'cur' ? c.ctaResume : c.ctaStart}
                  <span class="sr-only"> {m.title}</span>
                  {st.kind === 'cur' && <ArrowRight aria-hidden="true" />}
                </a>
              )}
            </li>
          );
        })}
      </ol>
      {v.done ? (
        <p class="fp-foot">{c.fpFootDone}</p>
      ) : (
        (protectedMod || expiredMod) && (
          <p class="fp-foot">
            {[protectedMod ? c.fpFootProtected : null, expiredMod ? c.fpFootExpired : null]
              .filter(Boolean)
              .join(' ')}
          </p>
        )
      )}
    </main>
  );
}

/** L15-07 : attestation délivrée par le serveur (formation validée), puis créée dans le navigateur. */
function CertificateButton({
  c,
  token,
  pathId,
  logoPath,
  workspace,
  help,
  hasName,
}: {
  c: C;
  token: string;
  pathId: string;
  logoPath: string | null;
  workspace: string;
  help: string;
  hasName: boolean;
}) {
  // Nom inconnu dès le chargement (open-center) : l'aide s'affiche d'emblée, sans bouton qui échoue
  const [state, setState] = useState<'idle' | 'busy' | 'refused' | 'noName' | 'error'>(
    hasName ? 'idle' : 'noName',
  );
  const status = useRef<HTMLParagraphElement>(null);
  const clicked = useRef(false);
  // Synchrone au rendu (useLayoutEffect) : le focus ne reste jamais sur le bouton retiré, même sous
  // charge (useEffect attend l'image suivante en Preact)
  useLayoutEffect(() => {
    // Le focus ne bouge que si le bouton vient de disparaître sous les doigts du visiteur
    if (state === 'noName' && clicked.current) status.current?.focus();
  }, [state]);
  const run = async () => {
    clicked.current = true;
    setState('busy');
    try {
      const info = await issueCertificate(token, pathId);
      if (info?.error === 'name_missing') return setState('noName');
      if (
        !info?.certificateId ||
        !info.learner ||
        !info.path ||
        !info.workspace ||
        !info.modules ||
        !info.issuedAt
      )
        return setState('refused');
      const { downloadCertificate } = await import('./certificate');
      await downloadCertificate(
        { ...info, validatedAt: info.validatedAt ?? null } as Parameters<typeof downloadCertificate>[0],
        navigator.language.startsWith('en') ? 'en-GB' : 'fr-FR',
        logoPath ? brandingUrl(logoPath) : null,
      );
      setState('idle');
    } catch {
      setState('error');
    }
  };
  const msg =
    state === 'refused'
      ? c.certRefused
      : state === 'noName'
        ? fmt(c, 'certNoName', { workspace })
        : state === 'error'
          ? c.certError
          : state === 'busy'
            ? c.certBusy
            : '';
  // Aucun nom connu : pas d'attestation, l'aide remplace le bouton (spec L15 §5). La zone d'état
  // existe dès l'affichage (annonce fiable) et reçoit le focus quand le bouton disparaît.
  const noName = state === 'noName';
  const href = help ? (help.includes('@') ? `mailto:${help}` : help) : null;
  return (
    <div class="fp-cert">
      {!noName && (
        <button
          class="cta"
          type="button"
          onClick={() => void run()}
          disabled={state === 'busy'}
          aria-describedby="fp-cert-s"
        >
          <Download aria-hidden="true" />
          {c.certificate}
        </button>
      )}
      <p
        ref={status}
        tabIndex={-1}
        class={`fp-cert-s${noName ? ' fp-cert-help' : state === 'busy' || state === 'idle' ? '' : ' err'}`}
        id="fp-cert-s"
        role="status"
      >
        {msg}
        {noName && href && (
          <>
            {' '}
            <a href={href}>{c.help}</a>
          </>
        )}
      </p>
    </div>
  );
}
