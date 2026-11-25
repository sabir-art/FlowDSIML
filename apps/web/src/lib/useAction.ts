import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from './errors';
import { useToast } from '../components/Toast';

/**
 * Exécute une action asynchrone avec état de chargement, erreur traduite et message de succès.
 * Règle (retour client du 25/11) : une confirmation passagère (copié, envoyé, enregistré…) passe par un
 * toast, jamais par un texte posé dans la page. `inline` est réservé aux écrans d'authentification, où
 * le message est le contenu même de l'écran (« e-mail envoyé ») : lui seul remplit `success`.
 */
export function useAction(opts: { inline?: boolean } = {}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>, successMsg?: string): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMsg) {
        if (opts.inline) setSuccess(successMsg);
        else toast(successMsg);
      }
      return r;
    } catch (e) {
      setError(errorMessage(t, e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, success, run, setError, setSuccess };
}

/** Lève l'erreur d'une réponse Supabase. */
export function check<R extends { data: unknown; error: unknown }>(
  res: R,
): Extract<R, { error: null }>['data'] {
  if (res.error) throw res.error;
  return res.data as Extract<R, { error: null }>['data'];
}
