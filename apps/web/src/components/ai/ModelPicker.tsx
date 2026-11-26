import { Check, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { AiModelChoice, AssistantModel } from '../../lib/ai';
import { getPortal } from '../../lib/floating';

/**
 * Retours client, planche 3 : pilule du modèle dans le champ de l'assistant (« Auto » par défaut) et son
 * menu (288 px, rayon 16), ouvert au-dessus, aligné sur le bord droit du panneau : Auto ; Recommandé
 * (menuitemradio) ; Autres modèles › (sous-menu sur le côté). L41 étape 4 : la liste vient du serveur
 * (modèles proposés par la Console, dans leur ordre, avec leur étiquette).
 */
export function ModelPicker({
  value,
  onChange,
  models,
}: {
  value: AiModelChoice;
  onChange: (v: AiModelChoice) => void;
  models: AssistantModel[];
}) {
  const { t } = useTranslation();
  const id = useId();
  const pill = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const sub = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [pos, setPos] = useState<{
    right: number;
    bottom: number;
    subRight: number;
    subBottom: number;
  } | null>(null);
  const byId = (v: string) => models.find((m) => m.id === v);
  const label = value === 'auto' ? t('ai.model.auto') : (byId(value)?.label ?? t('ai.model.auto'));
  const recommended = models.filter((m) => m.tag === 'recommended');
  const others = models.filter((m) => m.tag !== 'recommended');

  const close = (focus = true) => {
    setOpen(false);
    setMore(false);
    setPos(null);
    if (focus) pill.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open || !pill.current) return;
    const p = pill.current.getBoundingClientRect();
    const panel = (pill.current.closest('[data-tool-panel], .ai-as') ?? pill.current.parentElement)!;
    const edge = panel.getBoundingClientRect().right;
    const m = menu.current?.getBoundingClientRect();
    setPos({
      right: Math.max(8, window.innerWidth - edge + 8),
      bottom: window.innerHeight - p.top + 4,
      subRight: m ? window.innerWidth - m.left + 4 : 0,
      subBottom: m ? window.innerHeight - m.bottom : 0,
    });
  }, [open, more]);
  // Premier élément coché au focus à l'ouverture ; clic extérieur ferme
  // Focus sur le modèle courant une fois le menu placé (invisible avant, il ne prendrait pas le focus)
  const placed = !!pos;
  useEffect(() => {
    if (open && placed && !more)
      if (!menu.current?.contains(document.activeElement))
        menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open, placed, more]);
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!menu.current?.contains(n) && !sub.current?.contains(n) && !pill.current?.contains(n)) close(false);
    };
    document.addEventListener('pointerdown', out);
    return () => document.removeEventListener('pointerdown', out);
  }, [open]);
  useEffect(() => {
    if (more) sub.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, [more]);

  const nav = (root: HTMLElement | null, e: KeyboardEvent) => {
    const items = [...(root?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const to =
      e.key === 'ArrowDown'
        ? items[(i + 1) % items.length]
        : e.key === 'ArrowUp'
          ? items[(i - 1 + items.length) % items.length]
          : e.key === 'Home'
            ? items[0]
            : e.key === 'End'
              ? items[items.length - 1]
              : null;
    if (to) {
      e.preventDefault();
      to.focus();
    }
  };
  const pick = (v: AiModelChoice) => {
    onChange(v);
    close();
  };
  const row = (v: AiModelChoice, tile: React.ReactNode) => (
    <div
      role="menuitemradio"
      aria-checked={value === v}
      tabIndex={-1}
      className="aim-item"
      onClick={() => pick(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick(v);
        }
      }}
    >
      <span className="aim-tile" aria-hidden="true">
        {tile}
      </span>
      <span className="aim-tx">
        <b>
          {v === 'auto' ? t('ai.model.auto') : (byId(v)?.label ?? v)}
          {byId(v)?.tag === 'beta' && <span className="aim-beta">{t('ai.model.beta')}</span>}
        </b>
        <small>
          {v === 'auto'
            ? t('ai.model.autoHelp')
            : t(`ai.model.help.${v}`, {
                defaultValue: `${t(`console.ai.speed.${byId(v)?.speed ?? 2}`)} · ${t(`console.ai.cost.${byId(v)?.cost ?? 2}`)}`,
              })}
        </small>
      </span>
      {value === v && <Check className="aim-check" aria-hidden="true" />}
    </div>
  );

  return (
    <>
      <button
        ref={pill}
        type="button"
        className="aim-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label={t('ai.model.pick', { model: label })}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {label}
        <ChevronDown aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <>
            <div
              ref={menu}
              id={`${id}-menu`}
              role="menu"
              aria-label={t('ai.model.menu')}
              className="aim-menu"
              style={pos ? { right: pos.right, bottom: pos.bottom } : { visibility: 'hidden' }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  // Échap ferme le menu seulement (pas le panneau de l'assistant)
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                } else if (e.key === 'Tab') close(false);
                else if (e.key === 'ArrowRight' && (e.target as HTMLElement).dataset.more !== undefined) {
                  e.preventDefault();
                  setMore(true);
                } else nav(menu.current, e);
              }}
            >
              {row('auto', <Sparkles aria-hidden="true" />)}
              {recommended.length > 0 && (
                <>
                  <div role="separator" className="aim-sep" />
                  <div role="group" aria-labelledby={`${id}-rec`}>
                    <div className="aim-head" id={`${id}-rec`}>
                      {t('ai.model.recommended')}
                    </div>
                    {recommended.map((m) => (
                      <div key={m.id}>{row(m.id, <span className="aim-mono">{m.label[0]}</span>)}</div>
                    ))}
                  </div>
                </>
              )}
              {/* Recette UX L41 étape 4 : pas d'entrée « Autres modèles » quand le sous-menu serait vide */}
              {others.length > 0 && (
                <>
                  <div role="separator" className="aim-sep" />
                  <div
                    role="menuitem"
                    tabIndex={-1}
                    aria-haspopup="menu"
                    aria-expanded={more}
                    data-more=""
                    className="aim-item aim-more"
                    onClick={() => setMore((v) => !v)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setMore(true);
                      }
                    }}
                  >
                    <span className="aim-tile" aria-hidden="true" />
                    <span className="aim-tx">
                      <b>{t('ai.model.others')}</b>
                    </span>
                    <ChevronRight className="aim-check" aria-hidden="true" />
                  </div>
                </>
              )}
            </div>
            {more && others.length > 0 && (
              <div
                ref={sub}
                role="menu"
                aria-label={t('ai.model.others')}
                className="aim-menu aim-sub"
                style={pos ? { right: pos.subRight, bottom: pos.subBottom } : { visibility: 'hidden' }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    e.stopPropagation();
                    setMore(false);
                    menu.current?.querySelector<HTMLElement>('[data-more]')?.focus();
                  } else nav(sub.current, e);
                }}
              >
                {others.map((m) => (
                  <div key={m.id}>{row(m.id, <span className="aim-mono">{m.label[0]}</span>)}</div>
                ))}
                {/* « Le propriétaire choisit les modèles… » reviendra avec l'étape 5 (section de l'espace) */}
              </div>
            )}
          </>,
          getPortal(),
        )}
    </>
  );
}
