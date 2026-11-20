/**
 * L43 : composeur de message (assistant IA, commentaires, tout futur champ de discussion).
 * Un seul cadre : la zone de texte (1 à 8 lignes), puis la barre d'actions (outils à gauche ; compteur,
 * « Annuler » et envoi à droite). Entrée envoie, Maj + Entrée passe à la ligne, jamais pendant une
 * composition (accents, IME). Le champ est fourni par l'appelant (`renderInput`), par exemple un champ
 * à mentions : il reçoit les propriétés à poser sur son `textarea`.
 */
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { ArrowUp, Check, Square } from 'lucide-react';

export interface ComposerInputProps {
  id: string;
  ref: Ref<HTMLTextAreaElement>;
  className: string;
  rows: number;
  value: string;
  placeholder: string;
  maxLength: number;
  disabled?: boolean;
  'aria-label': string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export interface ComposerProps {
  value: string;
  /** Libellé du champ (masqué visuellement). */
  label: string;
  placeholder: string;
  maxLength: number;
  onSubmit: () => void;
  /** Champ standard si absent. */
  renderInput?: (props: ComposerInputProps) => ReactNode;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  /** Envoi en cours : bouton désactivé. */
  sending?: boolean;
  /** Réponse en cours (assistant) : le bouton devient « Arrêter ». */
  stop?: { label: string; onStop: () => void };
  /** Modification : « Annuler » dans la barre, bouton « Enregistrer » (coche). Échap annule. */
  edit?: { cancelLabel: string; onCancel: () => void };
  submitLabel: string;
  /** Texte de la touche dans l'infobulle du bouton (« Entrée »). */
  submitKey?: string;
  /** Outils à gauche de la barre (boutons à icône de 32 px). */
  tools?: ReactNode;
  /** Message d'erreur sous le cadre (le texte saisi est conservé). */
  error?: ReactNode;
  /** Id d'un texte qui décrit le champ (mention de contexte du panneau). */
  describedBy?: string;
  /** Compteur « n / max » à partir de 80 % de la limite. */
  counterLabel?: (count: number, max: number) => string;
  /** Lignes visibles au plus avant le défilement (8 ; moins dans un panneau bas). */
  maxLines?: number;
  className?: string;
}

const MAX_LINES = 8;

export function Composer({
  value,
  label,
  placeholder,
  maxLength,
  onSubmit,
  renderInput,
  onValueChange,
  disabled,
  sending,
  stop,
  edit,
  submitLabel,
  submitKey,
  tools,
  error,
  describedBy,
  counterLabel = (n, max) => `${n} / ${max}`,
  maxLines = MAX_LINES,
  className = '',
}: ComposerProps) {
  const id = useId();
  const ta = useRef<HTMLTextAreaElement | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const counterId = `${id}-count`;
  const errorId = `${id}-err`;
  const showCount = value.length >= Math.ceil(maxLength * 0.8);
  const empty = !value.trim();

  // Hauteur automatique de 1 à 8 lignes, puis défilement interne
  const fit = useCallback(() => {
    const el = ta.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 22;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    el.style.height = 'auto';
    const max = line * Math.max(1, Math.min(MAX_LINES, maxLines)) + pad;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [maxLines]);
  useLayoutEffect(fit, [value, fit]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' && edit) {
      e.preventDefault();
      e.stopPropagation();
      edit.onCancel();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      if (!empty && !sending && !stop) form.current?.requestSubmit();
    }
  };

  const describedByIds =
    [describedBy, showCount ? counterId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;
  const inputProps: ComposerInputProps = {
    id: `${id}-input`,
    ref: (el) => {
      ta.current = el;
    },
    className: 'fd-composer__input',
    rows: 1,
    value,
    placeholder,
    maxLength,
    disabled,
    'aria-label': label,
    'aria-describedby': describedByIds,
    'aria-invalid': error ? true : undefined,
    onKeyDown,
  };

  const SubmitIcon = edit ? Check : ArrowUp;
  return (
    <div className={`fd-composer-wrap ${className}`}>
      <form
        ref={form}
        className={`fd-composer${error ? ' is-error' : ''}${disabled ? ' is-disabled' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!empty && !sending && !disabled) onSubmit();
        }}
      >
        {renderInput ? (
          renderInput(inputProps)
        ) : (
          <textarea {...inputProps} onChange={(e) => onValueChange?.(e.target.value)} />
        )}
        <div className="fd-composer__bar">
          <div className="fd-composer__tools">{tools}</div>
          <div className="fd-composer__end">
            {showCount && (
              <span
                id={counterId}
                className={`fd-composer__count${value.length >= maxLength ? ' is-max' : ''}`}
              >
                {counterLabel(value.length, maxLength)}
              </span>
            )}
            {edit && (
              <button type="button" className="fd-composer__cancel" onClick={edit.onCancel}>
                {edit.cancelLabel}
              </button>
            )}
            {stop ? (
              <button
                type="button"
                className="fd-composer__send is-stop"
                aria-label={stop.label}
                onClick={stop.onStop}
              >
                <Square aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                className="fd-composer__send"
                aria-label={submitLabel}
                aria-keyshortcuts="Enter"
                data-tip-shortcut={submitKey}
                disabled={empty || sending || disabled}
              >
                <SubmitIcon aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </form>
      {error && (
        <p id={errorId} className="fd-composer__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
