/**
 * L48-A §2 : colonne Dossiers de la page Démos (au-dessus de 1 024 px). Toutes les démos, Mes démos,
 * dossiers de l'espace (sous-dossiers en retrait, un niveau affiché, puis un chevron), « Nouveau
 * dossier », Archivées. L'entrée choisie est dans l'adresse ; une carte de démo glissée sur un dossier
 * l'y range. Le menu « … » d'un dossier (ou clic droit) regroupe ses actions.
 * La liste défile à l'intérieur, « Nouveau dossier » et « Archivées » restent en bas.
 * COL-02 (COMP-01 §19) : plus de bouton de bascule dans l'en-tête ; la colonne est repliée, dépliée et
 * redimensionnée par la poignée de son bord (ColumnGrip, posée par la page). Sous 1 024 px, elle s'ouvre
 * en tiroir (overlay) depuis la barre mobile et garde son bouton « Masquer les dossiers ».
 */
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ChevronRight,
  Folder,
  FolderPlus,
  Layers,
  Lock,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Menu, type MenuItem } from '../../components/Menu';
import { modalOnTop } from '../../lib/modalOnTop';

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
  id,
  overlay = false,
  onToggle,
  onNew,
  onRename,
  onAccess,
  onDelete,
  onDropDemo,
  sandbox = false,
}: {
  folders: FolderRow[];
  scope: Scope;
  /** Nombre de démos d'une entrée, selon le filtre de statut de la barre. */
  count: (s: Scope) => number;
  editable: boolean;
  canManageAccess: boolean;
  onSelect: (s: Scope) => void;
  id?: string;
  /** Tiroir par-dessus le contenu (sous 1 024 px). */
  overlay?: boolean;
  onToggle: () => void;
  /** Nouveau dossier (parent : sous-dossier). */
  onNew: (parent: string | null) => void;
  onRename: (f: FolderRow) => void;
  onAccess: (f: FolderRow) => void;
  onDelete: (f: FolderRow) => void;
  onDropDemo: (demoId: string, folderId: string) => void;
  /** L48-G : page Sandbox (« Tous les Sandbox », « Mes Sandbox »). */
  sandbox?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [over, setOver] = useState<string | null>(null);
  const children = (parent: string | null) =>
    folders
      .filter((f) => (f.parent_id ?? null) === parent)
      .sort((a, b) => a.name.localeCompare(b.name, i18n.language, { numeric: true, sensitivity: 'base' }));

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

  // Tiroir : Échap et un clic dehors le ferment (le focus revient au bouton de bascule)
  const nav = useRef<HTMLElement>(null);
  const drawer = overlay;
  // Tiroir : à l'ouverture, focus sur « Masquer les dossiers » ; fermé par Échap, focus sur « Afficher
  // les dossiers » (même bouton, jamais remonté). Explicite : Safari ne donne pas le focus au clic.
  const switchRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useLayoutEffect(() => {
    if (drawer || refocus.current) switchRef.current?.focus();
    refocus.current = false;
  }, [drawer]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      // Une fenêtre modale ouverte par-dessus garde Échap pour elle
      if (e.key !== 'Escape' || modalOnTop()) return;
      refocus.current = true;
      onToggle();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!nav.current?.contains(target) && !target.closest?.('#fd-portal')) onToggle();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [drawer, onToggle]);

  const toggle = (
    <button
      ref={switchRef}
      type="button"
      className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm fcol__switch"
      aria-label={t('folders.hide')}
      title={t('folders.hide')}
      aria-expanded
      onClick={onToggle}
    >
      {/* L'icône panneau est réservée à la barre latérale (COL-02) */}
      <X aria-hidden="true" />
    </button>
  );
  return (
    <nav ref={nav} id={id} className={`fcol${drawer ? ' fcol--drawer' : ''}`} aria-label={t('folders.title')}>
      <div className="fcol__head">
        {drawer && toggle}
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
      </div>
      {/* La liste défile seule ; le bas de colonne reste visible */}
      <div className="fcol__scroll">
        <ul className="fcol__list" role="list">
          {entry('all', <Layers aria-hidden="true" />, t(sandbox ? 'sandboxPage.all' : 'folders.all'))}
          {entry('mine', <User aria-hidden="true" />, t(sandbox ? 'sandboxPage.mine' : 'folders.mine'))}
        </ul>
        <p className="fcol__section">{t('folders.space')}</p>
        {tree(null, 0)}
        {editable && (
          <button type="button" className="fcol__new" onClick={() => onNew(null)}>
            <FolderPlus aria-hidden="true" />
            {t('demos.newFolder')}
          </button>
        )}
      </div>
      <div className="fcol__foot">
        <ul className="fcol__list" role="list">
          {entry('archived', <Archive aria-hidden="true" />, t('folders.archived'))}
        </ul>
      </div>
    </nav>
  );
}
