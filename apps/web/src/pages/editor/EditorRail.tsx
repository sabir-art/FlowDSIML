/**
 * L48-E §2 : rail d'outils de l'éditeur (56 px, à droite). Un bouton à icône par outil, regroupés
 * (Contenu, Écran, Apparence, Collaborer, puis Réglages en bas). Navigation aux flèches haut et bas ;
 * Alt + 1 à 9 ouvre les 9 premiers outils. Un outil sans objet pour l'étape reste visible, désactivé
 * (aria-disabled), avec la raison dans l'infobulle.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Crop,
  Droplet,
  GitBranch,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  MousePointerClick,
  Palette,
  Settings,
  Sparkles,
  Target,
  Type,
  X,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';

export type ToolId =
  | 'step'
  | 'cta'
  | 'hotspots'
  | 'voice'
  | 'next'
  | 'blur'
  | 'zoom'
  | 'crop'
  | 'image'
  | 'design'
  | 'comments'
  | 'assistant'
  | 'settings';

export const TOOL_GROUPS: Array<{ key: string; tools: ToolId[] }> = [
  { key: 'content', tools: ['step', 'cta', 'hotspots', 'voice', 'next'] },
  { key: 'screen', tools: ['blur', 'zoom', 'crop', 'image'] },
  { key: 'look', tools: ['design'] },
  { key: 'collab', tools: ['comments', 'assistant'] },
];
/** Ordre du rail (raccourcis Alt + 1 à 9 sur les 9 premiers). */
export const TOOL_ORDER: ToolId[] = [...TOOL_GROUPS.flatMap((g) => g.tools), 'settings'];

const ICONS: Record<ToolId, LucideIcon> = {
  step: Type,
  cta: MousePointerClick,
  hotspots: Target,
  voice: Mic,
  next: GitBranch,
  blur: Droplet,
  zoom: ZoomIn,
  crop: Crop,
  image: ImageIcon,
  design: Palette,
  comments: MessageSquare,
  assistant: Sparkles,
  settings: Settings,
};

/** Dernier outil ouvert, gardé par personne dans ce navigateur. */
export const TOOL_KEY = 'fd.editor.tool';
export function savedTool(): ToolId {
  try {
    const v = localStorage.getItem(TOOL_KEY) as ToolId | null;
    return v && TOOL_ORDER.includes(v) && v !== 'blur' ? v : 'step';
  } catch {
    return 'step';
  }
}

export function EditorRail({
  active,
  onToggle,
  disabled,
  dot,
  hidden = [],
}: {
  active: ToolId | null;
  onToggle: (t: ToolId) => void;
  /** Raison de l'indisponibilité, par outil (absent : disponible). */
  disabled: Partial<Record<ToolId, string>>;
  /** Point de 8 px (commentaire non lu). */
  dot?: Partial<Record<ToolId, boolean>>;
  /** Outils hors droits (ex. Assistant pour un lecteur). */
  hidden?: ToolId[];
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const shown = TOOL_ORDER.filter((x) => !hidden.includes(x));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button[data-tool]') ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const n =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? btns.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length;
    // Les flèches du rail ne changent pas d'étape (raccourci global de l'éditeur)
    e.preventDefault();
    e.stopPropagation();
    btns.forEach((b, k) => (b.tabIndex = k === n ? 0 : -1));
    btns[n]?.focus();
  };
  const btn = (id: ToolId) => {
    const Icon = ICONS[id];
    const label = t(`editor.rail.${id}`);
    const reason = disabled[id];
    const n = shown.indexOf(id);
    return (
      <button
        key={id}
        type="button"
        data-tool={id}
        className={`ed-rail__btn${active === id ? ' is-active' : ''}`}
        aria-label={label}
        aria-pressed={active === id}
        aria-disabled={reason ? 'true' : undefined}
        aria-describedby={reason ? `rail-why-${id}` : undefined}
        aria-keyshortcuts={n < 9 ? `Alt+${n + 1}` : undefined}
        data-tip={reason ? `${label} · ${reason}` : undefined}
        data-tip-shortcut={n < 9 ? `Alt ${n + 1}` : undefined}
        tabIndex={(active ? active === id : n === 0) ? 0 : -1}
        onClick={() => !reason && onToggle(id)}
      >
        <Icon aria-hidden="true" />
        {dot?.[id] && <span className="ed-rail__dot" aria-hidden="true" />}
        {reason && (
          <span id={`rail-why-${id}`} className="sr-only">
            {reason}
          </span>
        )}
      </button>
    );
  };
  return (
    <div
      ref={ref}
      className="ed-rail"
      role="toolbar"
      aria-orientation="vertical"
      aria-label={t('editor.rail.label')}
      data-tip-side="left"
      onKeyDown={onKey}
    >
      {TOOL_GROUPS.map((g) => {
        const tools = g.tools.filter((x) => shown.includes(x));
        if (!tools.length) return null;
        return (
          <div key={g.key} role="group" aria-label={t(`editor.rail.group.${g.key}`)} className="ed-rail__grp">
            {tools.map(btn)}
          </div>
        );
      })}
      <span className="grow" />
      <div role="group" aria-label={t('editor.rail.group.demo')} className="ed-rail__grp">
        {btn('settings')}
      </div>
    </div>
  );
}

/** L48-E §3 : panneau de l'outil actif (en-tête de 56 px, contenu qui défile seul). */
export function ToolPanel({
  id,
  title,
  wide = false,
  onClose,
  children,
}: {
  id: ToolId | 'form';
  title: string;
  /** Commentaires et Assistant : 400 px. */
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <aside
      className={`ed-tool fd-dense${wide ? ' ed-tool--wide' : ''}`}
      aria-labelledby="ed-tool-title"
      data-tool-panel={id}
    >
      <header className="ed-tool__head">
        <h2 id="ed-tool-title" tabIndex={-1}>
          {title}
        </h2>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
          aria-label={t('editor.rail.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="ed-tool__body">{children}</div>
    </aside>
  );
}
