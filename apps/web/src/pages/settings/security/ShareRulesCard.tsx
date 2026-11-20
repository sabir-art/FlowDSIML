import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { APP_NAME } from '@flowdsiml/core';
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';
import { errorMessage } from '../../../lib/errors';
import { LINK_DAYS, shareRulesChanged, useShareRules, type ShareRules } from '../../../lib/shareRules';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import './security.css';

type Preview = {
  count: number;
  locked: number;
  items: Array<{ title: string; kind: 'mode' | 'expiry' | 'custom'; mode: string | null }>;
};

/**
 * L27-06 / L27-07 / L27-10 : Paramètres > Sécurité, carte « Règles de partage » (Enterprise).
 * Administrateurs et propriétaires : modifiables ; autres rôles et plans inférieurs : valeurs actuelles,
 * désactivées (aria-disabled, focalisables, explication reliée). Enregistrer une règle plus stricte
 * annonce les liens actifs qui ne la respectent pas et propose de les mettre en conformité.
 */
export function ShareRulesCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { current, can } = useWorkspace();
  const ws = current!;
  const saved = useShareRules(ws.id);
  const [draft, setDraft] = useState<ShareRules>(saved);
  const [enterprise, setEnterprise] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  useEffect(() => setDraft(saved), [saved]);
  useEffect(() => {
    void supabase
      .from('plans')
      .select('limits')
      .eq('code', ws.plan_code)
      .maybeSingle()
      .then(({ data }) => setEnterprise(!!(data?.limits as { share_rules?: boolean } | null)?.share_rules));
  }, [ws.plan_code]);

  const isAdmin = can('workspace.settings');
  const locked = !isAdmin || enterprise === false;
  const why = enterprise === false ? `${id}-plan` : `${id}-role`;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const modesEmpty = draft.modes.length === 0;

  async function save(fix: boolean | null) {
    setBusy(true);
    setError(null);
    try {
      if (fix === null) {
        // Liens actifs qui ne respecteraient pas les nouvelles règles
        const { data, error: e } = await supabase.rpc('share_rules_preview', {
          p_ws: ws.id,
          p_modes: draft.modes,
          p_max_days: draft.max_link_days,
        });
        if (e) throw e;
        const p = data as unknown as Preview;
        if (p.count > 0) return setConflicts(p);
      }
      check(
        await supabase.rpc('set_share_rules', {
          p_ws: ws.id,
          p_modes: draft.modes,
          p_max_days: draft.max_link_days,
          p_publish_role: draft.publish_role,
          p_exports: draft.exports_allowed,
          p_fix: !!fix,
        }),
      );
      setConflicts(null);
      shareRulesChanged(ws.id);
      toast(t('rules.saved'));
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  // Contrôle désactivé par le rôle ou le plan : aria-disabled, focalisable, explication reliée
  const off = (extra?: string) =>
    locked
      ? { 'aria-disabled': true as const, 'aria-describedby': [why, extra].filter(Boolean).join(' ') }
      : {};
  const guard = (fn: () => void) => () => {
    if (!locked) fn();
  };
  const setModes = (m: string, on: boolean) =>
    setDraft((d) => ({ ...d, modes: on ? [...new Set([...d.modes, m])] : d.modes.filter((x) => x !== m) }));

  const row = (label: string, help: string, control: ReactNode, labelId?: string) => (
    <div className="sr-row">
      <div>
        <b id={labelId}>{label}</b>
        <p className="t-caption muted">{help}</p>
      </div>
      <div className="sr-ctl">{control}</div>
    </div>
  );

  return (
    <section className="card sr-card" aria-labelledby={`${id}-t`}>
      <div className="sr-head">
        <h3 className="t-h3" id={`${id}-t`}>
          {t('rules.title')} {enterprise === false && <span className="badge badge-brand">Enterprise</span>}
        </h3>
        {enterprise === false && (
          <Link className="mk-link" to="/settings/plans">
            {t('rules.seePlans')}
          </Link>
        )}
      </div>
      {enterprise === false ? (
        <p className="t-caption muted" id={`${id}-plan`}>
          {t('rules.planNote')}
        </p>
      ) : (
        !isAdmin && (
          <p className="t-caption muted" id={`${id}-role`}>
            {t('rules.roleNote')}
          </p>
        )
      )}

      <fieldset
        className="sr-row sr-fieldset"
        aria-describedby={[`${id}-modes-h`, modesEmpty ? `${id}-modes-err` : ''].filter(Boolean).join(' ')}
      >
        <legend className="sr-only">{t('rules.modes')}</legend>
        <div>
          <b aria-hidden="true">{t('rules.modes')}</b>
          <p className="t-caption muted" id={`${id}-modes-h`}>
            {t('rules.modesHelp')}
          </p>
        </div>
        <div className="sr-ctl sr-checks">
          {(['link', 'password', 'invite', 'domain'] as const).map((m) => (
            <label key={m} className="check">
              <input
                type="checkbox"
                checked={draft.modes.includes(m)}
                {...off()}
                onChange={(e) => !locked && setModes(m, e.target.checked)}
                onClick={(e) => locked && e.preventDefault()}
              />
              {t(`access.mode.${m}`)}
            </label>
          ))}
          {modesEmpty && (
            <p className="field-error" id={`${id}-modes-err`} role="alert">
              {t('rules.modesEmpty')}
            </p>
          )}
        </div>
      </fieldset>

      {row(
        t('rules.maxDays'),
        t('rules.maxDaysHelp'),
        <select
          className="select input-sm"
          aria-labelledby={`${id}-days`}
          value={draft.max_link_days ?? ''}
          {...off()}
          onChange={(e) =>
            !locked &&
            setDraft((d) => ({ ...d, max_link_days: e.target.value ? Number(e.target.value) : null }))
          }
        >
          <option value="">{t('rules.noLimit')}</option>
          {LINK_DAYS.map((n) => (
            <option key={n} value={n}>
              {t('rules.days', { count: n })}
            </option>
          ))}
        </select>,
        `${id}-days`,
      )}

      <fieldset className="sr-row sr-fieldset" aria-describedby={`${id}-pub-h`}>
        <legend className="sr-only">{t('rules.publish')}</legend>
        <div>
          <b aria-hidden="true">{t('rules.publish')}</b>
          <p className="t-caption muted" id={`${id}-pub-h`}>
            {t('rules.publishHelp')}
          </p>
        </div>
        <div className="sr-ctl sr-checks">
          {(['editor', 'admin'] as const).map((r) => (
            <label key={r} className="check">
              <input
                type="radio"
                name={`${id}-pub`}
                checked={draft.publish_role === r}
                {...off()}
                onChange={guard(() => setDraft((d) => ({ ...d, publish_role: r })))}
                onClick={(e) => locked && e.preventDefault()}
              />
              {t(`rules.publish_${r}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {row(
        t('rules.exports'),
        t('rules.exportsHelp'),
        <label className="sr-switch">
          <span>{t('rules.exportsLabel', { app: APP_NAME })}</span>
          <span className="switch">
            <input
              type="checkbox"
              checked={draft.exports_allowed}
              {...off()}
              onChange={(e) => !locked && setDraft((d) => ({ ...d, exports_allowed: e.target.checked }))}
              onClick={(e) => locked && e.preventDefault()}
            />
            <span />
          </span>
        </label>,
      )}

      <p className="t-caption muted sr-foot">{t('rules.footer')}</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!locked && (
        <div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!dirty || modesEmpty || busy}
            onClick={() => void save(null)}
          >
            {t('rules.save')}
          </button>
        </div>
      )}
      {conflicts && (
        <ConflictsDialog
          preview={conflicts}
          busy={busy}
          onClose={() => setConflicts(null)}
          onConfirm={(fix) => void save(fix)}
        />
      )}
    </section>
  );
}

/** L27-07 : liens actifs qui ne respectent pas les nouvelles règles. */
function ConflictsDialog({
  preview,
  busy,
  onClose,
  onConfirm,
}: {
  preview: Preview;
  busy: boolean;
  onClose: () => void;
  onConfirm: (fix: boolean) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [fix, setFix] = useState(true);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const more = preview.count - preview.items.length;
  return (
    <dialog ref={ref} className="mk sr-dialog" aria-labelledby="sr-c-t" onClose={onClose}>
      <div className="modal-head">
        <h2 id="sr-c-t">{t('rules.conflictsTitle', { count: preview.count })}</h2>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={t('common.close')}
          onClick={() => ref.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="modal-body sr-c-body">
        <ul className="sr-c-list">
          {preview.items.map((x, i) => (
            <li key={i}>
              <b>{x.title}</b>{' '}
              <span className="muted">
                · {x.kind === 'mode' ? t(`access.mode.${x.mode ?? 'link'}`) : t(`rules.kind_${x.kind}`)}
              </span>
            </li>
          ))}
        </ul>
        {more > 0 && <p className="t-caption muted">{t('rules.andMore', { count: more })}</p>}
        <fieldset className="sr-fieldset sr-c-choices">
          <legend className="sr-only">{t('rules.conflictsChoice')}</legend>
          <label className="check sr-c-opt">
            <input type="radio" name="sr-fix" checked={fix} onChange={() => setFix(true)} />
            <span>
              <b>{t('rules.fixNow')}</b>
              <span className="t-caption muted">{t('rules.fixNowHelp')}</span>
              {preview.locked > 0 && (
                <span className="t-caption sr-c-warn">
                  {t('rules.lockedWarn', { count: preview.locked })}
                </span>
              )}
            </span>
          </label>
          <label className="check sr-c-opt">
            <input type="radio" name="sr-fix" checked={!fix} onChange={() => setFix(false)} />
            <span>
              <b>{t('rules.keep')}</b>
            </span>
          </label>
        </fieldset>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onConfirm(fix)}>
          {t('rules.save')}
        </button>
      </div>
    </dialog>
  );
}
