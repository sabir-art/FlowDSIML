import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ImagePlus, Lock, Mail, Sparkles, Users } from 'lucide-react';
import { ShareRulesCard } from './security/ShareRulesCard';
import { SettingsShell } from './SettingsShell';
import { SoonButton, SoonCard } from '../../components/soon/SoonCard';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

const TABS = ['ia', 'crm', 'sso'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { ia: 'soon.tabIa', crm: 'soon.tabCrm', sso: 'soon.tabSso' };

/**
 * VB-01 à 03 : Paramètres › Fonctions à venir (vague B). Onglets Assistance IA, CRM et e-mailing,
 * Connexion unique. Rien n'y est actif : contrôles désactivés, alternative disponible aujourd'hui.
 */
export function SoonFeatures() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'ia';
  const setTab = (n: Tab) => setParams({ tab: n }, { replace: true });
  return (
    <SettingsShell>
      <section className="soon-page" aria-labelledby="soon-t">
        <h2 className="t-h2" id="soon-t">
          {t('soon.title')}
        </h2>
        <p className="muted">{t('soon.sub')}</p>
        <div className="tabs soon-tabs" role="tablist" aria-label={t('soon.title')}>
          {TABS.map((id, i) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`soon-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`soon-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
                setTab(n);
                document.getElementById(`soon-tab-${n}`)?.focus();
              }}
            >
              {t(TAB_LABEL[id])}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`soon-panel-${tab}`} aria-labelledby={`soon-tab-${tab}`}>
          {tab === 'ia' && <IaPane />}
          {tab === 'crm' && <CrmPane />}
          {tab === 'sso' && <SsoCard />}
        </div>
      </section>
    </SettingsShell>
  );
}

function IaPane() {
  const { t } = useTranslation();
  // L30 §11 : les autres fonctions sont dans Paramètres › Assistance IA ; restent ces trois-là
  return (
    <>
      <div className="alert soon-alert">
        <Sparkles aria-hidden="true" />
        <div>
          {t('soon.iaBanner')} <Link to="/settings/ai">{t('ai.name')}</Link>
        </div>
      </div>
      <div className="soon-grid">
        <SoonCard k="images" icon={<ImagePlus />} control={<SoonButton label={t('soon.images.action')} />} />
      </div>
    </>
  );
}

/** Lien vers les webhooks (alternative active), pour qui gère les intégrations. */
export function WebhooksLink() {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  if (!can('integrations.manage')) return null;
  return (
    <Link
      className="btn btn-secondary btn-sm soon-ctl"
      to="/settings/integrations"
      state={{ focus: 'webhooks' }}
    >
      {t('soon.useWebhooks')}
    </Link>
  );
}

function CrmPane() {
  const { t } = useTranslation();
  return (
    <div className="soon-grid">
      <SoonCard k="crm" icon={<Building2 />} control={<WebhooksLink />} />
      <SoonCard k="emailing" icon={<Mail />} control={<SoonButton label={t('soon.emailing.action')} />} />
      <SoonCard k="enrich" icon={<Users />} control={<SoonButton label={t('soon.enrich.action')} />} />
    </div>
  );
}

/** VB-03 : carte SSO (aussi dans Paramètres › Sécurité). */
export function SsoCard({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  return (
    <SoonCard
      k="sso"
      icon={<Lock />}
      headingLevel={headingLevel}
      control={
        <div className="field soon-field">
          <label htmlFor="soon-sso-url">{t('soon.sso.field')}</label>
          <input id="soon-sso-url" className="input" disabled placeholder="https://" />
        </div>
      }
      after={
        can('members.invite') ? <Link to="/settings/members">{t('soon.inviteMembers')}</Link> : undefined
      }
    />
  );
}

/** VB-03 : Paramètres › Sécurité (connexion unique à venir). */
export function SecuritySettings() {
  const { t } = useTranslation();
  return (
    <SettingsShell>
      <section className="soon-page" aria-labelledby="sec-t">
        <h2 className="t-h2" id="sec-t">
          {t('soon.security')}
        </h2>
        <p className="muted">{t('soon.securitySub')}</p>
        {/* L27-06 : règles de partage, au-dessus de la connexion unique (« Bientôt », VB-03) */}
        <ShareRulesCard />
        <SsoCard headingLevel={3} />
      </section>
    </SettingsShell>
  );
}
