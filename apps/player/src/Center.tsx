import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  ArrowRight,
  Award,
  BookOpen,
  CircleCheck,
  CircleDot,
  Clock,
  Download,
  Key,
  Lock,
  Mail,
  Play,
  Search,
  User,
  X,
} from 'lucide-preact';
import { centerLinkToken, issueCertificate, openCenter, type CenterGateInfo } from './api';
import {
  currentPath,
  filterPaths,
  highlight,
  pathView,
  tagCounts,
  themeVars,
  DEFAULT_BRAND,
  type CenterData,
  type CenterPath,
  type ModuleView,
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
    document.title = state.center.title || state.center.workspace;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = state.center.indexable ? 'index, follow' : 'noindex, nofollow';
  }, [state]);

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
  const a11y = c[`a11y_${info.a11y}`] ?? c.a11y_non_evalue;
  const help = info.help ? (info.help.includes('@') ? `mailto:${info.help}` : info.help) : null;

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
          <small>{c.sub}</small>
        </a>
        {data.visitor && (
          <span class="sp">
            <span class="who">{data.visitor.firstName}</span>
            <span class="ctr-av" aria-hidden="true">
              {initials(data.visitor.firstName)}
            </span>
          </span>
        )}
      </header>
      {route.pathId ? (
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
  const tags = tagCounts(data.paths);
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
            {me.next && (
              <a href={moduleHref(me.next.demoId)}>
                {fmt(c, 'resume', { module: me.next.title })}
                <ArrowRight aria-hidden="true" />
              </a>
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
            {c.all} <span class="n">{data.paths.length}</span>
          </button>
          {tags.map((x) => (
            <button
              key={x.name}
              type="button"
              aria-pressed={tag === x.name}
              onClick={() => go({ tag: tag === x.name ? '' : x.name })}
            >
              <span class={`dot dot--${tagCls(x.color)}`} aria-hidden="true" />
              {x.name} <span class="n">{x.count}</span>
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

function ModuleIcon({ m }: { m: ModuleView }) {
  if (m.kind === 'ok') return <CircleCheck />;
  if (m.kind === 'cur') return <Play />;
  if (m.kind === 'lock') return <Lock />;
  if (m.kind === 'expired') return <Clock />;
  return <CircleDot />;
}

function ModuleState({ c, m, identified }: { c: C; m: ModuleView; identified: boolean }): ComponentChildren {
  if (m.kind === 'ok') return <span class="s ok">{c.ok}</span>;
  if (m.kind === 'cur') return <span class="s">{fmt(c, 'step', { n: m.step, total: m.total })}</span>;
  if (m.kind === 'lock') return <span class="s">{fmt(c, 'after', { n: m.after })}</span>;
  if (m.kind === 'password')
    return (
      <span class="hb key">
        <Key aria-hidden="true" />
        {c.password}
      </span>
    );
  if (m.kind === 'expired')
    return (
      <span class="hb exp">
        <Clock aria-hidden="true" />
        {c.expired}
      </span>
    );
  // Sans identification, pas d'état (et aucune durée inventée)
  return identified ? <span class="s">{c.todo}</span> : null;
}

/** Carte de formation : un seul lien, aucun bouton à l'intérieur. */
function PathCard({ c, v, q, href }: { c: C; v: PathView; q: string; href: string }) {
  const p = v.path;
  const cover = p.modules[0]?.cover ?? null;
  const meta = [
    fmt(c, p.ordered ? 'metaOrdered' : 'metaFree', { count: p.modules.length }),
    v.quizzes ? fmt(c, 'quiz', { count: v.quizzes }) : c.noQuizLower,
  ]
    .filter(Boolean)
    .join(' · ');
  // Une seule mention en pied de carte (retour L14-01) : les modules au-delà des 3 premiers y sont
  // annoncés comme expirés, facultatifs ou simplement « + n module(s) ».
  const hiddenMore = Math.max(0, p.modules.length - 3 - v.expiredHidden);
  const note = v.done
    ? c.allValidated
    : v.expiredHidden
      ? fmt(c, 'expiredMore', { count: v.expiredHidden })
      : v.optional
        ? fmt(c, 'optional', { count: v.optional })
        : hiddenMore
          ? fmt(c, 'more', { count: hiddenMore })
          : v.identified && !v.started
            ? c.notStarted
            : v.quizzes
              ? fmt(c, 'quiz', { count: v.quizzes })
              : c.noQuiz;
  const curIdx = v.modules.findIndex((m) => m.kind === 'cur');
  return (
    <a class="fc" href={href}>
      <span class="cov">
        {cover ? <img class="fc-img" src={cover} alt="" loading="lazy" /> : <span class="fc-shot" />}
        {v.badge === 'current' && (
          <span class="hb cur st">
            <Play aria-hidden="true" />
            {c.badgeCurrent}
          </span>
        )}
        {v.badge === 'done' && (
          <span class="hb ok st">
            <Award aria-hidden="true" />
            {c.badgeDone}
          </span>
        )}
        {v.badge === 'new' && <span class="hb st">{c.badgeNew}</span>}
      </span>
      <span class="bd">
        <h3>
          <Hl text={p.title} q={q} />
        </h3>
        {p.tags.length > 0 && (
          <span class="tgs">
            {p.tags.map((x) => (
              <Tag key={x.name} name={x.name} color={x.color} q={q} />
            ))}
          </span>
        )}
        <span class="meta">{meta}</span>
        {v.started && (
          <span class={`fc-pg${v.done ? ' done' : ''}`}>
            <span
              class="bar"
              role="img"
              aria-label={fmt(c, 'progressAria', { n: v.validated, total: v.total })}
            >
              <span style={{ width: `${(v.validated / Math.max(1, v.total)) * 100}%` }} />
            </span>
            <span>{fmt(c, 'progress', { count: v.validated, n: v.validated, total: v.total })}</span>
          </span>
        )}
        <ol aria-label={c.modulesAria}>
          {p.modules.slice(0, 3).map((m, i) => {
            const st = v.modules[i]!;
            return (
              <li key={m.demoId} class={i === curIdx ? 'cur' : st.kind === 'lock' ? 'lock' : undefined}>
                <span
                  class={`ic${st.kind === 'ok' ? ' ok' : st.kind === 'cur' ? ' cur' : ''}`}
                  aria-hidden="true"
                >
                  <ModuleIcon m={st} />
                </span>
                <span>
                  {i + 1} · <Hl text={m.title} q={q} />
                </span>
                <ModuleState c={c} m={st} identified={v.identified} />
              </li>
            );
          })}
        </ol>
        <span class="ft">
          <span class="note">{note}</span>
          <span class={`cta${v.cta === 'review' ? ' cta--sec' : ''}`}>
            {v.cta === 'review' ? c.ctaReview : v.cta === 'resume' ? c.ctaResume : c.ctaStart}
            {v.cta !== 'review' && <ArrowRight aria-hidden="true" />}
          </span>
        </span>
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
          <span class={`hb hb--lg${v.done ? ' ok' : ''}`}>
            <Award aria-hidden="true" />
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
      <ol class="fp-list" aria-label={c.fpModules}>
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
                <a class={`cta${st.kind === 'cur' ? '' : ' cta--sec'}`} href={moduleHref(m.demoId)}>
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
  useEffect(() => {
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
