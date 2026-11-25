/**
 * EMPTY-01 §3 : aperçus des états vides « premier usage ». Petites maquettes du résultat rempli, faites
 * des briques de l'app (lignes, étiquettes, pastilles) avec des données fictives fixes. Décoratifs :
 * EmptyState les rend aria-hidden et inertes. Jetons seulement, donc justes en clair et en sombre.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Copy, KeyRound, Webhook } from 'lucide-react';
import { TagChip } from './Tags';

const Row = ({ children }: { children: ReactNode }) => <div className="fd-es-row">{children}</div>;
const Main = ({ a, b }: { a: ReactNode; b?: ReactNode }) => (
  <span className="fd-es-main">
    <span>{a}</span>
    {b && <span className="fd-es-muted">{b}</span>}
  </span>
);

/** Glossaire : ancien terme (gris) → nouveau terme. */
export function GlossaryPreview() {
  const { t } = useTranslation();
  return (
    <>
      {[1, 2, 3].map((n) => (
        <Row key={n}>
          <span className="fd-es-muted">{t(`emptyPreview.gloss${n}a`)}</span>
          <ArrowRight />
          <span>{t(`emptyPreview.gloss${n}b`)}</span>
        </Row>
      ))}
    </>
  );
}

/** Étiquettes : deux démos avec leurs étiquettes de couleur. */
export function TagsPreview() {
  const { t } = useTranslation();
  const sales = <TagChip tag={{ name: t('emptyPreview.tagSales'), color: 'blue' }} />;
  return (
    <>
      <Row>
        <span className="fd-es-thumb" />
        <Main
          a={t('emptyPreview.demo1')}
          b={
            <span className="fd-es-tags">
              {sales}
              <TagChip tag={{ name: t('emptyPreview.tagTraining'), color: 'green' }} />
            </span>
          }
        />
      </Row>
      <Row>
        <span className="fd-es-thumb" />
        <Main a={t('emptyPreview.demo2')} b={<span className="fd-es-tags">{sales}</span>} />
      </Row>
    </>
  );
}

/** Clés d'accès : nom, clé masquée et date, bouton copier. */
export function KeysPreview() {
  const { t } = useTranslation();
  return (
    <>
      {[1, 2].map((n) => (
        <Row key={n}>
          <KeyRound />
          <Main a={t(`emptyPreview.key${n}`)} b={t(`emptyPreview.key${n}Meta`)} />
          <span className="fd-es-box fd-es-end">
            <Copy />
          </span>
        </Row>
      ))}
    </>
  );
}

/** Webhooks : adresse, événement, état « Actif ». */
export function WebhooksPreview() {
  const { t } = useTranslation();
  return (
    <>
      {[
        ['https://hooks.example.com/leads', t('emptyPreview.hook1')],
        ['https://intranet.example.com/demos', t('emptyPreview.hook2')],
      ].map(([url, event]) => (
        <Row key={url}>
          <Webhook />
          <Main a={url} b={event} />
          <span className="fd-es-dot fd-es-end">{t('emptyPreview.active')}</span>
        </Row>
      ))}
    </>
  );
}

/** Variables : nom de la variable → valeur. */
export function VariablesPreview() {
  const { t } = useTranslation();
  return (
    <>
      {[
        [t('emptyPreview.var1'), 'Camille'],
        [t('emptyPreview.var2'), 'Acme CRM'],
      ].map(([name, value]) => (
        <Row key={name}>
          <span className="fd-es-tag fd-es-mono">{`{{${name}}}`}</span>
          <ArrowRight />
          <span>{value}</span>
        </Row>
      ))}
    </>
  );
}

/** Équipe : personnes invitées, leur rôle, « Invité ». */
export function TeamPreview() {
  const { t } = useTranslation();
  return (
    <>
      {[
        ['Camille Durand', t('roles.editor')],
        ['Sami Leroy', t('roles.viewer')],
      ].map(([name, role]) => (
        <Row key={name}>
          <span className="fd-es-avatar">{name![0]}</span>
          <Main a={name} b={role} />
          <span className="fd-es-tag fd-es-end">{t('members.statusInvited')}</span>
        </Row>
      ))}
    </>
  );
}

/** Intégrations connectées : deux connexions fictives, « Connecté ». */
export function ConnectionsPreview() {
  const { t } = useTranslation();
  return (
    <>
      {[
        ['Slack', t('emptyPreview.conn1')],
        ['Webhook', 'https://hooks.example.com/leads'],
      ].map(([name, detail]) => (
        <Row key={name}>
          <span className="fd-es-box">{name === 'Slack' ? '#' : <Webhook />}</span>
          <Main a={name} b={detail} />
          <span className="fd-es-dot fd-es-end">{t('emptyPreview.connected')}</span>
        </Row>
      ))}
    </>
  );
}
