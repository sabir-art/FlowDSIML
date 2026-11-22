import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail, TriangleAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatNumber } from '../../lib/format';
import { useAiStatus } from '../../lib/ai';
import { supportHref } from '../../lib/support';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { SettingsShell } from './SettingsShell';

interface Usage {
  limits: {
    published_demos: number | null;
    members: number | null;
    analytics_retention_days: number;
  } | null;
  published_demos: number;
  members: number;
  storage: { media: number; videos: number; voices: number; limit: number };
}

/** Une ligne : nom et explication, jauge (sauf sans limite), valeur et état à partir de 80 %. */
interface Row {
  key: string;
  note?: string;
  used: number;
  limit: number | null;
  /** Texte de la valeur (« 412 / 500 requêtes », « 24 · sans limite », « 24 mois »). */
  value: string;
  /** Ce qui est bloqué à 100 %. */
  blocked?: string;
  /** Pas de jauge (durée). */
  noMeter?: boolean;
}

const MB = 1024 * 1024;

/**
 * L48-A §6 : Paramètres > Espace > Utilisation (remplace « Plans et facturation », décision du client du
 * 20 novembre). Outil interne, sans paiement : ni prix, ni offre, seulement la consommation et les
 * quotas techniques. Les limites restent dans plans.limits côté serveur ; « Demander plus à la DSI »
 * ouvre le lien du support de l'espace (masqué sans lien configuré).
 */
export function UsagePage() {
  const { t, i18n } = useTranslation();
  const { current, can } = useWorkspace();
  const [usage, setUsage] = useState<Usage | null>(null);
  const { status: ai } = useAiStatus(current?.id);
  // E-mails P1 (spec §2) : budget d'envoi commun de l'app, lu par les admins
  const [emails, setEmails] = useState<{ sent: number; cap: number } | null>(null);
  const admin = can('members.invite');

  useEffect(() => {
    if (!current) return;
    void supabase
      .rpc('workspace_usage', { p_workspace: current.id })
      .then(({ data }) => setUsage(data as unknown as Usage));
    if (admin)
      void supabase
        .rpc('email_budget_today', { p_workspace: current.id })
        .then(({ data }) => setEmails(data as { sent: number; cap: number } | null));
  }, [current, admin]);

  if (!current || !usage) return <Loading />;
  const ask = supportHref(current.settings, t('usage.askSubject', { workspace: current.name }));
  const num = (n: number) => formatNumber(Math.round(n));
  const month = ai?.renewsOn
    ? new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date(ai.renewsOn))
    : null;
  const reset = month ? t('usage.resetOn', { month }) : '';
  const l = usage.limits;
  const s = usage.storage;
  // L48-03 : voix de synthèse et sous-titres, deux quotas distincts (secondes, affichées en minutes)
  const audio = (key: 'tts' | 'stt', used = 0, quota: number | null = null): Row => ({
    key,
    used,
    limit: quota,
    value:
      quota != null
        ? t('usage.minutes', { used: num(used / 60), limit: num(quota / 60) })
        : t('usage.unlimitedValue', { used: num(used / 60) }),
    blocked: t(`usage.blocked.${key}`),
  });
  const retentionMonths = l ? Math.round(l.analytics_retention_days / 30.4) : null;

  const rows: Row[] = [
    {
      key: 'ai',
      used: ai?.used ?? 0,
      limit: ai?.quota ?? null,
      value:
        ai?.quota != null
          ? t('usage.requests', { used: num(ai.used), limit: num(ai.quota), count: ai.quota })
          : t('usage.unlimitedValue', { used: num(ai?.used ?? 0) }),
      blocked: t('usage.blocked.ai'),
    },
    audio('tts', ai?.ttsUsed, ai?.ttsQuota ?? null),
    audio('stt', ai?.sttUsed, ai?.sttQuota ?? null),
    {
      key: 'storage',
      note: t('usage.storageDetail', {
        media: num(s.media / MB),
        videos: num(s.videos / MB),
        voices: num(s.voices / MB),
      }),
      used: s.media + s.videos + s.voices,
      limit: s.limit,
      value: t('usage.megabytes', {
        used: num((s.media + s.videos + s.voices) / MB),
        limit: num(s.limit / MB),
      }),
      blocked: t('usage.blocked.storage'),
    },
    {
      key: 'members',
      note: t('usage.membersNote'),
      used: usage.members,
      limit: l?.members ?? null,
      value:
        l?.members != null
          ? t('usage.ratio', { used: num(usage.members), limit: num(l.members) })
          : t('usage.unlimitedValue', { used: num(usage.members) }),
      blocked: t('usage.blocked.members'),
    },
    {
      key: 'published',
      note: t('usage.publishedNote'),
      used: usage.published_demos,
      limit: l?.published_demos ?? null,
      value:
        l?.published_demos != null
          ? t('usage.ratio', { used: num(usage.published_demos), limit: num(l.published_demos) })
          : t('usage.unlimitedValue', { used: num(usage.published_demos) }),
      blocked: t('usage.blocked.published'),
    },
    {
      key: 'retention',
      note: t('usage.retentionNote'),
      used: 0,
      limit: null,
      noMeter: true,
      value: retentionMonths !== null ? t('usage.months', { count: retentionMonths }) : '–',
    },
    // E-mails du jour (administrateurs) : même rangée que les autres quotas
    ...(emails
      ? [
          {
            key: 'emails',
            note: t('usage.resetDaily'),
            used: emails.sent,
            limit: emails.cap,
            value: t('usage.ratio', { used: num(emails.sent), limit: num(emails.cap) }),
          } as Row,
        ]
      : []),
  ];

  const askLink = (className: string, label: ReactNode): ReactNode =>
    ask ? (
      <a
        className={className}
        href={ask}
        target={ask.startsWith('https') ? '_blank' : undefined}
        rel="noopener noreferrer"
      >
        {label}
      </a>
    ) : null;

  const byKey = (keys: string[]) =>
    keys.map((k) => rows.find((r) => r.key === k)).filter((r): r is Row => !!r);
  const list = (items: Row[]) => (
    /* §18.6 : rangées à filets, l'écart est porté par leur padding de 20 px */
    <div data-gap-exempt="">
      {items.map((r) => {
        const pct = r.limit ? Math.min(100, Math.round((r.used / r.limit) * 100)) : null;
        const state = pct === null || r.key === 'emails' ? '' : pct >= 100 ? 'full' : pct >= 80 ? 'warn' : '';
        const name = t(`usage.rows.${r.key}`);
        return (
          <div
            key={r.key}
            className={`stg-row us-row${state ? ` us-row--${state}` : ''}${r.key === 'emails' ? ' us-emails' : ''}`}
          >
            <div className="stg-text" data-gap-exempt="">
              <div className="stg-lab">{name}</div>
              {r.note && <div className="stg-help">{r.note}</div>}
            </div>
            <div className="stg-ctl">
              {pct !== null && !r.noMeter && (
                <div
                  className="stg-meter"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={t('usage.meter', { name, pct })}
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
              )}
              {r.noMeter ? (
                // Valeur sans jauge (durée) : texte de 14 px en 600
                <b className="pv-value us-val">{r.value}</b>
              ) : (
                <span className="stg-help us-val">
                  {r.value}
                  {state && (
                    <span className={`us-state us-state--${state}`}>
                      <TriangleAlert size={16} aria-hidden="true" />
                      {t(state === 'full' ? 'usage.full' : 'usage.near')}
                    </span>
                  )}
                </span>
              )}
              {state === 'full' && (
                <p className="stg-help us-blocked">
                  {r.blocked} {askLink('us-ask', t('usage.askMore'))}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <SettingsShell legacy={false}>
      {/* Décision UX du 22/11 : toutes les lignes réelles, en deux sections */}
      <section className="stg-sec us-page" aria-labelledby="us-title">
        <div className="stg-sec__head">
          <div>
            <h2 id="us-title">{t('usage.contentTitle')}</h2>
            <p>{t('usage.sub', { workspace: current.name })}</p>
          </div>
          <div className="stg-sec__acts">
            {askLink(
              'fd-btn',
              <>
                <Mail size={16} aria-hidden="true" />
                {t('usage.ask')}
              </>,
            )}
            {/* Sans lien du support, les administrateurs sont invités à le renseigner */}
            {!ask && can('workspace.settings') && (
              <Link className="fd-btn" to="/settings/workspace">
                {t('usage.setSupport')}
              </Link>
            )}
          </div>
        </div>
        {list(byKey(['published', 'members', 'storage', 'retention']))}
      </section>
      <section className="stg-sec us-page" aria-labelledby="us-month">
        <div className="stg-sec__head">
          <div>
            <h2 id="us-month">{t('usage.monthTitle')}</h2>
            {reset && <p>{reset}.</p>}
          </div>
        </div>
        {list(byKey(['ai', 'tts', 'stt', 'emails']))}
      </section>
    </SettingsShell>
  );
}
