import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from './errors';

/** Exécute une action asynchrone avec état de chargement, erreur traduite et message de succès. */
export function useAction() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>, successMsg?: string): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMsg) setSuccess(successMsg);
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
