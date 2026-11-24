/**
 * Paramètres › Connexions › Clés d'accès (retours client du 24/11 §6.2 et §6.2.1, maquettes
 * lot1-parametres/cles-*). Propriétaires et administrateurs seulement.
 *  - Une clé ouvre l'API publique v1, en lecture seule, sur les données de cet espace.
 *  - La clé entière n'est montrée qu'une fois, à la création : la base n'en garde qu'un condensé.
 *    La liste montre « tc_ » puis ses 4 derniers caractères.
 *  - Les accès (Démos, Statistiques, Leads) sont fixés à la création.
 *  - Révoquer est immédiat et définitif.
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, CircleAlert, Copy, KeyRound, Plus } from 'lucide-react';
import { Alert, Button, Modal, Select } from '@flowdsiml/ui';
import { SettingsShell } from '../SettingsShell';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu } from '../../../components/Menu';
import { CopyField } from '../../../components/CopyField';
import { formatDate, formatRelativeShort } from '../../../lib/format';
import { errorMessage } from '../../../lib/errors';
import './keys.css';

const SCOPES = ['demos', 'stats', 'leads'] as const;
type Scope = (typeof SCOPES)[number];
/** Expiration en jours ; « never » : sans expiration. */
const EXPIRES = ['never', '30', '90', '365'] as const;
type Expires = (typeof EXPIRES)[number];

interface KeyRow {
  id: string;
  name: string;
  scopes: string[];
  last4: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

/** Adresse de base de l'API de cet environnement. */
export const apiBase = () => `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/api/v1`;
/** Exemple de demande : jamais une vraie clé, un emplacement à remplacer. */
const example = (placeholder: string) =>
  `curl ${apiBase()}/demos \\\n  -H "Authorization: Bearer ${placeholder}"`;
/** Clé telle qu'elle se reconnaît dans la liste : jamais entière. */
const masked = (last4: string) => `tc_••••••••${last4}`;

export function AccessKeys() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const ws = current?.id;
  const allowed = can('integrations.manage');
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [renaming, setRenaming] = useState<KeyRow | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, scopes, last4, created_by, created_at, expires_at, revoked_at, last_used_at')
      .eq('workspace_id', ws)
      .order('created_at', { ascending: false });
    const list = (data ?? []) as KeyRow[];
    setKeys(list);
    const ids = [...new Set(list.map((k) => k.created_by).filter((v): v is string => !!v))];
    if (!ids.length) return;
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    setAuthors(Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name ?? ''])));
  }, [ws]);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed)
    return (
      <SettingsShell legacy={false}>
        <div className="stg-empty" role="status">
          <span className="stg-empty__tile" aria-hidden="true">
            <KeyRound size={20} />
          </span>
          <h2>{t('accessKeys.noAccess')}</h2>
          <div className="stg-empty__acts">
            <Link className="fd-btn" to="/settings/workspace">
              {t('integrations.backGeneral')}
            </Link>
          </div>
        </div>
      </SettingsShell>
    );

  const revoke = async (k: KeyRow) => {
    const yes = await ask({
      title: t('accessKeys.revokeTitle', { name: k.name }),
      body: t('accessKeys.revokeBody'),
      confirmLabel: t('accessKeys.revokeConfirm'),
      danger: true,
      alert: true,
    });
    if (!yes) return;
    const { error } = await supabase.rpc('revoke_api_key', { p_id: k.id });
    if (error) toast(errorMessage(t, error));
    else toast(t('accessKeys.revoked', { name: k.name }));
    void load();
  };
  const addButton = (
    <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
      {t('accessKeys.create')}
    </Button>
  );
  const state = (k: KeyRow) => {
    if (k.revoked_at) return <span className="ak-pill">{t('accessKeys.revokedPill')}</span>;
    if (k.expires_at && new Date(k.expires_at).getTime() <= Date.now())
      return <span className="ak-pill">{t('accessKeys.expiredPill')}</span>;
    return k.last_used_at ? formatRelativeShort(k.last_used_at) : t('accessKeys.neverUsed');
  };

  return (
    <SettingsShell legacy={false} actions={addButton}>
      <section className="stg-sec ak" aria-labelledby="ak-title" aria-busy={keys === null || undefined}>
        <div className="stg-sec__head">
          <div>
            <h2 id="ak-title">{t('accessKeys.title')}</h2>
            {keys?.length !== 0 && <p>{t('accessKeys.sub')}</p>}
          </div>
        </div>
        {keys === null ? null : keys.length === 0 ? (
          <div className="stg-empty">
            <span className="stg-empty__tile" aria-hidden="true">
              <KeyRound size={20} />
            </span>
            <h3>{t('accessKeys.emptyTitle')}</h3>
            <p>{t('accessKeys.emptyBody')}</p>
            <div className="stg-empty__acts">{addButton}</div>
          </div>
        ) : (
          <table className="stg-table ak-table">
            <caption className="sr-only">{t('accessKeys.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('accessKeys.colName')}</th>
                <th scope="col" className="stg-table__m-hide">
                  {t('accessKeys.colScopes')}
                </th>
                <th scope="col">{t('accessKeys.colKey')}</th>
                <th scope="col" className="stg-table__m-hide">
                  {t('accessKeys.colCreated')}
                </th>
                <th scope="col" className="stg-table__m-hide">
                  {t('accessKeys.colLast')}
                </th>
                <th scope="col" className="stg-table__act">
                  <span className="sr-only">{t('accessKeys.colActions')}</span>
                </th>
              </tr>
            </thead>
            {/* §18.6 : lignes à filets de 56 px, l'écart est porté par la hauteur des lignes */}
            <tbody data-gap-exempt="">
              {keys.map((k) => (
                <tr key={k.id} className={k.revoked_at ? 'is-revoked' : undefined}>
                  <td>
                    <b>{k.name}</b>
                    {k.created_by && authors[k.created_by] && (
                      <span className="stg-table__sub">
                        {t('accessKeys.by', { name: authors[k.created_by] })}
                      </span>
                    )}
                  </td>
                  <td className="stg-table__m-hide">
                    <ScopeChips scopes={k.scopes} />
                  </td>
                  <td>
                    <code className="ak-code">{masked(k.last4)}</code>
                  </td>
                  <td className="stg-table__m-hide">{formatDate(k.created_at)}</td>
                  <td className="stg-table__m-hide">{state(k)}</td>
                  <td className="stg-table__act">
                    <Menu
                      label={t('accessKeys.actionsFor', { name: k.name })}
                      items={[
                        { label: t('accessKeys.rename'), onSelect: () => setRenaming(k) },
                        ...(k.revoked_at
                          ? []
                          : [
                              { label: t('accessKeys.revoke'), danger: true, onSelect: () => void revoke(k) },
                            ]),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!!keys?.length && <p className="stg-help ak-note">{t('accessKeys.note')}</p>}
      </section>

      <ApiGuide />

      {creating && ws && (
        <CreateKey
          ws={ws}
          onClose={() => setCreating(false)}
          onCreated={(name, key) => {
            setCreating(false);
            setCreated({ name, key });
            void load();
          }}
        />
      )}
      {created && <CreatedKey name={created.name} secret={created.key} onDone={() => setCreated(null)} />}
      {renaming && (
        <RenameKey
          row={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            setRenaming(null);
            void load();
          }}
        />
      )}
      {dialog}
    </SettingsShell>
  );
}

function ScopeChips({ scopes }: { scopes: string[] }) {
  const { t } = useTranslation();
  return (
    <span className="ak-chips">
      {SCOPES.filter((s) => scopes.includes(s)).map((s) => (
        <span key={s} className="ak-chip">
          {t(`accessKeys.scope.${s}.name`)}
        </span>
      ))}
    </span>
  );
}

/** §6.2.1 : « Utiliser l'API », visible aussi quand la liste est vide. */
function ApiGuide() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const text = example(t('accessKeys.api.placeholder'));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  const rows: Array<{ scope: Scope; path: string }> = [
    { scope: 'demos', path: '/demos' },
    { scope: 'stats', path: '/demos/{id}/stats' },
    { scope: 'leads', path: '/demos/{id}/leads' },
  ];
  return (
    <section className="stg-sec ak-api" aria-labelledby="ak-api-title">
      <div className="stg-sec__head">
        <div>
          <h2 id="ak-api-title">{t('accessKeys.api.title')}</h2>
          <p>{t('accessKeys.api.sub')}</p>
        </div>
      </div>
      <div className="stg-row">
        <div className="stg-text">
          <div className="stg-lab" id="ak-base-lab">
            {t('accessKeys.api.base')}
          </div>
        </div>
        <div className="stg-ctl">
          <CopyField
            label={t('accessKeys.api.base')}
            value={apiBase()}
            copyLabel={t('accessKeys.api.copyBase')}
            copiedText={t('accessKeys.api.baseCopied')}
          />
        </div>
      </div>
      <div className="ak-example">
        <div className="stg-lab" id="ak-ex-lab">
          {t('accessKeys.api.example')}
        </div>
        {/* Seul endroit en chasse fixe ; atteignable au clavier pour le faire défiler */}
        <pre className="ak-pre" tabIndex={0} aria-labelledby="ak-ex-lab">
          {text}
        </pre>
        <Button icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={() => void copy()}>
          {t(copied ? 'accessKeys.api.exampleCopied' : 'accessKeys.api.copyExample')}
        </Button>
        <span className="sr-only" role="status">
          {copied ? t('accessKeys.api.exampleCopied') : ''}
        </span>
      </div>
      <table className="stg-table ak-routes">
        <caption className="sr-only">{t('accessKeys.api.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('accessKeys.api.colWhat')}</th>
            <th scope="col" className="ak-routes__path">
              {t('accessKeys.api.colPath')}
            </th>
            <th scope="col">{t('accessKeys.api.colScope')}</th>
          </tr>
        </thead>
        <tbody data-gap-exempt="">
          {rows.map((r) => (
            <tr key={r.scope}>
              <td>
                <b>{t(`accessKeys.api.what.${r.scope}.name`)}</b>
                <span className="stg-table__sub">
                  {t(`accessKeys.api.what.${r.scope}.help`)}
                  {r.scope === 'leads' && (
                    <>
                      {' '}
                      {t('accessKeys.api.csv')} <code className="ak-code">?format=csv</code>.
                    </>
                  )}
                </span>
              </td>
              <td className="ak-routes__path">
                <code className="ak-code">{r.path}</code>
              </td>
              <td>
                <span className="ak-chip">{t(`accessKeys.scope.${r.scope}.name`)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="stg-help ak-note">{t('accessKeys.api.errors')}</p>
    </section>
  );
}

function CreateKey({
  ws,
  onClose,
  onCreated,
}: {
  ws: string;
  onClose: () => void;
  onCreated: (name: string, key: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const [expires, setExpires] = useState<Expires>('90');
  const [scopes, setScopes] = useState<Scope[]>(['demos']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const none = scopes.length === 0;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    setNameErr(!clean);
    if (!clean || none || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('create_api_key', {
      p_workspace: ws,
      p_name: clean,
      p_scopes: scopes,
      p_expires_days: expires === 'never' ? null : Number(expires),
    });
    setBusy(false);
    const key = (data as { key?: string } | null)?.key;
    if (err || !key) {
      setError(err?.message === 'TROP_DE_CLES' ? t('accessKeys.tooMany') : errorMessage(t, err));
      return;
    }
    onCreated(clean, key);
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<KeyRound />}
      title={t('accessKeys.createTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            type="submit"
            form={`${id}-f`}
            aria-disabled={none || busy || undefined}
            aria-describedby={none ? `${id}-se` : undefined}
          >
            {t('accessKeys.createConfirm')}
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} className="st-invite__form ak-form" onSubmit={submit} noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="fd-modal__field">
          <label htmlFor={`${id}-n`}>{t('accessKeys.name')}</label>
          <input
            id={`${id}-n`}
            className="fd-input"
            autoComplete="off"
            maxLength={80}
            required
            value={name}
            aria-invalid={nameErr || undefined}
            aria-describedby={`${id}-nh`}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameErr(false);
            }}
          />
          <span className={nameErr ? 'stg-error' : 'stg-help'} id={`${id}-nh`}>
            {nameErr && <CircleAlert size={16} aria-hidden="true" />}
            {t(nameErr ? 'accessKeys.nameError' : 'accessKeys.nameHelp')}
          </span>
        </div>
        <div className="fd-modal__field">
          <label htmlFor={`${id}-e`}>{t('accessKeys.expires')}</label>
          <Select
            id={`${id}-e`}
            value={expires}
            aria-describedby={`${id}-eh`}
            onChange={(e) => setExpires(e.target.value as Expires)}
          >
            {EXPIRES.map((x) => (
              <option key={x} value={x}>
                {t(`accessKeys.expiresIn.${x}`)}
              </option>
            ))}
          </Select>
          <span className="stg-help" id={`${id}-eh`}>
            {t('accessKeys.expiresHelp')}
          </span>
        </div>
        <fieldset className="ak-scopes" aria-describedby={`${id}-se`}>
          <legend>{t('accessKeys.scopesLegend')}</legend>
          {SCOPES.map((s) => (
            <label key={s} className="stg-opt">
              <input
                type="checkbox"
                checked={scopes.includes(s)}
                aria-describedby={`${id}-s-${s}`}
                onChange={(e) =>
                  setScopes((list) => (e.target.checked ? [...list, s] : list.filter((x) => x !== s)))
                }
              />
              <span>
                <b>{t(`accessKeys.scope.${s}.name`)}</b>
                <span className="stg-help" id={`${id}-s-${s}`}>
                  {t(`accessKeys.scope.${s}.help`)}
                </span>
              </span>
            </label>
          ))}
          <span className={none ? 'stg-error' : 'stg-help'} id={`${id}-se`} role="status">
            {none && (
              <>
                <CircleAlert size={16} aria-hidden="true" />
                {t('accessKeys.scopesNone')}
              </>
            )}
          </span>
        </fieldset>
      </form>
    </Modal>
  );
}

/** La clé entière, une seule fois. La fenêtre ne se ferme qu'une fois la case cochée. */
function CreatedKey({ name, secret, onDone }: { name: string; secret: string; onDone: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [kept, setKept] = useState(false);
  return (
    <Modal
      open
      onClose={() => undefined}
      size="md"
      role="alertdialog"
      dismissible={false}
      describedBy={`${id}-d`}
      icon={<Check />}
      title={t('accessKeys.createdTitle', { name })}
      closeLabel={t('common.close')}
      footer={
        <Button variant="primary" aria-disabled={!kept || undefined} onClick={() => kept && onDone()}>
          {t('accessKeys.done')}
        </Button>
      }
    >
      <div className="ak-created">
        <div id={`${id}-d`}>
          <Alert kind="warning">{t('accessKeys.createdWarn')}</Alert>
        </div>
        <CopyField
          className="ak-secret"
          label={t('accessKeys.keyLabel', { name })}
          value={secret}
          copyLabel={t('accessKeys.copyKey')}
          copiedText={t('accessKeys.keyCopied')}
        />
        <label className="stg-opt">
          <input type="checkbox" checked={kept} onChange={(e) => setKept(e.target.checked)} />
          <span>{t('accessKeys.keptCheck')}</span>
        </label>
      </div>
    </Modal>
  );
}

function RenameKey({ row, onClose, onSaved }: { row: KeyRow; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const toast = useToast();
  const [name, setName] = useState(row.name);
  const [busy, setBusy] = useState(false);
  const clean = name.trim();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clean || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('rename_api_key', { p_id: row.id, p_name: clean });
    setBusy(false);
    if (error) return toast(errorMessage(t, error));
    onSaved();
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={<KeyRound />}
      title={t('accessKeys.renameTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            type="submit"
            form={`${id}-f`}
            aria-disabled={!clean || busy || undefined}
          >
            {t('accessKeys.renameConfirm')}
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} className="st-invite__form" onSubmit={submit} noValidate>
        <div className="fd-modal__field">
          <label htmlFor={`${id}-n`}>{t('accessKeys.name')}</label>
          <input
            id={`${id}-n`}
            className="fd-input"
            autoComplete="off"
            maxLength={80}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
