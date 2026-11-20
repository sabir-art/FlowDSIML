/**
 * L48-A §2 : colonne Dossiers de la page Démos (au-dessus de 1 024 px). Toutes les démos, Mes démos,
 * dossiers de l'espace (sous-dossiers en retrait, un niveau affiché, puis un chevron), « Nouveau
 * dossier », Archivées. L'entrée choisie est dans l'adresse ; une carte de démo glissée sur un dossier
 * l'y range. Le menu « … » d'un dossier (ou clic droit) regroupe ses actions.
 */
import { useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ChevronRight,
  Folder,
  FolderPlus,
  Layers,
  Lock,
  PanelLeftClose,
  Pencil,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Menu, type MenuItem } from '../../components/Menu';

type FolderRow = Tables<'folders'>;
/** Entrée choisie : tout, mes démos, archivées, ou un dossier (id). */
export type Scope = 'all' | 'mine' | 'archived' | 'none' | string;
export const DEMO_DRAG = 'application/x-tutoclick-demo';

export function FolderColumn({
  folders,
  scope,
  count,
  editable,
  canManageAccess,
  onSelect,
  onHide,
  onNew,
  onRename,
  onAccess,
  onDelete,
  onDropDemo,
}: {
  folders: FolderRow[];
  scope: Scope;
  /** Nombre de démos d'une entrée, selon le filtre de statut de la barre. */
  count: (s: Scope) => number;
  editable: boolean;
  canManageAccess: boolean;
  onSelect: (s: Scope) => void;
  onHide: () => void;
  /** Nouveau dossier (parent : sous-dossier). */
  onNew: (parent: string | null) => void;
  onRename: (f: FolderRow) => void;
  onAccess: (f: FolderRow) => void;
  onDelete: (f: FolderRow) => void;
  onDropDemo: (demoId: string, folderId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [over, setOver] = useState<string | null>(null);
  const children = (parent: string | null) =>
    folders
      .filter((f) => (f.parent_id ?? null) === parent)
      .sort((a, b) => a.name.localeCompare(b.name, i18n.language));

  const entry = (s: Scope, icon: ReactNode, label: string, extra?: ReactNode) => (
    <li>
      <a
        href="#"
        className={`fcol__item${scope === s ? ' is-active' : ''}`}
        aria-current={scope === s ? 'true' : undefined}
        onClick={(e) => {
          e.preventDefault();
          onSelect(s);
        }}
      >
        {icon}
        <span className="fcol__name">{label}</span>
        <span className="fcol__count">{count(s)}</span>
      </a>
      {extra}
    </li>
  );

  const drop = (id: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!editable || !e.dataTransfer.types.includes(DEMO_DRAG)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setOver(id);
    },
    onDragLeave: () => setOver((o) => (o === id ? null : o)),
    onDrop: (e: DragEvent) => {
      const demo = e.dataTransfer.getData(DEMO_DRAG);
      setOver(null);
      if (!demo) return;
      e.preventDefault();
      onDropDemo(demo, id);
    },
  });

  const folderMenu = (f: FolderRow): Array<MenuItem | 'separator'> => [
    { label: t('demos.rename'), icon: <Pencil />, onSelect: () => onRename(f) },
    { label: t('folders.newSub'), icon: <FolderPlus />, onSelect: () => onNew(f.id) },
    ...(canManageAccess
      ? [{ label: t('folderAccess.menu'), icon: <Lock />, onSelect: () => onAccess(f) }]
      : []),
    'separator',
    { label: t('demos.deleteFolderShort'), icon: <Trash2 />, danger: true, onSelect: () => onDelete(f) },
  ];

  const tree = (parent: string | null, level: number): ReactNode => {
    const list = children(parent);
    if (!list.length) return null;
    return (
      <ul className="fcol__list" role="list">
        {list.map((f) => {
          const kids = children(f.id).length > 0;
          // Un niveau de sous-dossiers affiché ; au-delà, un chevron déplie
          const foldable = kids && level >= 1;
          const expanded = !foldable || open.has(f.id);
          return (
            <li key={f.id}>
              <div
                className={`fcol__row${over === f.id ? ' is-over' : ''}`}
                style={{ paddingLeft: level * 24 }}
                {...drop(f.id)}
                onContextMenu={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  (e.currentTarget.querySelector('.fcol__more button') as HTMLElement | null)?.click();
                }}
              >
                {foldable && (
                  <button
                    type="button"
                    className="fcol__toggle"
                    aria-expanded={expanded}
                    aria-label={t(expanded ? 'folders.collapse' : 'folders.expand', { name: f.name })}
                    onClick={() =>
                      setOpen((s) => {
                        const n = new Set(s);
                        if (n.has(f.id)) n.delete(f.id);
                        else n.add(f.id);
                        return n;
                      })
                    }
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                )}
                <a
                  href="#"
                  className={`fcol__item${scope === f.id ? ' is-active' : ''}`}
                  aria-current={scope === f.id ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelect(f.id);
                  }}
                >
                  {f.restricted ? (
                    <Lock aria-label={t('folderAccess.restricted')} role="img" />
                  ) : (
                    <Folder aria-hidden="true" />
                  )}
                  <span className="fcol__name">{f.name}</span>
                  <span className="fcol__count">{count(f.id)}</span>
                </a>
                {editable && (
                  <span className="fcol__more">
                    <Menu label={t('folders.actions', { name: f.name })} items={folderMenu(f)} />
                  </span>
                )}
              </div>
              {expanded && tree(f.id, level + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <nav className="fcol" aria-label={t('folders.title')}>
      <div className="fcol__head">
        <h2 className="fcol__title">{t('folders.title')}</h2>
        {editable && (
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
            aria-label={t('demos.newFolder')}
            onClick={() => onNew(null)}
          >
            <Plus aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
          aria-label={t('folders.hide')}
          onClick={onHide}
        >
          <PanelLeftClose aria-hidden="true" />
        </button>
      </div>
      <ul className="fcol__list" role="list">
        {entry('all', <Layers aria-hidden="true" />, t('folders.all'))}
        {entry('mine', <User aria-hidden="true" />, t('folders.mine'))}
      </ul>
      <hr className="fcol__sep" />
      <p className="fcol__section">{t('folders.space')}</p>
      {tree(null, 0)}
      {editable && (
        <button type="button" className="fcol__new" onClick={() => onNew(null)}>
          <FolderPlus aria-hidden="true" />
          {t('demos.newFolder')}
        </button>
      )}
      <hr className="fcol__sep" />
      <ul className="fcol__list" role="list">
        {entry('archived', <Archive aria-hidden="true" />, t('folders.archived'))}
      </ul>
    </nav>
  );
}
