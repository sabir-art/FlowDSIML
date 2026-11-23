import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Copy, Info, Pencil, Plus, Star, Trash2, TriangleAlert } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { APP_NAME } from '@flowdsiml/core';
import { Button, ColorSwatch } from '@flowdsiml/ui';
import { SettingsShell } from '../SettingsShell';
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';
import { contrastRatio, darkenToContrast, ratioText } from '../../../lib/contrast';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useAuth } from '../../../auth/AuthProvider';
import { useToast } from '../../../components/Toast';
import { Menu, type MenuItem } from '../../../components/Menu';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { MediaLibrary } from '../../../components/media/MediaLibrary';
import { PRESETS, asStyleTokens, type StyleTokens } from '../../editor/styles/presets';
import { styleOk } from '../../editor/styles/styleCheck';
import { STYLE_NAME_MAX, copyName, isHex, logoError, nameTaken } from './brand';
import { StyleDialog } from './StyleDialog';
import './brand.css';
import { FileDropzone } from '../../../components/FileDropzone';

type WsStyle = Tables<'themes'>;
/** Couleurs de la marque par défaut (charte DSI, valeurs des démos). */
const DEFAULT_PRIMARY = '#A3195B';
const DEFAULT_ACCENT = '#D60B52';
type Colors = { primary: string; accent: string };

/**
 * L27-01 / L27-05, lot 1 de la refonte (maquette lot1-parametres/theme) : Paramètres › Thème et couleurs.
 * Trois sections sans carte : logo, couleurs de la marque, styles des démos. Les couleurs s'enregistrent
 * par « Enregistrer » du PageHeader. Droits (§2) vérifiés par la base ; l'interface n'affiche que les
 * actions permises.
 */
export function BrandSettings() {
  const { t } = useTranslation();
  const { current, can, reload } = useWorkspace();
  const toast = useToast();
  const ws = current!;
  const isAdmin = can('workspace.settings');
  const [library, setLibrary] = useState(false);
  const saved: Colors = {
    primary: ws.brand_primary ?? DEFAULT_PRIMARY,
    accent: ws.brand_accent ?? DEFAULT_ACCENT,
  };
  const [vals, setVals] = useState(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setVals(saved), [saved.primary, saved.accent]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = vals.primary !== saved.primary || vals.accent !== saved.accent;
  async function save() {
    setBusy(true);
    try {
      check(
        await supabase
          .from('workspaces')
          .update({ brand_primary: vals.primary, brand_accent: vals.accent })
          .eq('id', ws.id),
      );
      await reload();
      toast(t('brand.colorsSaved'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SettingsShell
      legacy={false}
      actions={
        isAdmin ? (
          <>
            <Button onClick={() => setVals(saved)} disabled={busy || !dirty}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={busy || !dirty}>
              {t('common.save')}
            </Button>
          </>
        ) : undefined
      }
    >
      {!isAdmin && (
        <p className="br-note" role="note">
          <Info size={16} aria-hidden="true" />
          <span>{t('brand.editorNote')}</span>
        </p>
      )}
      <LogoSection ws={ws} isAdmin={isAdmin} onLibrary={() => setLibrary(true)} />
      <ColorsSection vals={vals} setVals={setVals} isAdmin={isAdmin} />
      <StylesSection wsId={ws.id} isAdmin={isAdmin} canCreate={can('demo.edit')} />
      {library && <MediaLibrary wsId={ws.id} onClose={() => setLibrary(false)} />}
    </SettingsShell>
  );
}

// ===== §3.1 Logo =====
function LogoSection({
  ws,
  isAdmin,
  onLibrary,
}: {
  ws: Tables<'workspaces'>;
  isAdmin: boolean;
  onLibrary: () => void;
}) {
  const { t } = useTranslation();
  const { reload } = useWorkspace();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = ws.logo_path
    ? supabase.storage.from('branding').getPublicUrl(ws.logo_path).data.publicUrl
    : null;

  async function upload(file: File) {
    const e = logoError(file);
    if (e) return setErr(t(e === 'format' ? 'brand.logoFormat' : 'brand.logoSize'));
    setErr(null);
    setBusy(true);
    try {
      const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]!.replace('jpeg', 'jpg');
      const path = `${ws.id}/logo-${crypto.randomUUID()}.${ext}`;
      check(await supabase.storage.from('branding').upload(path, file, { contentType: file.type }));
      const old = ws.logo_path;
      check(await supabase.from('workspaces').update({ logo_path: path }).eq('id', ws.id));
      if (old) void supabase.storage.from('branding').remove([old]);
      await reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    const old = ws.logo_path;
    check(await supabase.from('workspaces').update({ logo_path: null }).eq('id', ws.id));
    if (old) void supabase.storage.from('branding').remove([old]);
    await reload();
  }
  return (
    <section className="stg-sec" aria-labelledby="br-logo-t">
      <div className="stg-sec__head">
        <div>
          <h2 id="br-logo-t">{t('brand.logoTitle')}</h2>
          <p>{t('brand.logoHelp')}</p>
        </div>
      </div>
      <div className="stg-row">
        <div className="stg-text" data-gap-exempt="">
          <div className="stg-lab">{t('brand.logoTitle')}</div>
          <div id="br-logo-formats" className="stg-help">
            {t('brand.logoFormats')}
          </div>
        </div>
        <div className="stg-ctl">
          {/* MEDIA-01 §18.1 : zone de dépôt sur toute la ligne ; une source par bouton */}
          <FileDropzone
            label={t('brand.logoTitle')}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hint={t('brand.logoFormats')}
            inputId="br-logo-file"
            describedBy="br-logo-formats"
            readOnly={!isAdmin}
            busy={busy}
            busyLabel={t('brand.logoSending')}
            error={err}
            file={
              url && ws.logo_path
                ? {
                    name: t('brand.logoFile', { name: ws.name }),
                    meta: ws.logo_path.split('.').pop()?.toUpperCase(),
                    preview: <img src={url} alt="" />,
                  }
                : null
            }
            onFiles={(files) => void upload(files[0]!)}
            onLibrary={onLibrary}
            onRemove={() => void remove()}
            removeLabel={t('brand.logoRemove')}
          />
        </div>
      </div>
    </section>
  );
}

// ===== §3.2 Couleurs de la marque =====
function ColorsSection({
  vals,
  setVals,
  isAdmin,
}: {
  vals: Colors;
  setVals: (v: Colors) => void;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();

  const field = (key: keyof Colors, label: string) => {
    const v = vals[key];
    const r = contrastRatio(v, '#FFFFFF');
    const fix = r < 4.5 ? darkenToContrast(v) : null;
    const id = `br-c-${key}`;
    const ratio = t('brand.whiteRatio', {
      ratio: ratioText(r),
      verdict: r >= 4.5 ? t('brand.ok') : t('brand.notOk'),
    });
    return (
      <div className="stg-row" data-color={key}>
        <div className="stg-text" data-gap-exempt="">
          {isAdmin ? (
            <label className="stg-lab" htmlFor={id}>
              {label}
            </label>
          ) : (
            <div className="stg-lab">{label}</div>
          )}
          {r >= 4.5 ? (
            <div id={`${id}-help`} className="stg-help">
              {ratio}
            </div>
          ) : (
            <div id={`${id}-help`} className="stg-help br-warn" role="status">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>
                {ratio}
                {fix && <> {t('brand.proposed', { color: fix })}</>}
              </span>
            </div>
          )}
        </div>
        <div className="stg-ctl">
          <div className="br-colr">
            {isAdmin ? (
              <ColorSwatch
                value={v}
                label={t('brand.picker', { label })}
                labels={{
                  palette: t('common.colorPalette'),
                  shade: t('common.colorShade'),
                  hue: t('common.colorHue'),
                  hex: t('common.colorHex'),
                }}
                onChange={(c) => setVals({ ...vals, [key]: c })}
              />
            ) : (
              <span className="br-swatch" style={{ background: v }} aria-hidden="true" />
            )}
            {isAdmin ? (
              <input
                id={id}
                className="fd-input stg-short"
                maxLength={7}
                spellCheck={false}
                autoComplete="off"
                aria-describedby={`${id}-help`}
                defaultValue={v}
                key={v}
                onBlur={(e) => {
                  const x = e.target.value.trim().toUpperCase();
                  if (isHex(x)) setVals({ ...vals, [key]: x });
                  else e.target.value = v;
                }}
              />
            ) : (
              // Lecture seule (éditeur) : pastille et valeur, comme du texte
              <span id={id}>{v}</span>
            )}
          </div>
          {fix && isAdmin && (
            <Button onClick={() => setVals({ ...vals, [key]: fix })}>{t('brand.useColor')}</Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="stg-sec" aria-labelledby="br-col-t">
      <div className="stg-sec__head">
        <div>
          <h2 id="br-col-t">{t('brand.colorsTitle')}</h2>
          <p>{t('brand.colorsHelp')}</p>
        </div>
      </div>
      {field('primary', t('brand.primary'))}
      {field('accent', t('brand.accent'))}
    </section>
  );
}

/** Couleur du bandeau : la bulle quand elle est sombre (Nuit, Contraste élevé), sinon la couleur principale. */
const bandColor = (k: StyleTokens) => (contrastRatio(k.surface, '#FFFFFF') >= 4.5 ? k.surface : k.primary);

/** Carte d'un style : bandeau de couleur, nom, pastilles, menu « ⋯ ». */
function StyleItem({
  name,
  tokens,
  isDefault,
  byline,
  nameSlot,
  menu,
}: {
  name: string;
  tokens: StyleTokens;
  isDefault: boolean;
  byline?: string;
  nameSlot?: ReactNode;
  menu?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <li className="br-st" aria-current={isDefault ? 'true' : undefined}>
      <span className="br-st__band" style={{ background: bandColor(tokens) }} aria-hidden="true" />
      {/* §18.6 : nom, auteur et pastilles forment un seul bloc de texte (4 px, mesure de la maquette) */}
      <div className="br-st__meta" data-gap-exempt="">
        {nameSlot || <b>{name}</b>}
        {byline && <span className="stg-help">{byline}</span>}
        {isDefault && <span className="stg-pill">{t('editor.styles.default')}</span>}
        {!styleOk(tokens) && (
          <span className="stg-pill br-st__warn">
            <TriangleAlert size={14} aria-hidden="true" />
            {t('brand.lowContrast')}
          </span>
        )}
      </div>
      {menu}
    </li>
  );
}

// ===== §3.3 à 3.7 Styles des démos =====
type Editing = {
  mode: 'new' | 'duplicate' | 'edit';
  source: string;
  id?: string;
  tokens: StyleTokens;
  name: string;
};

function StylesSection({ wsId, isAdmin, canCreate }: { wsId: string; isAdmin: boolean; canCreate: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const uid = useAuth().user?.id;
  const [rows, setRows] = useState<WsStyle[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Editing | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string; err: string | null } | null>(null);
  const [makeDefault, setMakeDefault] = useState<{
    name: string;
    key?: string;
    id?: string;
    n: number | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<WsStyle | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('themes').select('*').eq('workspace_id', wsId).order('created_at');
    setRows(data ?? []);
  }, [wsId]);
  useEffect(() => {
    void load();
    void supabase.rpc('list_members', { p_workspace: wsId }).then(({ data }) => {
      setNames(Object.fromEntries((data ?? []).map((m) => [m.user_id, m.full_name || m.email])));
    });
  }, [load, wsId]);

  const mine = (rows ?? []).filter((r) => !r.builtin_key);
  const defaultRow = (rows ?? []).find((r) => r.is_default) ?? null;
  const defaultKey = defaultRow?.builtin_key ?? (defaultRow ? null : PRESETS[0]!.id);
  const presetName = (id: string) => t(`editor.styles.preset_${id}`);
  const defaultTokens = defaultRow ? asStyleTokens(defaultRow.tokens) : PRESETS[0]!.tokens;
  const takenNames = mine.map((m) => m.name);

  const duplicate = (name: string, tokens: StyleTokens) =>
    setEditing({
      mode: 'duplicate',
      source: name,
      tokens,
      name: copyName(name, takenNames, t('brand.copyWord')),
    });
  const askDefault = (name: string, target: { key?: string; id?: string }) => {
    setMakeDefault({ name, ...target, n: null });
    void supabase.rpc('default_style_impact', { p_ws: wsId }).then(({ data, error }) => {
      if (!error && typeof data === 'number') setMakeDefault((m) => (m ? { ...m, n: data } : m));
    });
  };

  async function rename(id: string, value: string) {
    const n = value.trim();
    if (!n) return setRenaming({ id, value, err: t('editor.styles.nameEmpty') });
    if (
      nameTaken(
        n,
        mine.filter((m) => m.id !== id).map((m) => m.name),
      )
    )
      return setRenaming({ id, value, err: t('editor.styles.nameTaken') });
    check(await supabase.from('themes').update({ name: n }).eq('id', id));
    setRenaming(null);
    toast(t('editor.styles.renamed', { name: n }));
    void load();
  }
  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void rename(id, e.currentTarget.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setRenaming(null);
    }
  };

  return (
    <section className="stg-sec" aria-labelledby="br-sty-t">
      <div className="stg-sec__head">
        <div>
          <h2 id="br-sty-t">{t('brand.stylesTitle')}</h2>
          <p>{t('brand.stylesHelp')}</p>
        </div>
        {canCreate && (
          <div className="stg-sec__acts">
            <Button
              icon={<Plus size={16} />}
              onClick={() => setEditing({ mode: 'new', source: '', tokens: defaultTokens, name: '' })}
            >
              {t('brand.newStyle')}
            </Button>
          </div>
        )}
      </div>

      <ul className="br-styles" aria-labelledby="br-sty-t">
        {PRESETS.map((p) => {
          const name = presetName(p.id);
          const isDefault = defaultKey === p.id;
          const items: MenuItem[] = [
            ...(canCreate
              ? [{ label: t('brand.duplicate'), icon: <Copy />, onSelect: () => duplicate(name, p.tokens) }]
              : []),
            ...(isAdmin && !isDefault
              ? [
                  {
                    label: t('brand.setDefault'),
                    icon: <Star />,
                    onSelect: () => askDefault(name, { key: p.id }),
                  },
                ]
              : []),
          ];
          return (
            <StyleItem
              key={p.id}
              name={name}
              tokens={p.tokens}
              isDefault={isDefault}
              menu={
                items.length > 0 && <Menu label={t('editor.styles.actionsFor', { name })} items={items} />
              }
            />
          );
        })}
        {mine.map((m) => {
          const tokens = asStyleTokens(m.tokens);
          const own = isAdmin || (canCreate && m.created_by === uid);
          const items: MenuItem[] = [
            ...(own
              ? [
                  {
                    label: t('brand.edit'),
                    icon: <Pencil />,
                    onSelect: () =>
                      setEditing({ mode: 'edit', source: m.name, id: m.id, tokens, name: m.name }),
                  },
                  {
                    label: t('editor.styles.rename'),
                    icon: <Pencil />,
                    onSelect: () => setRenaming({ id: m.id, value: m.name, err: null }),
                  },
                ]
              : []),
            ...(canCreate
              ? [{ label: t('brand.duplicate'), icon: <Copy />, onSelect: () => duplicate(m.name, tokens) }]
              : []),
            ...(isAdmin && !m.is_default
              ? [
                  {
                    label: t('brand.setDefault'),
                    icon: <Star />,
                    onSelect: () => askDefault(m.name, { id: m.id }),
                  },
                ]
              : []),
            ...(isAdmin
              ? [
                  {
                    label: t('editor.styles.delete'),
                    icon: <Trash2 />,
                    danger: true,
                    disabled: m.is_default,
                    hint: m.is_default ? t('brand.deleteDefault') : undefined,
                    onSelect: () => setDeleting(m),
                  },
                ]
              : []),
          ];
          const r = renaming?.id === m.id ? renaming : null;
          return (
            <StyleItem
              key={m.id}
              name={m.name}
              tokens={tokens}
              isDefault={m.is_default}
              byline={
                m.created_by && names[m.created_by] ? t('brand.by', { name: names[m.created_by] }) : undefined
              }
              nameSlot={
                r && (
                  <span className="br-rename">
                    <input
                      className="fd-input"
                      autoFocus
                      maxLength={STYLE_NAME_MAX}
                      aria-label={t('brand.renameLabel', { name: m.name })}
                      aria-invalid={r.err ? true : undefined}
                      aria-describedby={r.err ? `br-rn-${m.id}` : undefined}
                      value={r.value}
                      onChange={(e) => setRenaming({ ...r, value: e.target.value, err: null })}
                      onKeyDown={(e) => onRenameKey(e, m.id)}
                    />
                    {r.err && (
                      <span id={`br-rn-${m.id}`} className="stg-error" role="alert">
                        <CircleAlert size={16} aria-hidden="true" />
                        {r.err}
                      </span>
                    )}
                  </span>
                )
              }
              menu={
                items.length > 0 && (
                  <Menu label={t('editor.styles.actionsFor', { name: m.name })} items={items} />
                )
              }
            />
          );
        })}
      </ul>

      {editing && (
        <StyleDialog
          mode={editing.mode}
          initialName={editing.source}
          initial={{ name: editing.name, tokens: editing.tokens }}
          taken={mine.filter((m) => m.id !== editing.id).map((m) => m.name)}
          onClose={() => setEditing(null)}
          onSave={async (name, tokens) => {
            const json = tokens as unknown as Tables<'themes'>['tokens'];
            if (editing.mode === 'edit' && editing.id)
              check(await supabase.from('themes').update({ name, tokens: json }).eq('id', editing.id));
            else check(await supabase.from('themes').insert({ workspace_id: wsId, name, tokens: json }));
            setEditing(null);
            toast(t('brand.styleSaved', { name }));
            void load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!makeDefault}
        title={t('brand.defaultTitle', { name: makeDefault?.name ?? '' })}
        body={
          <div className="br-confirm">
            <p>{t('brand.defaultBody')}</p>
            {makeDefault?.n != null && <p>{t('brand.defaultCount', { count: makeDefault.n })}</p>}
          </div>
        }
        confirmLabel={t('brand.defaultConfirm')}
        onClose={() => setMakeDefault(null)}
        onConfirm={async () => {
          const m = makeDefault!;
          check(
            await supabase.rpc('set_default_style', {
              p_ws: wsId,
              p_builtin: m.key ?? null,
              p_theme: m.id ?? null,
            }),
          );
          setMakeDefault(null);
          toast(t('brand.defaultDone', { name: m.name }));
          void load();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        danger
        title={t('brand.deleteTitle', { name: deleting?.name ?? '' })}
        body={t('brand.deleteBody')}
        confirmLabel={t('editor.styles.delete')}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const d = deleting!;
          check(await supabase.from('themes').delete().eq('id', d.id));
          setDeleting(null);
          void load();
          toast(t('brand.deleted'), {
            label: t('editor.styles.undo'),
            durationMs: 8000,
            onClick: () =>
              void supabase
                .from('themes')
                .insert({
                  id: d.id,
                  workspace_id: d.workspace_id,
                  name: d.name,
                  tokens: d.tokens,
                  created_by: d.created_by,
                })
                .then(() => load()),
          });
        }}
      />
    </section>
  );
}

/**
 * L48-A §4, lot 1 de la refonte (maquette lot1-parametres/page-publique) : Paramètres › Page publique.
 * Réglages visibles mais pas encore actifs : bandeau d'information, champs et interrupteur désactivés.
 */
export function BrandPublicPage() {
  const { t } = useTranslation();
  const soon = <span className="stg-soon">{t('shell.soon')}</span>;
  const cta = (n: 1 | 2) => (
    <div className="stg-row">
      <div className="stg-text" data-gap-exempt="">
        <label className="stg-lab" htmlFor={`br-c${n}`}>
          {t(`brand.cta${n}`)} {soon}
        </label>
        {n === 2 && <div className="stg-help">{t('brand.optional')}</div>}
      </div>
      <div className="stg-ctl">
        <div className="stg-two">
          <input id={`br-c${n}`} className="fd-input" disabled placeholder={t('brand.ctaLabel')} />
          <input className="fd-input" disabled placeholder="https://…" aria-label={t(`brand.cta${n}Url`)} />
        </div>
      </div>
    </div>
  );
  return (
    <SettingsShell
      legacy={false}
      actions={
        <>
          <Button disabled>{t('common.cancel')}</Button>
          <Button variant="primary" disabled>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <p className="stg-banner" role="note">
        <Info size={16} aria-hidden="true" />
        <span>{t('brand.pageSoon')}</span>
      </p>
      <section className="stg-sec" aria-labelledby="br-pp-t">
        <div className="stg-sec__head">
          <div>
            <h2 id="br-pp-t">{t('brand.pageHead')}</h2>
            <p>{t('brand.pageHelp')}</p>
          </div>
        </div>
        {cta(1)}
        {cta(2)}
        <div className="stg-row stg-row--inline">
          <div className="stg-text" data-gap-exempt="">
            <div className="stg-lab" id="br-wm">
              {t('brand.hideBranding', { app: APP_NAME })} {soon}
            </div>
          </div>
          <div className="stg-ctl">
            <label className="fd-switch">
              <input type="checkbox" role="switch" disabled aria-labelledby="br-wm" />
              <span className="fd-switch__track" aria-hidden="true" />
            </label>
          </div>
        </div>
      </section>
    </SettingsShell>
  );
}
