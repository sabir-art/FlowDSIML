import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import { HtmlCaptureCard } from './security/HtmlCaptureCard';
import { ShareRulesCard } from './security/ShareRulesCard';
import { useSaveParts } from './security/saveParts';
import { SettingsShell } from './SettingsShell';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

/** Connexion unique : annoncée « Bientôt » (champ désactivé), en attendant les liens d'invitation. */
function SsoSection() {
  const { t } = useTranslation();
  return (
    <section className="stg-sec" aria-labelledby="sso-title">
      <div className="stg-sec__head">
        <div>
          <h2 id="sso-title">{t('soon.sso.title')}</h2>
          <p>{t('soon.sso.sub')}</p>
        </div>
      </div>
      <div className="stg-row">
        <div className="stg-text" data-gap-exempt="">
          <label className="stg-lab" htmlFor="soon-sso-url">
            {t('soon.sso.field')} <span className="stg-soon">{t('shell.soon')}</span>
          </label>
          <div id="soon-sso-help" className="stg-help">
            {t('soon.sso.wait')}
          </div>
        </div>
        <div className="stg-ctl">
          <input
            id="soon-sso-url"
            className="fd-input"
            disabled
            placeholder="https://"
            aria-describedby="soon-sso-help"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Paramètres › Sécurité, maquette lot1-parametres/securite : Captures HTML, Règles de partage et Connexion
 * unique en sections du gabarit, avec un seul « Annuler / Enregistrer » dans la barre de page pour les
 * deux réglages (chaque section garde son brouillon et son enregistrement).
 */
export function SecuritySettings() {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  const parts = useSaveParts();
  const { Provider } = parts;
  return (
    <SettingsShell
      legacy={false}
      actions={
        can('workspace.settings') ? (
          <>
            {/* Inactifs sans changement : rien à annuler ni à enregistrer */}
            <Button onClick={parts.resetAll} disabled={parts.busy || !parts.dirty}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void parts.saveAll()}
              disabled={parts.busy || !parts.dirty || parts.invalid}
            >
              {t('common.save')}
            </Button>
          </>
        ) : undefined
      }
    >
      <Provider>
        <HtmlCaptureCard />
        <ShareRulesCard />
        <SsoSection />
      </Provider>
    </SettingsShell>
  );
}
