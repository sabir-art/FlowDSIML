import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';
import { errorMessage } from '../../../lib/errors';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import { useSavePart } from './saveParts';

/**
 * Sandbox v2 (décision du chef, docs/tech/sandbox-v2.md §8) : garde-fou d'espace du « Sandbox vivant ».
 * Autorisé par défaut ; un propriétaire ou un administrateur peut l'interdire (RPC set_sandbox_live,
 * journalisée). Interdit, les démos restent des copies fixes, même si leur réglage est activé. Même ligne
 * de réglage que les autres cartes de la page, enregistrée par « Enregistrer ».
 */
export function SandboxLiveCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { current, can } = useWorkspace();
  const ws = current!;
  const id = useId();
  const [saved, setSaved] = useState(true);
  const [draft, setDraft] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !can('workspace.settings');

  useEffect(() => {
    let alive = true;
    void supabase.rpc('sandbox_live_allowed', { p_ws: ws.id }).then(({ data, error: e }) => {
      if (!alive || e) return;
      setSaved(data !== false);
      setDraft(data !== false);
    });
    return () => {
      alive = false;
    };
  }, [ws.id]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      check(await supabase.rpc('set_sandbox_live', { p_ws: ws.id, p_on: draft }));
      setSaved(draft);
      toast(t('sandboxLive.saved'));
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  useSavePart('sandboxLive', {
    dirty: draft !== saved,
    busy,
    invalid: false,
    save,
    reset: () => {
      setDraft(saved);
      setError(null);
    },
  });

  return (
    <section className="stg-sec" aria-labelledby={`${id}-t`}>
      <div className="stg-sec__head">
        <div>
          <h2 id={`${id}-t`}>{t('sandboxLive.title')}</h2>
          <p>{t('sandboxLive.help')}</p>
        </div>
      </div>
      <div className="stg-row stg-row--inline">
        <div className="stg-text" data-gap-exempt="">
          <div className="stg-lab" id={`${id}-l`}>
            {t('sandboxLive.label')}
          </div>
          <div className="stg-help" id={`${id}-h`}>
            {locked ? t('sandboxLive.readOnly') : t('sandboxLive.labelHelp')}
          </div>
        </div>
        <div className="stg-ctl">
          <label className="fd-switch">
            <input
              type="checkbox"
              role="switch"
              aria-labelledby={`${id}-l`}
              aria-describedby={`${id}-h`}
              aria-disabled={locked || undefined}
              checked={draft}
              onChange={(e) => !locked && setDraft(e.target.checked)}
              onClick={(e) => locked && e.preventDefault()}
            />
            <span className="fd-switch__track" aria-hidden="true" />
          </label>
        </div>
      </div>
      {error && (
        <p className="stg-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
