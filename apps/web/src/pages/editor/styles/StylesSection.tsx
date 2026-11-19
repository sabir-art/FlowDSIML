import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Theme } from '@flowdsiml/manifest';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';
import { Menu } from '../../../components/Menu';
import { useToast } from '../../../components/Toast';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useAuth } from '../../../auth/AuthProvider';
import { PRESETS, asStyleTokens, pickTokens, sameTokens, type StyleTokens } from './presets';
import './styles.css';

const NAME_MAX = 40;
type WsStyle = Tables<'themes'>;

/**
 * Carte d'un style (L18 §4), réutilisée par Paramètres > Marque (L27 §3.3). Sans `onApply`, la carte
 * n'est pas un bouton (la grille de la marque n'applique rien).
 */
export function StyleCard({
  name,
  tokens,
  active,
  current,
  badges = [],
  byline,
  disabled,
  onApply,
  menu,
  nameSlot,
  sample,
}: {
  name: string;
  tokens: StyleTokens;
  active?: boolean;
  /** Style par défaut de l'espace (aria-current, bordure). */
  current?: boolean;
  badges?: Array<{ text: string; tone?: 'warning' }>;
  byline?: string;
  disabled?: boolean;
  onApply?: () => void;
  menu?: ReactNode;
  /** Remplace le nom (renommage en place). */
  nameSlot?: ReactNode;
  sample: { title: string; next: string };
}) {
  const vars = {
    '--st-bg': tokens.background,
    '--st-tip': tokens.surface,
    '--st-text': tokens.text,
    '--st-primary': tokens.primary,
    '--st-on': tokens.onPrimary,
    '--st-hot': tokens.hotspot,
    '--st-r': `${Math.min(tokens.radius, 14)}px`,
    '--st-br': `${Math.min(tokens.buttonRadius, 99)}px`,
    '--st-font': tokens.fontFamily,
  } as CSSProperties;
  const body = (
    <>
      <span className="sty-view" style={vars} aria-hidden="true">
        <span className="sty-bubble">
          {sample.title}
          <span className="sty-cta">{sample.next}</span>
        </span>
        <span className="sty-dot" />
      </span>
      {nameSlot ?? (
        <span className="sty-name">
          {name}
          {badges.map((b) => (
            <span key={b.text} className={`badge badge-xs${b.tone ? ` badge-${b.tone}` : ''}`}>
              {b.text}
            </span>
          ))}
        </span>
      )}
      {byline && <span className="sty-by t-caption muted">{byline}</span>}
      <span className="sty-swatches" aria-hidden="true">
        {[tokens.primary, tokens.hotspot, tokens.background].map((c, i) => (
          <span key={i} style={{ background: c }} />
        ))}
      </span>
    </>
  );
  return (
    <div
      className={`sty-card${active ? ' is-active' : ''}${current ? ' is-default' : ''}`}
      aria-current={current ? 'true' : undefined}
    >
      {onApply ? (
        <button
          type="button"
          className="sty-btn"
          aria-pressed={!!active}
          disabled={disabled}
          onClick={onApply}
        >
          {body}
        </button>
      ) : (
        <div className="sty-btn sty-static">{body}</div>
      )}
      {menu}
    </div>
  );
}

/**
 * L18-05 : « Choisir un style » en tête de l'onglet Design. Un clic applique le style à toute la
 * démo (couleurs, forme, police) ; les réglages fins restent modifiables (« Style personnalisé »).
 * Styles du workspace (table themes) : « Enregistrer le style actuel », Renommer, Supprimer.
 * L27 §2 : renommer = admin ou auteur ; supprimer = admin, sauf le style par défaut.
 */
export function StylesSection({
  wsId,
  theme,
  readOnly,
  onApply,
}: {
  wsId: string;
  theme: Theme;
  readOnly: boolean;
  /** Applique ces valeurs au thème de la démo (null : rétablir l'état d'avant, pour « Annuler »). */
  onApply: (tokens: StyleTokens) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { can } = useWorkspace();
  const uid = useAuth().user?.id;
  const isAdmin = can('workspace.settings');
  const [all, setAll] = useState<WsStyle[]>([]);
  // L27 : la ligne du style livré par défaut (builtin_key) n'est pas un style de l'espace
  const mine = all.filter((m) => !m.builtin_key);
  const defaultRow = all.find((m) => m.is_default);
  const defaultKey = defaultRow ? defaultRow.builtin_key : 'dsi';
  const [naming, setNaming] = useState<WsStyle | 'new' | null>(null);
  const [deleting, setDeleting] = useState<WsStyle | null>(null);
  const current = pickTokens(theme);

  const load = useCallback(async () => {
    const { data } = await supabase.from('themes').select('*').eq('workspace_id', wsId).order('created_at');
    setAll(data ?? []);
  }, [wsId]);
  useEffect(() => {
    void load();
  }, [load]);

  const sample = { title: t('editor.styles.sampleTitle'), next: t('editor.styles.sampleNext') };
  const presetName = (id: string) => t(`editor.styles.preset_${id}`);
  const active =
    PRESETS.find((p) => sameTokens(current, p.tokens))?.id ??
    mine.find((m) => sameTokens(current, asStyleTokens(m.tokens)))?.id ??
    null;

  function apply(name: string, tokens: StyleTokens) {
    const before = current;
    onApply(tokens);
    toast(t('editor.styles.applied', { name }), {
      label: t('editor.styles.undo'),
      durationMs: 8000,
      onClick: () => onApply(before),
    });
  }

  return (
    <div className="sec sty-sec">
      <div className="sec-title">
        <span id="sty-title">{t('editor.styles.title')}</span>
        {!active && <span className="badge badge-xs sty-custom">{t('editor.styles.custom')}</span>}
      </div>
      <div className="sty-grid" role="group" aria-labelledby="sty-title">
        {PRESETS.map((p) => (
          <StyleCard
            key={p.id}
            name={presetName(p.id)}
            tokens={p.tokens}
            active={active === p.id}
            badges={defaultKey === p.id ? [{ text: t('editor.styles.default') }] : []}
            disabled={readOnly}
            sample={sample}
            onApply={() => apply(presetName(p.id), p.tokens)}
          />
        ))}
        {mine.map((m) => {
          const items = [
            ...(isAdmin || m.created_by === uid
              ? [{ label: t('editor.styles.rename'), icon: <Pencil />, onSelect: () => setNaming(m) }]
              : []),
            ...(isAdmin && !m.is_default
              ? [
                  {
                    label: t('editor.styles.delete'),
                    icon: <Trash2 />,
                    danger: true,
                    onSelect: () => setDeleting(m),
                  },
                ]
              : []),
          ];
          return (
            <StyleCard
              key={m.id}
              name={m.name}
              tokens={asStyleTokens(m.tokens)}
              active={active === m.id}
              badges={m.is_default ? [{ text: t('editor.styles.default') }] : []}
              disabled={readOnly}
              sample={sample}
              onApply={() => apply(m.name, asStyleTokens(m.tokens))}
              menu={
                !readOnly &&
                items.length > 0 && (
                  <span className="sty-menu">
                    <Menu label={t('editor.styles.actionsFor', { name: m.name })} items={items} />
                  </span>
                )
              }
            />
          );
        })}
      </div>
      {!readOnly && (
        <button type="button" className="btn btn-secondary btn-sm sty-save" onClick={() => setNaming('new')}>
          <Plus aria-hidden="true" />
          {t('editor.styles.save')}
        </button>
      )}
      {naming && (
        <NameDialog
          initial={naming === 'new' ? '' : naming.name}
          title={naming === 'new' ? t('editor.styles.saveTitle') : t('editor.styles.renameTitle')}
          taken={mine.filter((m) => naming === 'new' || m.id !== naming.id).map((m) => m.name)}
          onClose={() => setNaming(null)}
          onSave={async (name) => {
            if (naming === 'new')
              check(
                await supabase.from('themes').insert({
                  workspace_id: wsId,
                  name,
                  tokens: current as unknown as Tables<'themes'>['tokens'],
                }),
              );
            else check(await supabase.from('themes').update({ name }).eq('id', naming.id));
            toast(t(naming === 'new' ? 'editor.styles.saved' : 'editor.styles.renamed', { name }));
            setNaming(null);
            void load();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        danger
        title={t('editor.styles.deleteTitle', { name: deleting?.name ?? '' })}
        body={t('editor.styles.deleteBody')}
        confirmLabel={t('editor.styles.delete')}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          check(await supabase.from('themes').delete().eq('id', deleting!.id));
          setDeleting(null);
          void load();
        }}
      />
    </div>
  );
}

function NameDialog({
  initial,
  title,
  taken,
  onClose,
  onSave,
}: {
  initial: string;
  title: string;
  taken: string[];
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setErr(t('editor.styles.nameEmpty'));
    if (taken.some((x) => x.toLowerCase() === n.toLowerCase())) return setErr(t('editor.styles.nameTaken'));
    setBusy(true);
    try {
      await onSave(n);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={ref} className="mk sty-dialog" aria-labelledby="sty-name-t" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="modal-head">
          <h2 id="sty-name-t">{title}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={() => ref.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="sty-name">{t('editor.styles.name')}</label>
            <input
              id="sty-name"
              className="input"
              autoFocus
              maxLength={NAME_MAX}
              value={name}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? 'sty-name-err' : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setErr(null);
              }}
            />
            {err && (
              <p id="sty-name-err" className="field-error">
                {err}
              </p>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
