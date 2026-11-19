import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { check } from '../../lib/useAction';
import { errorMessage } from '../../lib/errors';
import { addressPrefix } from '../../lib/embed';
import { checkLabel, normalizeLabel, splitAddress, type LabelState } from '../../lib/address';
import { useToast } from '../../components/Toast';

/**
 * L28-01 : adresse personnalisée de la démo (#/l/<partie lisible>-<suffixe>). La partie lisible est validée
 * à la frappe (400 ms), sans appel serveur : le suffixe tiré par le serveur rend l'adresse unique et une
 * partie lisible déjà utilisée ailleurs ne révèle rien. #/d/<id> reste toujours valable.
 */
export function AddressField({
  demoId,
  editable,
  address,
  onSaved,
}: {
  demoId: string;
  editable: boolean;
  /** Adresse courante (null : aucune). */
  address: string | null;
  onSaved: (address: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const current = address ? splitAddress(address) : null;
  const [label, setLabel] = useState(current?.label ?? '');
  const [state, setState] = useState<LabelState | 'typing' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setLabel(current?.label ?? ''), [current?.label]);
  useEffect(() => {
    if (!label || label === current?.label) return setState(null);
    setState('typing');
    const id = window.setTimeout(() => setState(checkLabel(label)), 400);
    return () => window.clearTimeout(id);
  }, [label, current?.label]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const a = check(await supabase.rpc('set_demo_address', { p_demo: demoId, p_label: label })) as string;
      onSaved(a);
      setState(null);
      toast(t('share.address.saved'));
    } catch (e) {
      setErr(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  const prefix = addressPrefix();
  if (!editable)
    return (
      <div className="field">
        <span className="label">{t('share.customAddress')}</span>
        <p className="t-mono sh-addr-ro">{address ? `${prefix}${address}` : t('share.address.none')}</p>
      </div>
    );

  const bad = state === 'invalid' || state === 'reserved';
  return (
    <div className="field">
      <label htmlFor="sh-slug">{t('share.customAddress')}</label>
      <div className="input-group sh-addr">
        <span className="input t-mono muted sh-prefix">{prefix}</span>
        <input
          id="sh-slug"
          className="input t-mono sh-slug"
          value={label}
          spellCheck={false}
          maxLength={48}
          aria-describedby="sh-slug-state sh-slug-help"
          aria-invalid={bad || undefined}
          onChange={(e) => setLabel(normalizeLabel(e.target.value))}
        />
        <span className="input t-mono muted sh-suffix" aria-hidden="true">
          -{current && label === current.label ? current.suffix : 'xxxxxx'}
        </span>
      </div>
      {bad ? (
        <span className="err-line" id="sh-slug-state" role="alert">
          <CircleAlert aria-hidden="true" />
          {t(state === 'reserved' ? 'share.address.reserved' : 'share.address.invalid')}
        </span>
      ) : (
        <span className="ok-line" id="sh-slug-state" role="status">
          {state === 'valid' && (
            <>
              <CircleCheck aria-hidden="true" />
              {t('share.address.valid')}
            </>
          )}
        </span>
      )}
      {err && (
        <span className="err-line" role="alert">
          <CircleAlert aria-hidden="true" />
          {err}
        </span>
      )}
      <span className="help" id="sh-slug-help">
        {t('share.address.suffixHelp')} {t('share.address.redirectHelp')}
      </span>
      <div className="row sh-addr-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy || state !== 'valid'}
          onClick={() => void save()}
        >
          {t('share.address.save')}
        </button>
      </div>
    </div>
  );
}
