import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Download, Info, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { APP_NAME } from '@flowdsiml/core';
import { SUPPORT_EMAIL } from '../../lib/env';
import { supabase } from '../../lib/supabase';
import { formatNumber } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { useToast } from '../../components/Toast';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';

type Limits = {
  published_demos: number | null;
  members: number | null;
  steps_per_demo: number | null;
  remove_branding: boolean;
  lead_forms: boolean;
  analytics_retention_days: number;
};
type Usage = { plan: string; limits: Limits; published_demos: number; members: number };

/**
 * Plans et facturation (PLN-01), à l'identique de la maquette plans.html, avec les données réelles :
 * plans et limites lus dans public.plans, utilisation via workspace_usage. Pas de paiement en ligne (D6) :
 * prix, période de facturation et factures sont annoncés « Bientôt » ; les changements de plan passent
 * par un email au support.
 */
export function PlansPage() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const [plans, setPlans] = useState<Tables<'plans'>[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  // Demande de changement de plan : plan visé (ou Enterprise pour « Parlons Enterprise »)
  const [upgrade, setUpgrade] = useState<Tables<'plans'> | null>(null);

  useEffect(() => {
    void supabase
      .from('plans')
      .select('*')
      .order('sort')
      .then(({ data }) => setPlans(data ?? []));
  }, []);
  useEffect(() => {
    if (!current) return;
    void supabase
      .rpc('workspace_usage', { p_workspace: current.id })
      .then(({ data }) => setUsage(data as unknown as Usage));
  }, [current]);

  if (!plans) return <Loading />;
  // Noms des plans tels qu'en base (Free / Pro / Business / Enterprise) tant que le client n'a pas tranché
  const name = (code: string) => plans.find((p) => p.code === code)?.name ?? code;
  const currentIdx = plans.findIndex((p) => p.code === current?.plan_code);
  // « Recommandé pour vous » : le plan immédiatement supérieur au plan actuel
  const reco = currentIdx >= 0 ? plans[currentIdx + 1] : undefined;

  const mailto = (subject: string, body = '') =>
    SUPPORT_EMAIL
      ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`
      : undefined;
  const changeSubject = (p: Tables<'plans'>) =>
    t('plans.contactSubject', { workspace: current?.name ?? '', plan: name(p.code) });

  const retention = (days: number) =>
    days % 30 === 0 || days >= 360
      ? t('plans.months', { count: Math.round(days / 30.4) })
      : t('plan.days', { count: days });
  const features = (l: Limits, i: number) => {
    const prevPlan = i > 0 ? plans[i - 1] : undefined;
    const prev = prevPlan ? (prevPlan.limits as unknown as Limits) : null;
    const items: Array<{ ok: boolean; text: string }> = [];
    if (prevPlan) items.push({ ok: true, text: t('plans.allOf', { plan: name(prevPlan.code) }) });
    items.push({
      ok: true,
      text:
        l.published_demos === null
          ? t('plans.unlimitedDemos')
          : t('plans.publishedDemos', { count: l.published_demos }),
    });
    items.push({
      ok: true,
      text:
        l.steps_per_demo === null ? t('plans.unlimitedSteps') : t('plans.steps', { count: l.steps_per_demo }),
    });
    if (!prev || l.lead_forms !== prev.lead_forms)
      items.push({ ok: l.lead_forms, text: t('plans.leadForms') });
    if (!prev || l.remove_branding !== prev.remove_branding)
      items.push({
        ok: l.remove_branding,
        text: l.remove_branding ? t('plans.noBranding') : t('plans.branding', { app: APP_NAME }),
      });
    items.push({ ok: true, text: t('plans.analytics', { period: retention(l.analytics_retention_days) }) });
    return items;
  };

  const limits = usage?.limits;
  const gauge = (used: number, limit: number | null | undefined, label: string) => {
    const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return (
      <div>
        <div className="row between t-label">
          <span>{label}</span>
          <span className="num">
            {formatNumber(used)} /{' '}
            {limit === null || limit === undefined ? t('plans.unlimited') : formatNumber(limit)}
          </span>
        </div>
        <div className={`progress pl-progress${pct >= 80 ? ' warn' : ''}`}>
          <span style={{ width: `${limit ? pct : 0}%` }} />
        </div>
        {limit ? pct >= 80 && <p className="help pl-help">{t('plans.used', { pct })}</p> : null}
      </div>
    );
  };
  const atLimit =
    usage && limits?.published_demos !== null && limits?.published_demos !== undefined
      ? usage.published_demos >= limits.published_demos
      : false;

  return (
    <div className="mk pl">
      <div className="page-head">
        <div>
          <h1>{t('plans.pageTitle')}</h1>
          <p className="muted pl-sub">{t('plans.sub', { workspace: current?.name ?? '' })}</p>
        </div>
      </div>

      <div className="alert pl-alert">
        <Info aria-hidden="true" />
        <span>
          <b>{t('plans.paymentSoon')}</b> {t('plans.paymentHow')}{' '}
          {SUPPORT_EMAIL ? (
            <a href={mailto(t('plans.contactSubject', { workspace: current?.name ?? '', plan: '…' }))}>
              {t('plans.contactUs')}
            </a>
          ) : (
            t('plans.contactUs')
          )}
          . {t('plans.activation')}
        </span>
      </div>

      {usage && limits && (
        <section className="card card-pad" aria-labelledby="pl-usage">
          <div className="row between wrap">
            <h2 className="t-h3" id="pl-usage">
              {t('plans.usageTitle', { plan: name(usage.plan) })}
            </h2>
          </div>
          <div className="usage-grid pl-usage-grid">
            {gauge(usage.members, limits.members, t('plan.members'))}
            {gauge(usage.published_demos, limits.published_demos, t('plan.publishedDemos'))}
            <div>
              <div className="row between t-label">
                <span>{t('plan.retention')}</span>
                <span>{retention(limits.analytics_retention_days)}</span>
              </div>
              <div className="progress pl-progress">
                <span className="pl-track" />
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="row between wrap pl-choose">
        <h2>{t('plans.choose')}</h2>
        {/* Pas de tarif en ligne tant que le paiement n'est pas branché (D6) */}
        <div className="segmented" role="radiogroup" aria-label={t('plans.period')} aria-disabled="true">
          <button type="button" role="radio" aria-checked="false" aria-disabled="true">
            {t('plans.monthly')}
          </button>
          <button type="button" role="radio" aria-checked="true" aria-disabled="true">
            {t('plans.yearly')}
          </button>
          <span className="badge pl-soon">{t('shell.soon')}</span>
        </div>
      </div>

      <div className="plans">
        {plans.map((p, i) => {
          const l = p.limits as unknown as Limits;
          const isCurrent = p.code === current?.plan_code;
          const isReco = reco?.code === p.code;
          const lower = currentIdx >= 0 && i < currentIdx;
          return (
            <article
              key={p.code}
              className={`card plan${isCurrent ? ' current' : ''}${isReco ? ' reco' : ''}`}
            >
              {isCurrent && <span className="badge badge-primary tag">{t('plans.current')}</span>}
              {isReco && <span className="badge badge-accent tag">{t('plans.reco')}</span>}
              <h3>{name(p.code)}</h3>
              <p className="t-caption muted">{t(`plans.tagline.${p.code}`, { defaultValue: '' })}</p>
              <div className="price">
                {p.code === 'free' ? (
                  <>
                    0 €<small> {t('plans.perMonth')}</small>
                  </>
                ) : (
                  <span className="pl-quote">{t('plans.onQuote')}</span>
                )}
              </div>
              <p className="t-caption subtle">
                {l.members === null
                  ? t('plans.unlimitedMembers')
                  : t('plans.membersIncl', { count: l.members })}
              </p>
              <ul>
                {features(l, i).map((f) => (
                  <li key={f.text} className={f.ok ? undefined : 'muted'}>
                    {f.ok ? <Check aria-hidden="true" /> : <X aria-hidden="true" className="pl-no" />}
                    {f.text}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="btn btn-secondary btn-block" aria-disabled="true">
                  {t('plans.current')}
                </span>
              ) : isReco ? (
                <button type="button" className="btn btn-accent btn-block" onClick={() => setUpgrade(p)}>
                  {t('plans.upgradeTo', { plan: name(p.code) })}
                </button>
              ) : (
                // PLN-04 : toujours actif ; la modale prépare l'email ou copie la demande
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setUpgrade(p)}>
                  {lower ? t('plans.downgrade') : t('plans.chooseX', { plan: name(p.code) })}
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p className="t-caption muted pl-foot">
        {t('plans.enterpriseQ')}{' '}
        {/* PLN-08 : toujours un lien, qui ouvre la demande pour le plan Enterprise */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            const ent = plans.find((p) => p.code === 'enterprise');
            if (ent) setUpgrade(ent);
          }}
        >
          {t('plans.enterpriseLink')}
        </a>
        .
      </p>

      {/* PLN-05 : structure du tableau de la maquette, lignes squelettes tant que la facturation
          en ligne n'existe pas (aucune donnée inventée) */}
      <section className="card pl-invoices" aria-labelledby="pl-inv">
        <div className="card-head pl-inv-head">
          <h2 className="t-h3" id="pl-inv">
            {t('plans.invoices')}
          </h2>
          <span className="badge">{t('shell.soon')}</span>
        </div>
        <div className="table-wrap">
          <table className="table pl-inv-table">
            <caption className="sr-only">{t('plans.noInvoices')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('plans.invDate')}</th>
                <th scope="col">{t('plans.invPlan')}</th>
                <th scope="col" className="r">
                  {t('plans.invAmount')}
                </th>
                <th scope="col">{t('plans.invStatus')}</th>
                <th scope="col">
                  <span className="sr-only">{t('plans.invDownload')}</span>
                </th>
              </tr>
            </thead>
            <tbody aria-hidden="true">
              {[0, 1].map((i) => (
                <tr key={i} className="pl-inv-skel">
                  <td>
                    <span className="skeleton pl-sk" style={{ width: 88 }} />
                  </td>
                  <td>
                    <span className="skeleton pl-sk" style={{ width: 120 }} />
                  </td>
                  <td className="r">
                    <span className="skeleton pl-sk" style={{ width: 72 }} />
                  </td>
                  <td>
                    <span className="skeleton pl-sk pl-sk--badge" />
                  </td>
                  <td className="r">
                    <button type="button" className="btn btn-ghost btn-sm" aria-disabled="true" tabIndex={-1}>
                      <Download aria-hidden="true" />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {atLimit && usage && limits && (
        <div className="card card-pad row wrap pl-limit">
          <span className="badge badge-warning">
            {usage.published_demos} / {limits.published_demos}
          </span>
          <div className="grow">
            <b>{t('plans.limitTitle', { count: limits.published_demos ?? 0 })}</b>
            <p className="t-caption muted">
              {reco ? t('plans.limitBody', { plan: name(reco.code) }) : t('plans.limitBodyTop')}
            </p>
          </div>
          <Link className="btn btn-secondary btn-sm" to="/">
            {t('plans.manageDemos')}
          </Link>
          {reco && (
            <button type="button" className="btn btn-accent btn-sm" onClick={() => setUpgrade(reco)}>
              {t('plans.upgradeTo', { plan: name(reco.code) })}
            </button>
          )}
        </div>
      )}

      {upgrade && (
        <UpgradeDialog
          planName={name(upgrade.code)}
          minMembers={(upgrade.limits as unknown as Limits).members ?? usage?.members ?? null}
          subject={changeSubject(upgrade)}
          mailto={(body) => mailto(changeSubject(upgrade), body)}
          onClose={() => setUpgrade(null)}
        />
      )}
    </div>
  );
}

/** Demande de changement de plan (maquette « Passer au plan … ») : prépare un email au support. */
function UpgradeDialog({
  planName,
  minMembers,
  subject,
  mailto,
  onClose,
}: {
  planName: string;
  minMembers: number | null;
  subject: string;
  mailto: (body: string) => string | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [members, setMembers] = useState(String(minMembers ?? ''));
  const [message, setMessage] = useState('');
  const body = `${t('plans.upMembers')} : ${members}\n\n${message}`.trim();
  const href = mailto(body);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pl-up-t">
        <div className="modal-head">
          <h2 id="pl-up-t">{t('plans.upTitle', { plan: planName })}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">{t('plans.upBody')}</p>
          <div className="field pl-field">
            <label htmlFor="pl-up-n">{t('plans.upMembers')}</label>
            <input
              id="pl-up-n"
              className="input"
              type="number"
              min={1}
              autoFocus
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pl-up-m">
              {t('plans.upMessage')} <span className="opt">{t('plans.optional')}</span>
            </label>
            <textarea
              id="pl-up-m"
              className="textarea"
              placeholder={t('plans.upPlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          {href ? (
            <a className="btn btn-primary" href={href} onClick={onClose}>
              {t('plans.upSend')}
            </a>
          ) : (
            // Sans adresse de support configurée : la demande est copiée pour être transmise
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void navigator.clipboard?.writeText(`${subject}\n\n${body}`).then(
                  () => toast(t('plans.upCopied')),
                  () => undefined,
                );
                onClose();
              }}
            >
              {t('plans.upCopy')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
