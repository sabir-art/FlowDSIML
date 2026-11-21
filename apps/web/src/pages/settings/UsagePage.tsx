import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
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
  note: string;
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
    note: reset,
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
      note: reset,
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
          ? `${num(usage.members)} / ${num(l.members)}`
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
          ? `${num(usage.published_demos)} / ${num(l.published_demos)}`
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
  ];

  const askButton = (className: string, label: string): ReactNode =>
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

  return (
    <SettingsShell>
      <section className="us-page" aria-labelledby="st-title">
        <div className="us-head">
          <p className="muted">{t('usage.sub', { workspace: current.name })}</p>
          {askButton('fd-btn', t('usage.ask'))}
          {/* L48-01 (U2) : sans lien du support, les administrateurs sont invités à le renseigner */}
          {!ask && can('workspace.settings') && (
            <Link className="fd-btn" to="/settings/workspace">
              {t('usage.setSupport')}
            </Link>
          )}
        </div>
        {ask && <p className="us-hint">{t('usage.hint')}</p>}
        <ul className="us-card">
          {rows.map((r) => {
            const pct = r.limit ? Math.min(100, Math.round((r.used / r.limit) * 100)) : null;
            const state = pct === null ? '' : pct >= 100 ? 'full' : pct >= 80 ? 'warn' : '';
            const name = t(`usage.rows.${r.key}`);
            return (
              <li key={r.key} className={`us-row${state ? ` us-row--${state}` : ''}`}>
                <span className="us-name">
                  <b>{name}</b>
                  {r.note && <small>{r.note}</small>}
                </span>
                {pct !== null && !r.noMeter ? (
                  <span
                    className="us-bar"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-label={t('usage.meter', { name, pct })}
                  >
                    <i style={{ width: `${pct}%` }} />
                  </span>
                ) : (
                  <span className="us-bar-none" />
                )}
                <span className="us-val">
                  {r.value}
                  {state && (
                    <small className={`us-state us-state--${state}`}>
                      <TriangleAlert size={14} aria-hidden="true" />
                      {t(state === 'full' ? 'usage.full' : 'usage.near')}
                    </small>
                  )}
                </span>
                {state === 'full' && (
                  <p className="us-blocked">
                    {r.blocked} {askButton('link-button', t('usage.askMore'))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {emails && (
          <p className="us-emails">{t('usage.emailsToday', { n: num(emails.sent), cap: num(emails.cap) })}</p>
        )}
      </section>
    </SettingsShell>
  );
}
