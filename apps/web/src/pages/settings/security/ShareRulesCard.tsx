import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Link2 } from 'lucide-react';
import { Button, Modal, Select } from '@flowdsiml/ui';
import { APP_NAME } from '@flowdsiml/core';
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';
import { errorMessage } from '../../../lib/errors';
import { LINK_DAYS, shareRulesChanged, useShareRules, type ShareRules } from '../../../lib/shareRules';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import { useSavePart } from './saveParts';

type Preview = {
  count: number;
  locked: number;
  items: Array<{ title: string; kind: 'mode' | 'expiry' | 'custom'; mode: string | null }>;
};

/**
 * L27-06 / L27-07 / L27-10 : Paramètres > Sécurité, carte « Règles de partage » (L48-A : toutes les offres).
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
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  useEffect(() => setDraft(saved), [saved]);

  const isAdmin = can('workspace.settings');
  // L48-A : plus réservé à une offre ; seul le rôle compte
  const locked = !isAdmin;
  const why = `${id}-role`;
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

  useSavePart('rules', {
    dirty,
    busy,
    invalid: modesEmpty,
    save: () => save(null),
    reset: () => {
      setDraft(saved);
      setError(null);
    },
  });

  const text = (label: string, help: string, labelId?: string, helpId?: string) => (
    <div className="stg-text" data-gap-exempt="">
      <div className="stg-lab" id={labelId}>
        {label}
      </div>
      <div className="stg-help" id={helpId}>
        {help}
      </div>
    </div>
  );

  return (
    <section className="stg-sec sr-card" aria-labelledby={`${id}-t`}>
      <div className="stg-sec__head">
        <div>
          <h2 id={`${id}-t`}>{t('rules.title')}</h2>
          <p>{t('rules.sub')}</p>
        </div>
      </div>
      {!isAdmin && (
        <p className="stg-help sr-role" id={`${id}-role`}>
          {t('rules.roleNote')}
        </p>
      )}
      {/* §18.6 : rangées à filets, l'écart est porté par leur padding de 20 px */}
      <div data-gap-exempt="">
        <fieldset
          className="stg-row stg-fieldset"
          aria-describedby={[`${id}-modes-h`, modesEmpty ? `${id}-modes-err` : ''].filter(Boolean).join(' ')}
        >
          <legend className="sr-only">{t('rules.modes')}</legend>
          {text(t('rules.modes'), t('rules.modesHelp'), undefined, `${id}-modes-h`)}
          <div className="stg-ctl sr-checks">
            <div className="stg-opts" data-gap-exempt="">
              {(['link', 'password', 'invite', 'domain'] as const).map((m) => (
                <label key={m} className="stg-opt stg-opt--check">
                  <input
                    type="checkbox"
                    checked={draft.modes.includes(m)}
                    aria-invalid={modesEmpty || undefined}
                    {...off()}
                    onChange={(e) => !locked && setModes(m, e.target.checked)}
                    onClick={(e) => locked && e.preventDefault()}
                  />
                  {t(`access.mode.${m}`)}
                </label>
              ))}
            </div>
            {modesEmpty && (
              <p className="stg-error" id={`${id}-modes-err`} role="alert">
                <CircleAlert size={16} aria-hidden="true" />
                {t('rules.modesEmpty')}
              </p>
            )}
          </div>
        </fieldset>

        <div className="stg-row">
          {text(t('rules.maxDays'), t('rules.maxDaysHelp'), `${id}-days`, `${id}-days-h`)}
          <div className="stg-ctl">
            <Select
              className="stg-short"
              aria-labelledby={`${id}-days`}
              aria-describedby={locked ? `${why} ${id}-days-h` : `${id}-days-h`}
              disabled={locked}
              value={draft.max_link_days === null ? '' : String(draft.max_link_days)}
              onChange={(e) =>
                setDraft((d) => ({ ...d, max_link_days: e.target.value ? Number(e.target.value) : null }))
              }
              options={[
                { value: '', label: t('rules.noLimit') },
                ...LINK_DAYS.map((n) => ({ value: String(n), label: t('rules.days', { count: n }) })),
              ]}
            />
          </div>
        </div>

        <fieldset className="stg-row stg-fieldset" aria-describedby={`${id}-pub-h`}>
          <legend className="sr-only">{t('rules.publish')}</legend>
          {text(t('rules.publish'), t('rules.publishHelp'), undefined, `${id}-pub-h`)}
          <div className="stg-ctl sr-checks">
            <div className="stg-opts" data-gap-exempt="">
              {(['editor', 'admin'] as const).map((r) => (
                <label key={r} className="stg-opt">
                  <input
                    type="radio"
                    name={`${id}-pub`}
                    checked={draft.publish_role === r}
                    {...off()}
                    onChange={guard(() => setDraft((d) => ({ ...d, publish_role: r })))}
                    onClick={(e) => locked && e.preventDefault()}
                  />
                  <span>
                    <b>{t(`rules.publish_${r}`)}</b>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <div className="stg-row stg-row--inline">
          {text(t('rules.exports', { app: APP_NAME }), t('rules.exportsHelp'), `${id}-exp`, `${id}-exp-h`)}
          <div className="stg-ctl">
            <label className="fd-switch">
              <input
                type="checkbox"
                role="switch"
                aria-labelledby={`${id}-exp`}
                checked={draft.exports_allowed}
                {...off(`${id}-exp-h`)}
                onChange={(e) => !locked && setDraft((d) => ({ ...d, exports_allowed: e.target.checked }))}
                onClick={(e) => locked && e.preventDefault()}
              />
              <span className="fd-switch__track" aria-hidden="true" />
            </label>
          </div>
        </div>
      </div>
      {error && (
        <p className="stg-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
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
  const [fix, setFix] = useState(true);
  const more = preview.count - preview.items.length;
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<Link2 />}
      title={t('rules.conflictsTitle', { count: preview.count })}
      closeLabel={t('common.close')}
      className="sr-dialog"
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" aria-disabled={busy || undefined} onClick={() => !busy && onConfirm(fix)}>
            {t('rules.save')}
          </Button>
        </>
      }
    >
      <div className="sr-c-body">
        <ul className="sr-c-list">
          {preview.items.map((x, i) => (
            <li key={i}>
              <b>{x.title}</b>{' '}
              <span className="stg-muted">
                · {x.kind === 'mode' ? t(`access.mode.${x.mode ?? 'link'}`) : t(`rules.kind_${x.kind}`)}
              </span>
            </li>
          ))}
        </ul>
        {more > 0 && <p className="stg-help">{t('rules.andMore', { count: more })}</p>}
      </div>
      <fieldset className="stg-fieldset sr-c-choices">
        <legend className="sr-only">{t('rules.conflictsChoice')}</legend>
        <div className="stg-opts" data-gap-exempt="">
          <label className="stg-opt sr-c-opt">
            <input type="radio" name="sr-fix" checked={fix} onChange={() => setFix(true)} />
            <span>
              <b>{t('rules.fixNow')}</b>
              <span className="stg-help">{t('rules.fixNowHelp')}</span>
              {preview.locked > 0 && (
                <span className="stg-help sr-c-warn">{t('rules.lockedWarn', { count: preview.locked })}</span>
              )}
            </span>
          </label>
          <label className="stg-opt sr-c-opt">
            <input type="radio" name="sr-fix" checked={!fix} onChange={() => setFix(false)} />
            <span>
              <b>{t('rules.keep')}</b>
            </span>
          </label>
        </div>
      </fieldset>
    </Modal>
  );
}
