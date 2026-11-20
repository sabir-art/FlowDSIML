import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { ShareRulesCard } from './security/ShareRulesCard';
import { SettingsShell } from './SettingsShell';
import { SoonCard } from '../../components/soon/SoonCard';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

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
      <section className="soon-page" aria-labelledby="st-title">
        <p className="muted">{t('soon.securitySub')}</p>
        {/* L27-06 : règles de partage, au-dessus de la connexion unique (« Bientôt », VB-03) */}
        <ShareRulesCard />
        <SsoCard headingLevel={3} />
      </section>
    </SettingsShell>
  );
}
