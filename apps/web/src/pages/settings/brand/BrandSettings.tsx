import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  Image as ImageIcon,
  Images,
  Info,
  Pencil,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { APP_NAME } from '@flowdsiml/core';
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
import { StyleCard } from '../../editor/styles/StylesSection';
import { PRESETS, asStyleTokens, type StyleTokens } from '../../editor/styles/presets';
import { styleOk } from '../../editor/styles/styleCheck';
import { STYLE_NAME_MAX, copyName, isHex, logoError, nameTaken } from './brand';
import { StyleDialog } from './StyleDialog';
import '../../editor/styles/styles.css';
import './brand.css';

type WsStyle = Tables<'themes'>;
/** Couleurs de la marque par défaut (charte DSI, valeurs des démos). */
const DEFAULT_PRIMARY = '#A3195B';
const DEFAULT_ACCENT = '#D60B52';

/**
 * L27-01 / L27-05 : Paramètres > Marque. Trois cartes : logo, couleurs de la marque, styles des démos.
 * Droits (§2) vérifiés par la base ; l'interface n'affiche que les actions permises.
 */
export function BrandSettings() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const ws = current!;
  const isAdmin = can('workspace.settings');
  const [library, setLibrary] = useState(false);
  return (
    <SettingsShell>
      <div className="br-page">
        {!isAdmin && (
          <div className="alert alert-info br-note" role="note">
            <Info aria-hidden="true" />
            <span>{t('brand.editorNote')}</span>
          </div>
        )}
        <LogoCard ws={ws} isAdmin={isAdmin} onLibrary={() => setLibrary(true)} />
        <ColorsCard ws={ws} isAdmin={isAdmin} />
        <StylesCard wsId={ws.id} isAdmin={isAdmin} canCreate={can('demo.edit')} />
        {library && <MediaLibrary wsId={ws.id} onClose={() => setLibrary(false)} />}
      </div>
    </SettingsShell>
  );
}

// ===== §3.1 Logo =====
function LogoCard({
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
  const input = useRef<HTMLInputElement>(null);
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
    <section className="card br-card" aria-labelledby="br-logo-t">
      <div className="card-head">
        <div>
          <h3 className="t-h3" id="br-logo-t">
            {t('brand.logoTitle')}
          </h3>
          <p className="t-caption muted">{t('brand.logoHelp')}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLibrary}>
          <Images aria-hidden="true" />
          {t('media.open')}
        </button>
      </div>
      {url ? (
        <div className="br-logos">
          <div className="br-logo br-logo--light">
            <img src={url} alt={t('brand.logoOnLight', { name: ws.name })} />
          </div>
          <div className="br-logo br-logo--dark">
            <img src={url} alt={t('brand.logoOnDark', { name: ws.name })} />
          </div>
        </div>
      ) : (
        <div className="br-logo-empty">
          <ImageIcon aria-hidden="true" />
          <span>{t('brand.logoNone')}</span>
        </div>
      )}
      {isAdmin && (
        <div className="br-actions">
          <input
            ref={input}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void upload(f);
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            aria-describedby={err ? 'br-logo-err' : 'br-logo-formats'}
            onClick={() => input.current?.click()}
          >
            <Upload aria-hidden="true" />
            {url ? t('brand.logoReplace') : t('brand.logoAdd')}
          </button>
          {url && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove()}>
              {t('brand.logoRemove')}
            </button>
          )}
          <span id="br-logo-formats" className="t-caption muted">
            {t('brand.logoFormats')}
          </span>
        </div>
      )}
      {err && (
        <p id="br-logo-err" className="field-error" role="alert">
          {err}
        </p>
      )}
    </section>
  );
}

// ===== §3.2 Couleurs de la marque =====
function ColorsCard({ ws, isAdmin }: { ws: Tables<'workspaces'>; isAdmin: boolean }) {
  const { t } = useTranslation();
  const { reload } = useWorkspace();
  const toast = useToast();
  const saved = {
    primary: ws.brand_primary ?? DEFAULT_PRIMARY,
    accent: ws.brand_accent ?? DEFAULT_ACCENT,
  };
  const [vals, setVals] = useState(saved);
  useEffect(() => setVals(saved), [saved.primary, saved.accent]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = vals.primary !== saved.primary || vals.accent !== saved.accent;

  const field = (key: 'primary' | 'accent', label: string) => {
    const v = vals[key];
    const r = contrastRatio(v, '#FFFFFF');
    const fix = r < 4.5 ? darkenToContrast(v) : null;
    const id = `br-c-${key}`;
    const ratio = t('brand.whiteRatio', {
      ratio: ratioText(r),
      verdict: r >= 4.5 ? t('brand.ok') : t('brand.notOk'),
    });
    return (
      <div className="field">
        {isAdmin ? <label htmlFor={id}>{label}</label> : <span className="t-label">{label}</span>}
        {isAdmin ? (
          <div className="color-row">
            <input
              className="swatch"
              type="color"
              aria-label={t('brand.picker', { label })}
              value={v}
              onChange={(e) => setVals({ ...vals, [key]: e.target.value.toUpperCase() })}
            />
            <input
              id={id}
              className="input input-sm t-mono"
              maxLength={7}
              defaultValue={v}
              key={v}
              onBlur={(e) => {
                const x = e.target.value.trim().toUpperCase();
                if (isHex(x)) setVals({ ...vals, [key]: x });
                else e.target.value = v;
              }}
            />
          </div>
        ) : (
          // Lecture seule (éditeur) : pastille et valeur, comme du texte
          <p className="br-color-ro" id={id}>
            <span className="st-swatch" style={{ background: v }} aria-hidden="true" />
            <span className="t-mono">{v}</span>
          </p>
        )}
        {r >= 4.5 ? (
          <span className="help">{ratio}</span>
        ) : (
          <div className="alert alert-warning th-warn" role="status">
            <TriangleAlert aria-hidden="true" />
            <span className="t-caption">
              {ratio}.
              {fix && (
                <>
                  {' '}
                  {t('brand.proposed', { color: fix })}{' '}
                  {isAdmin && (
                    <button
                      type="button"
                      className="mk-link"
                      onClick={() => setVals({ ...vals, [key]: fix })}
                    >
                      {t('brand.useColor')}
                    </button>
                  )}
                </>
              )}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="card br-card" aria-labelledby="br-col-t">
      <div className="card-head">
        <div>
          <h3 className="t-h3" id="br-col-t">
            {t('brand.colorsTitle')}
          </h3>
          <p className="t-caption muted">{t('brand.colorsHelp')}</p>
        </div>
      </div>
      <div className="br-colors">
        {field('primary', t('brand.primary'))}
        {field('accent', t('brand.accent'))}
      </div>
      {isAdmin && (
        <div className="br-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!dirty}
            onClick={async () => {
              check(
                await supabase
                  .from('workspaces')
                  .update({ brand_primary: vals.primary, brand_accent: vals.accent })
                  .eq('id', ws.id),
              );
              await reload();
              toast(t('brand.colorsSaved'));
            }}
          >
            {t('common.save')}
          </button>
        </div>
      )}
    </section>
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

function StylesCard({ wsId, isAdmin, canCreate }: { wsId: string; isAdmin: boolean; canCreate: boolean }) {
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
  const sample = { title: t('editor.styles.sampleTitle'), next: t('editor.styles.sampleNext') };
  const badges = (isDefault: boolean, tokens: StyleTokens) => [
    ...(isDefault ? [{ text: t('editor.styles.default') }] : []),
    ...(styleOk(tokens) ? [] : [{ text: t('brand.lowContrast'), tone: 'warning' as const }]),
  ];

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
    <section className="card br-card" aria-labelledby="br-sty-t">
      <div className="card-head">
        <div>
          <h3 className="t-h3" id="br-sty-t">
            {t('brand.stylesTitle')}
          </h3>
          <p className="t-caption muted">{t('brand.stylesHelp')}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditing({ mode: 'new', source: '', tokens: defaultTokens, name: '' })}
          >
            <Plus aria-hidden="true" />
            {t('brand.newStyle')}
          </button>
        )}
      </div>

      <h4 className="br-sub" id="br-builtin-t">
        {t('brand.builtin')}
      </h4>
      <div className="br-grid" role="list" aria-labelledby="br-builtin-t">
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
            <div role="listitem" key={p.id}>
              <StyleCard
                name={name}
                tokens={p.tokens}
                current={isDefault}
                badges={badges(isDefault, p.tokens)}
                sample={sample}
                menu={
                  items.length > 0 && (
                    <span className="sty-menu">
                      <Menu label={t('editor.styles.actionsFor', { name })} items={items} />
                    </span>
                  )
                }
              />
            </div>
          );
        })}
      </div>

      <h4 className="br-sub" id="br-mine-t">
        {t('brand.mine')}
      </h4>
      {rows && mine.length === 0 ? (
        <p className="t-caption muted br-empty">{t('brand.mineEmpty')}</p>
      ) : (
        <div className="br-grid" role="list" aria-labelledby="br-mine-t">
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
              <div role="listitem" key={m.id}>
                <StyleCard
                  name={m.name}
                  tokens={tokens}
                  current={m.is_default}
                  badges={badges(m.is_default, tokens)}
                  byline={
                    m.created_by && names[m.created_by]
                      ? t('brand.by', { name: names[m.created_by] })
                      : undefined
                  }
                  sample={sample}
                  nameSlot={
                    r && (
                      <span className="br-rename">
                        <input
                          className="input input-sm"
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
                          <span id={`br-rn-${m.id}`} className="field-error" role="alert">
                            {r.err}
                          </span>
                        )}
                      </span>
                    )
                  }
                  menu={
                    items.length > 0 && (
                      <span className="sty-menu">
                        <Menu label={t('editor.styles.actionsFor', { name: m.name })} items={items} />
                      </span>
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      )}

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

/** L48-A §4 : Paramètres > Marque > Page publique (PRM-07) : boutons et mention du produit, « Bientôt ». */
export function BrandPublicPage() {
  const { t } = useTranslation();
  return (
    <SettingsShell>
      <section className="card br-card" aria-labelledby="br-pp-t">
        <div className="card-head">
          <div>
            <h2 className="t-h3" id="br-pp-t">
              {t('brand.pageTitle')} <span className="badge">{t('shell.soon')}</span>
            </h2>
            <p className="t-caption muted">{t('brand.pageHelp')}</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="br-c1">{t('brand.cta1')}</label>
          <div className="st-pair">
            <input id="br-c1" className="input" disabled placeholder={t('brand.ctaLabel')} />
            <input
              className="input t-mono"
              disabled
              placeholder="https://…"
              aria-label={t('brand.cta1Url')}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="br-c2">
            {t('brand.cta2')} <span className="opt">{t('plans.optional')}</span>
          </label>
          <div className="st-pair">
            <input id="br-c2" className="input" disabled placeholder={t('brand.ctaLabel')} />
            <input
              className="input t-mono"
              disabled
              placeholder="https://…"
              aria-label={t('brand.cta2Url')}
            />
          </div>
        </div>
        <div className="setting st-pf-notif">
          <div>
            <b id="br-wm">{t('brand.hideBranding', { app: APP_NAME })}</b>
          </div>
          <span className="switch">
            <input type="checkbox" disabled aria-labelledby="br-wm" />
            <span />
          </span>
        </div>
      </section>
    </SettingsShell>
  );
}
