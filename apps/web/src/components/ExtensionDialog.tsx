import { useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleCheck, ExternalLink } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useHelp } from '../help/HelpProvider';
import { EXTENSION_URL } from '../lib/env';
import { formatDate } from '../lib/format';

/**
 * L48-A §1 : utilitaire « Extension » de la barre latérale. Pas encore détectée (l'extension n'a jamais
 * appelé extension_seen pour ce compte) : « Installer l'extension », lien vers la boutique et les étapes
 * de l'accueil ; pas encore publiée (VITE_EXTENSION_URL vide, §18.4) : « Extension TutoClick ·
 * Bientôt disponible », une phrase et « Fermer » seul.
 * Détectée : la date de détection et « Lancer une capture ».
 */
export function ExtensionDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const help = useHelp();
  const navigate = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const seen = profile?.extension_seen_at ?? null;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  // §18.4 : extension pas encore publiée et jamais détectée : « Bientôt disponible », « Fermer » seul
  const soon = !seen && !EXTENSION_URL;

  return (
    <dialog ref={ref} className="dialog ext-dialog" onClose={onClose} aria-labelledby={titleId}>
      <div className="dialog-head">
        <h2 id={titleId}>
          {soon ? (
            <>
              {t('extension.soonTitle')} <span className="ext-soon">{t('extension.soon')}</span>
            </>
          ) : (
            t(seen ? 'extension.readyTitle' : 'extension.installTitle')
          )}
        </h2>
      </div>
      <div className="dialog-body">
        {seen ? (
          <p className="ext-ok">
            <CircleCheck size={18} aria-hidden="true" />
            {t('extension.seenOn', { date: formatDate(seen) })}
          </p>
        ) : soon ? (
          <p>{t('extension.soonBody')}</p>
        ) : (
          <>
            <p>{t('extension.intro')}</p>
            <ol className="ext-steps">
              <li>{t('extension.step1')}</li>
              <li>{t('extension.step2')}</li>
              <li>{t('extension.step3')}</li>
            </ol>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                ref.current?.close();
                help?.openArticle('creer-demo-extension');
              }}
            >
              {t('extension.article')}
            </button>
          </>
        )}
      </div>
      <div className="dialog-actions">
        <button type="button" className="fd-btn" onClick={() => ref.current?.close()}>
          {t('common.close')}
        </button>
        {seen ? (
          <button
            type="button"
            className="fd-btn fd-btn--primary"
            onClick={() => {
              ref.current?.close();
              navigate('/?new=1');
            }}
          >
            {t('extension.capture')}
          </button>
        ) : (
          !soon && (
            <a
              className="fd-btn fd-btn--primary"
              href={EXTENSION_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('extension.install')}
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          )
        )}
      </div>
    </dialog>
  );
}
