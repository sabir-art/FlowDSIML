/**
 * L26-04 : « Partir d'un modèle ». Catégories (boutons aria-pressed, avec leur nombre), grille des modèles
 * (radiogroup, flèches, Entrée pour utiliser), aperçu nommé du modèle choisi. Les modèles de l'espace se
 * gèrent ici (menu ⋯ : Renommer, Supprimer ; éditeurs et plus). Le menu reste dans la modale (top layer).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Info,
  LayoutTemplate,
  Monitor,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { Alert } from '@flowdsiml/ui';
import { CATEGORIES, chaptersOf, summary, type Template, type TemplateCategory } from './templates';

const ICONS: Record<string, LucideIcon> = {
  monitor: Monitor,
  'file-text': FileText,
  'refresh-cw': RefreshCw,
  'shield-check': ShieldCheck,
  users: Users,
  target: Target,
};
type Cat = 'all' | TemplateCategory | 'space';

export function TemplatesDialog({
  open,
  workspaceId,
  folderId,
  canManage,
  onCreated,
  onClose,
}: {
  open: boolean;
  workspaceId: string;
  folderId: string | null;
  canManage: boolean;
  onCreated: (demoId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<Template[] | null>(null);
  const [cat, setCat] = useState<Cat>('all');
  const [sel, setSel] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { busy, error, run, setError } = useAction();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setCat('all');
      setError(null);
      setRenaming(null);
      setDeleting(false);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, setError]);

  useEffect(() => {
    if (!open) return;
    void supabase
      .from('demo_templates')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        // Modèles livrés d'abord (ordre de la migration), puis ceux de l'espace
        const rows = (data ?? []).filter((r) => r.workspace_id === null || r.workspace_id === workspaceId);
        rows.sort((a, b) => Number(a.workspace_id !== null) - Number(b.workspace_id !== null));
        setList(rows);
        setSel((s) => s ?? rows[0]?.id ?? null);
      });
  }, [open, workspaceId]);

  const inCat = (tp: Template, c: Cat) =>
    c === 'all' ? true : c === 'space' ? tp.workspace_id !== null : tp.category === c;
  const shown = useMemo(() => (list ?? []).filter((tp) => inCat(tp, cat)), [list, cat]);
  const current = shown.find((tp) => tp.id === sel) ?? shown[0] ?? null;
  const count = (c: Cat) => (list ?? []).filter((tp) => inCat(tp, c)).length;

  const applyTemplate = async (tp: Template | null) => {
    if (!tp) return;
    const id = await run(async () =>
      check(
        await supabase.rpc('create_demo_from_template', {
          p_template: tp.id,
          p_ws: workspaceId,
          p_folder: folderId,
        }),
      ),
    );
    if (id) onCreated(id);
  };

  // Grille : flèches pour changer de modèle (le focus suit la sélection), Entrée pour l'utiliser
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = shown.findIndex((tp) => tp.id === current?.id);
    const cols = getComputedStyle(grid.current!).gridTemplateColumns.split(' ').length || 1;
    const delta: Record<string, number> = { ArrowRight: 1, ArrowDown: cols, ArrowLeft: -1, ArrowUp: -cols };
    if (e.key in delta) {
      e.preventDefault();
      const n = shown[Math.min(shown.length - 1, Math.max(0, i + delta[e.key]!))];
      if (n) {
        setSel(n.id);
        grid.current?.querySelector<HTMLElement>(`[data-id="${n.id}"]`)?.focus();
      }
    } else if (e.key === 'Enter' && (e.target as HTMLElement).getAttribute('role') === 'radio') {
      e.preventDefault();
      void applyTemplate(current);
    }
  };

  const meta = (tp: Template) => {
    const s = summary(tp);
    const parts = [
      ...(tp.workspace_id ? [t('templates.spaceOne')] : []),
      t('templates.chapters', { count: s.chapters }),
      t('templates.steps', { count: s.steps }),
      ...s.features.map((f) =>
        f === 'seuil' ? t('templates.f.seuil', { n: s.threshold }) : t(`templates.f.${f}`),
      ),
    ];
    return parts.join(' · ');
  };

  const rename = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!current) return;
    const name = String(new FormData(e.currentTarget).get('name') ?? '').trim();
    if (!name) return;
    const ok = await run(async () => {
      check(await supabase.from('demo_templates').update({ name }).eq('id', current.id));
      return true;
    });
    if (ok) {
      setList((l) => (l ?? []).map((tp) => (tp.id === current.id ? { ...tp, name } : tp)));
      setRenaming(null);
    }
  };
  const remove = async () => {
    if (!current) return;
    const ok = await run(async () => {
      check(await supabase.from('demo_templates').delete().eq('id', current.id));
      return true;
    });
    if (ok) {
      setList((l) => (l ?? []).filter((tp) => tp.id !== current.id));
      setSel(null);
      setDeleting(false);
    }
  };

  const s = current ? summary(current) : null;
  let n = 0;

  return (
    <dialog ref={ref} className="dialog tpl-dialog" onClose={onClose} aria-labelledby="tpl-title">
      <div className="nd-head">
        <h2 id="tpl-title">{t('templates.title')}</h2>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="tpl-wrap">
        <nav className="tpl-cats" aria-label={t('templates.cats')}>
          {(['all', ...CATEGORIES] as Cat[]).map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {t(`templates.cat.${c}`)} <span className="fd-muted">{count(c)}</span>
            </button>
          ))}
          <hr />
          <button type="button" aria-pressed={cat === 'space'} onClick={() => setCat('space')}>
            {t('templates.cat.space')} <span className="fd-muted">{count('space')}</span>
          </button>
        </nav>
        <div
          className="tpl-grid"
          role="radiogroup"
          aria-label={t('templates.grid')}
          ref={grid}
          onKeyDown={onGridKey}
        >
          {list && !shown.length && <p className="fd-muted tpl-empty">{t('templates.empty')}</p>}
          {shown.map((tp) => {
            const Icon = ICONS[tp.icon] ?? LayoutTemplate;
            const on = tp.id === current?.id;
            return (
              <div key={tp.id} className="tpl-cell">
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  data-id={tp.id}
                  className="tpl-card"
                  onClick={() => {
                    setSel(tp.id);
                    setRenaming(null);
                    setDeleting(false);
                  }}
                  onDoubleClick={() => void applyTemplate(tp)}
                >
                  <Icon aria-hidden="true" />
                  <b>{tp.name}</b>
                  <small>{meta(tp)}</small>
                </button>
                {tp.workspace_id && canManage && (
                  <div className="tpl-more">
                    <button
                      type="button"
                      className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                      aria-label={t('templates.more', { name: tp.name })}
                      aria-haspopup="menu"
                      aria-expanded={menu === tp.id}
                      onClick={() => setMenu(menu === tp.id ? null : tp.id)}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                    {menu === tp.id && (
                      <div
                        role="menu"
                        className="tpl-menu"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenu(null);
                          }
                        }}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          autoFocus
                          onClick={() => {
                            setSel(tp.id);
                            setMenu(null);
                            setDeleting(false);
                            setRenaming(tp.id);
                          }}
                        >
                          {t('templates.rename')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="is-danger"
                          onClick={() => {
                            setSel(tp.id);
                            setMenu(null);
                            setRenaming(null);
                            setDeleting(true);
                          }}
                        >
                          {t('templates.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <aside className="tpl-prev" aria-label={t('templates.preview')}>
          {current && s && (
            <>
              {renaming === current.id ? (
                <form className="tpl-rename" onSubmit={rename}>
                  <label className="fd-label" htmlFor="tpl-rn">
                    {t('templates.name')}
                  </label>
                  <input
                    id="tpl-rn"
                    name="name"
                    className="fd-input"
                    maxLength={60}
                    defaultValue={current.name}
                    autoFocus
                    required
                  />
                  <div className="tpl-row">
                    <button type="button" className="fd-btn fd-btn--sm" onClick={() => setRenaming(null)}>
                      {t('common.cancel')}
                    </button>
                    <button type="submit" className="fd-btn fd-btn--sm fd-btn--primary" disabled={busy}>
                      {t('common.save')}
                    </button>
                  </div>
                </form>
              ) : (
                <b className="tpl-name">{current.name}</b>
              )}
              {deleting && (
                <div className="tpl-del" role="group" aria-label={t('templates.deleteTitle')}>
                  <p>{t('templates.deleteBody')}</p>
                  <div className="tpl-row">
                    <button
                      type="button"
                      className="fd-btn fd-btn--sm"
                      onClick={() => setDeleting(false)}
                      autoFocus
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className="fd-btn fd-btn--sm fd-btn--danger"
                      disabled={busy}
                      onClick={remove}
                    >
                      {t('templates.delete')}
                    </button>
                  </div>
                </div>
              )}
              {current.description && <p className="tpl-desc">{current.description}</p>}
              {chaptersOf(current).map((c, ci) => (
                <div key={ci}>
                  {c.title && (
                    <div className="tpl-chap">
                      {ci + 1} · {c.title}
                    </div>
                  )}
                  <ol start={n + 1}>
                    {c.steps.map((st, si) => {
                      n += 1;
                      return (
                        <li key={si}>
                          {st.title} <span>· {t(`templates.type.${st.type}`)}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
              {s.toCapture > 0 && (
                <p className="tpl-alert">
                  <Info aria-hidden="true" />
                  <span>{t('templates.toCaptureInfo', { count: s.toCapture })}</span>
                </p>
              )}
            </>
          )}
        </aside>
      </div>
      <div className="dialog-actions tpl-foot">
        <span className="fd-muted tpl-hint">{t('templates.hint')}</span>
        <button type="button" className="fd-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="fd-btn fd-btn--primary"
          disabled={!current || busy}
          onClick={() => void applyTemplate(current)}
        >
          <LayoutTemplate aria-hidden="true" />
          {t('templates.use')}
        </button>
      </div>
    </dialog>
  );
}
