/**
 * L48-E §2 : rail d'outils de l'éditeur (56 px, à droite). Un bouton à icône par outil, regroupés
 * (Contenu, Écran, Apparence, Collaborer, puis Réglages en bas). Navigation aux flèches haut et bas ;
 * Alt + 1 à 9 ouvre les 9 premiers outils. Un outil sans objet pour l'étape reste visible, désactivé
 * (aria-disabled), avec la raison dans l'infobulle.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Flashlight,
  Crop,
  Droplet,
  GitBranch,
  Image as ImageIcon,
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
  | 'spotlight'
  | 'crop'
  | 'image'
  | 'design'
  | 'assistant'
  | 'settings';

export const TOOL_GROUPS: Array<{ key: string; tools: ToolId[] }> = [
  { key: 'content', tools: ['step', 'cta', 'hotspots', 'voice', 'next'] },
  // EXT-02 §6.3 : « Projecteur » après Zoom
  { key: 'screen', tools: ['blur', 'zoom', 'spotlight', 'crop', 'image'] },
  // Retours client 21/11 §1 : les Commentaires sont dans le panneau sous le canevas, plus dans le rail
  // Recette du lot 3 (P7) : Design et Assistant forment un groupe, comme dans la maquette
  { key: 'look', tools: ['design', 'assistant'] },
];
/** Ordre du rail (raccourcis Alt + 1 à 9 sur les 9 premiers). */
export const TOOL_ORDER: ToolId[] = [...TOOL_GROUPS.flatMap((g) => g.tools), 'settings'];
/**
 * Outils qui portent un raccourci Alt + chiffre, dans l'ordre. « Projecteur » (EXT-02 §6.3) n'en a pas :
 * les raccourcis déjà connus ne bougent pas (Recadrage et Image gardent les leurs).
 */
export const SHORTCUT_ORDER: ToolId[] = TOOL_ORDER.filter((x) => x !== 'spotlight');

const ICONS: Record<ToolId, LucideIcon> = {
  step: Type,
  cta: MousePointerClick,
  hotspots: Target,
  voice: Mic,
  next: GitBranch,
  blur: Droplet,
  zoom: ZoomIn,
  spotlight: Flashlight,
  crop: Crop,
  image: ImageIcon,
  design: Palette,
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
  hidden = [],
}: {
  active: ToolId | null;
  onToggle: (t: ToolId) => void;
  /** Raison de l'indisponibilité, par outil (absent : disponible). */
  disabled: Partial<Record<ToolId, string>>;
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
    // Rang du raccourci Alt + chiffre (-1 : pas de raccourci)
    const k = SHORTCUT_ORDER.filter((x) => !hidden.includes(x)).indexOf(id);
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
        aria-keyshortcuts={k >= 0 && k < 9 ? `Alt+${k + 1}` : undefined}
        data-tip={reason ? `${label} · ${reason}` : undefined}
        data-tip-shortcut={k >= 0 && k < 9 ? `Alt ${k + 1}` : undefined}
        tabIndex={(active ? active === id : n === 0) ? 0 : -1}
        onClick={() => !reason && onToggle(id)}
      >
        <Icon aria-hidden="true" />
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
  onClose,
  enter = false,
  children,
}: {
  id: ToolId | 'form';
  title: string;
  onClose: () => void;
  /** MOTION-01 §2.3 : le panneau entre en glissant (après un geste, jamais au premier affichage). */
  enter?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <aside
      className={`ed-tool fd-dense${enter ? ' is-entering' : ''}`}
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
      {/* Changement de panneau : seul le contenu passe en fondu, le cadre ne bouge pas */}
      <div key={id} className="ed-tool__body">
        {children}
      </div>
    </aside>
  );
}
