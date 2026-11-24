/**
 * Parcours de formation : l'adresse de l'espace affiche la page publique des démos à la place du centre
 * de formation (Paramètres › Page publique, retours client du 24/11 §6.1). Le bandeau le dit et permet de
 * remettre le centre : la page publique est coupée, ses réglages sont conservés.
 */
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Button } from '@flowdsiml/ui';
import type { Json } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { errorMessage } from '../../lib/errors';
import '../settings/brand/public-page.css';

export function PublicPageNotice({
  ws,
  slug,
  page,
  address,
  onRestored,
}: {
  ws: string;
  slug: string;
  /** Réglages de la page publique, renvoyés tels quels (seule l'activation change). */
  page: Json;
  /** Adresse publique, sans le protocole. */
  address: string;
  onRestored: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const restore = async () => {
    const yes = await ask({
      title: t('center.restoreTitle'),
      body: t('center.restoreBody'),
      confirmLabel: t('center.restoreConfirm'),
      alert: true,
    });
    if (!yes) return;
    const { error } = await supabase.rpc('save_public_page', {
      p_ws: ws,
      p_slug: slug,
      p_page: page,
      p_enabled: false,
    });
    if (error) return toast(errorMessage(t, error), undefined, { tone: 'warning' });
    toast(t('center.restored'));
    onRestored();
  };
  return (
    <>
      <div className="stg-banner pp-banner pp-banner--act" role="status">
        <Info size={16} aria-hidden="true" />
        <span>{t('center.replacedBy', { address })}</span>
        <Button onClick={() => void restore()}>{t('center.restore')}</Button>
      </div>
      {dialog}
    </>
  );
}
