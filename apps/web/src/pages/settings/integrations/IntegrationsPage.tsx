/**
 * L48-F §1 : Paramètres > Intégrations. Une carte, une liste groupée par catégorie, un filtre segmenté
 * (gardé dans ?categorie=) ; seuls les webhooks sont disponibles, les autres lignes disent « Bientôt »
 * (visibles, désactivées, jamais masquées). Réservé aux propriétaires et admins.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  ChevronRight,
  Gamepad2,
  KeyRound,
  Mail,
  Unlink,
  Users,
  Webhook as WebhookIcon,
} from 'lucide-react';
import { Empty } from '@flowdsiml/ui';
import { SettingsShell } from '../SettingsShell';
import slackLogo from '../../../assets/brands/slack.svg';
import zapierLogo from '../../../assets/brands/zapier.svg';
import gaLogo from '../../../assets/brands/google-analytics.svg';
import matomoLogo from '../../../assets/brands/matomo.svg';
import teamsLogo from '../../../assets/brands/microsoft-teams.svg';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { supportHref } from '../../../lib/support';
import { listWebhooks, sendTest, type Webhook } from './webhooks';
import { SecretDialog, WebhookForm } from './WebhooksPage';
import './integrations.css';

type Cat = 'automation' | 'communication' | 'audience' | 'crm';
type Filter = 'all' | 'connected' | Cat;
/** Valeur de ?categorie= (français, lisible dans l'adresse) pour chaque filtre. */
const PARAM: Record<Filter, string> = {
  all: '',
  connected: 'connectees',
  communication: 'communication',
  audience: 'mesure',
  automation: 'automatisation',
  crm: 'relation',
};
const FILTERS: Filter[] = ['all', 'connected', 'communication', 'audience', 'automation', 'crm'];
/** Ordre des groupes avec « Toutes » (tableau de la spec §1). */
const CATS: Cat[] = ['automation', 'communication', 'audience', 'crm'];
/** Lignes « Bientôt » : logo officiel (src/assets/brands/CREDITS.md) ou icône Lucide. */
const SOON: Array<{ k: string; cat: Cat; logo?: string; icon?: ReactNode }> = [
  { k: 'zapier', cat: 'automation', logo: zapierLogo },
  { k: 'keys', cat: 'automation', icon: <KeyRound /> },
  { k: 'remote', cat: 'automation', icon: <Gamepad2 /> },
  { k: 'slack', cat: 'communication', logo: slackLogo },
  { k: 'teams', cat: 'communication', logo: teamsLogo },
  { k: 'ga', cat: 'audience', logo: gaLogo },
  { k: 'matomo', cat: 'audience', logo: matomoLogo },
  { k: 'crm', cat: 'crm', icon: <Building2 /> },
];

export function IntegrationsPage() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ id: string; secret: string } | null>(null);
  const segRef = useRef<HTMLDivElement>(null);
  const ws = current?.id;
  const allowed = can('integrations.manage');
  const filter = FILTERS.find((f) => f !== 'all' && PARAM[f] === params.get('categorie')) ?? 'all';
  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('categorie');
    else next.set('categorie', PARAM[f]);
    setParams(next, { replace: true });
  };

  // Anciens liens /settings/integrations#webhooks : la page Webhooks
  useEffect(() => {
    if (location.hash === '#webhooks') navigate('/settings/integrations/webhooks', { replace: true });
  }, [location.hash, navigate]);
  const load = useCallback(async () => {
    if (ws) setHooks(await listWebhooks(ws));
  }, [ws]);
  useEffect(() => {
    if (allowed) void load();
  }, [load, allowed]);

  if (!allowed)
    return (
      <SettingsShell>
        <div className="empty" role="status">
          <h2 className="t-h3">{t('integrations.noAccess')}</h2>
          <Link className="btn btn-secondary btn-sm" to="/settings/workspace">
            {t('integrations.backGeneral')}
          </Link>
        </div>
      </SettingsShell>
    );

  const active = hooks?.filter((h) => h.state === 'active').length ?? 0;
  const pausedAuto = hooks?.filter((h) => h.state === 'paused_auto').length ?? 0;
  const ask = current ? supportHref(current.settings, t('integrations.requestSubject')) : null;

  const webhookRow = (
    <IntRow
      key="webhooks"
      icon={<WebhookIcon />}
      name={t('integrations.webhooks')}
      body={t('integrations.webhooksSub')}
      warn={pausedAuto ? t('integrations.pausedCount', { count: pausedAuto }) : undefined}
      to={hooks && hooks.length > 0 ? '/settings/integrations/webhooks' : undefined}
      state={
        hooks === null ? null : hooks.length === 0 ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
            {t('integrations.connect')}
          </button>
        ) : (
          <span className="int-on">
            <i aria-hidden="true" />
            {t('integrations.activeCount', { count: active })}
            <ChevronRight aria-hidden="true" />
          </span>
        )
      }
    />
  );
  const soonRow = (c: (typeof SOON)[number]) => (
    <IntRow
      key={c.k}
      logo={c.logo}
      icon={c.icon}
      name={t(`integrations.soon_${c.k}`)}
      body={t(`integrations.soon_${c.k}_body`)}
      soon
    />
  );
  // VB-02 : outils d'e-mailing, avec l'alternative active (webhooks) : la ligne garde son lien
  const emailingRow = (
    <IntRow
      key="emailing"
      icon={<Mail />}
      name={t('soon.emailing.title')}
      body={t('soon.emailing.body')}
      extra={
        <>
          {t('integrations.emailingWhy')}{' '}
          <Link to="/settings/integrations/webhooks">{t('integrations.useWebhook')}</Link>
        </>
      }
      soon
      keepLinks
    />
  );
  // L48-A §4 : enrichissement des visiteurs (ancienne page « Fonctions à venir ») rangé ici
  const enrichRow = (
    <IntRow
      key="enrich"
      icon={<Users />}
      name={t('soon.enrich.title')}
      body={t('soon.enrich.body')}
      extra={t('soon.enrich.why')}
      soon
    />
  );
  const rowsOf = (c: Cat): ReactNode[] => [
    ...(c === 'automation' ? [webhookRow] : []),
    ...SOON.filter((x) => x.cat === c).map(soonRow),
    ...(c === 'communication' ? [emailingRow] : []),
    ...(c === 'crm' ? [enrichRow] : []),
  ];

  const onSegKey = (e: KeyboardEvent<HTMLButtonElement>, f: Filter) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = FILTERS.indexOf(f);
    const n = FILTERS[(i + (e.key === 'ArrowRight' ? 1 : FILTERS.length - 1)) % FILTERS.length]!;
    setFilter(n);
    requestAnimationFrame(() => segRef.current?.querySelector<HTMLElement>(`[data-f="${n}"]`)?.focus());
  };

  return (
    <SettingsShell>
      <section className="l23 int" aria-labelledby="st-title">
        <p className="muted int-sub">{t('integrations.sub')}</p>
        <div className="int-filter">
          <div
            ref={segRef}
            className="fd-segmented int-seg"
            role="radiogroup"
            aria-label={t('integrations.category')}
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                data-f={f}
                aria-checked={filter === f}
                tabIndex={filter === f ? 0 : -1}
                onClick={() => setFilter(f)}
                onKeyDown={(e) => onSegKey(e, f)}
              >
                {t(`integrations.cat.${f}`)}
              </button>
            ))}
          </div>
          <label className="int-select">
            <span>{t('integrations.category')}</span>
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              {FILTERS.map((f) => (
                <option key={f} value={f}>
                  {t(`integrations.cat.${f}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="card int-card-list">
          {filter === 'all' ? (
            CATS.map((c) => (
              <div key={c} className="int-group" role="group" aria-labelledby={`int-g-${c}`}>
                <h2 className="int-group__t" id={`int-g-${c}`}>
                  {t(`integrations.cat.${c}`)}
                </h2>
                <ul className="int-list">{rowsOf(c)}</ul>
              </div>
            ))
          ) : filter === 'connected' ? (
            hooks === null ? null : active > 0 ? (
              <ul className="int-list">{webhookRow}</ul>
            ) : (
              <Empty
                variant="compact"
                level={2}
                icon={<Unlink />}
                title={t('integrations.noneConnected')}
                action={
                  <button type="button" className="link-button" onClick={() => setAdding(true)}>
                    {t('integrations.add')}
                  </button>
                }
              />
            )
          ) : (
            <ul className="int-list">{rowsOf(filter)}</ul>
          )}
        </div>
        {/* §1.1 : une ligne de texte, sans encadré */}
        <p className="int-need">
          {t('integrations.needOther')}{' '}
          {ask ? (
            <a href={ask} target={ask.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">
              {t('integrations.askIt')}
            </a>
          ) : (
            <Link to="/settings/workspace" state={{ focus: 'ws-help' }}>
              {t('integrations.setSupport')}
            </Link>
          )}
        </p>
      </section>
      {adding && ws && (
        <WebhookForm
          ws={ws}
          hook={null}
          onClose={() => setAdding(false)}
          onCreated={(id, s) => {
            setAdding(false);
            setSecret({ id, secret: s });
            void load();
          }}
          onSaved={() => setAdding(false)}
        />
      )}
      {secret && (
        <SecretDialog
          title={t('integrations.secretCreated')}
          secret={secret.secret}
          onTest={() => sendTest(secret.id)}
          onDone={(failed) => {
            const id = secret.id;
            setSecret(null);
            if (failed) navigate(`/settings/integrations/${id}`, { state: { testFailure: failed } });
          }}
        />
      )}
    </SettingsShell>
  );
}

/** Ligne de la liste (T4) : logo ou icône, nom et phrase, état à droite. */
function IntRow({
  logo,
  icon,
  name,
  body,
  extra,
  warn,
  state,
  to,
  soon = false,
  keepLinks = false,
}: {
  logo?: string;
  icon?: ReactNode;
  name: string;
  body: string;
  extra?: ReactNode;
  warn?: string;
  state?: ReactNode;
  to?: string;
  soon?: boolean;
  /** La ligne contient un lien actif (e-mailing) : pas d'aria-disabled, qui le rendrait inactif. */
  keepLinks?: boolean;
}) {
  const { t } = useTranslation();
  const inner = (
    <>
      <span className="int-row__logo" aria-hidden="true">
        {logo ? <img src={logo} alt="" width={28} height={28} /> : icon}
      </span>
      <span className="int-row__txt">
        <b>{name}</b>
        <span>{body}</span>
        {extra && <span>{extra}</span>}
        {warn && <span className="int-row__warn">{warn}</span>}
      </span>
      <span className="int-row__state">
        {soon ? <span className="int-soon">{t('shell.soon')}</span> : state}
      </span>
    </>
  );
  return (
    <li aria-disabled={soon && !keepLinks ? 'true' : undefined}>
      {to ? (
        <Link className="int-row int-row--link" to={to}>
          {inner}
        </Link>
      ) : (
        <div className="int-row">{inner}</div>
      )}
    </li>
  );
}
