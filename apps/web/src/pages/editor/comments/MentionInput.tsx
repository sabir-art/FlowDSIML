/**
 * L22-07 : champ de commentaire avec mentions @.
 * Champ natif (saisie, curseur, IME, correcteur intacts) + calque derrière qui dessine les pastilles ;
 * « @ » ouvre une liste de membres (aria-autocomplete=list, listbox, aria-activedescendant).
 */
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from 'react';
import { AvatarPhoto } from '../../../components/AvatarPhoto';
import { useTranslation } from 'react-i18next';
import { initials } from '../../../lib/initials';
import { avatarTone } from '../../../lib/avatarTone';
import {
  backspaceMention,
  draftParts,
  insertMention,
  matchesMember,
  mentionQuery,
  type Mention,
} from '../../../lib/mentions';

export interface MentionMember {
  user_id: string;
  full_name: string;
  email: string;
  role?: string;
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  mentions: Mention[];
  onValueChange: (text: string, mentions: Mention[]) => void;
  members: MentionMember[];
  /** Membres présents sur la démo (L22-08) : « sur cette démo » dans la liste. */
  presentIds?: Set<string>;
  wrapClassName?: string;
  /** L43 : bouton « Mentionner » : chaque incrément insère « @ » au curseur et ouvre la liste. */
  openSignal?: number;
  /** L43 : liste ouverte ou fermée (aria-expanded du bouton « Mentionner »). */
  onOpenChange?: (open: boolean) => void;
  /** Id donné à la liste (aria-controls du bouton « Mentionner »). */
  listId?: string;
};

const MAX_OPTIONS = 6;

export const MentionInput = forwardRef<HTMLTextAreaElement, Props>(function MentionInput(
  {
    value,
    mentions,
    onValueChange,
    members,
    presentIds,
    wrapClassName,
    openSignal = 0,
    onOpenChange,
    listId,
    onKeyDown,
    className,
    ...rest
  },
  ref,
) {
  const { t } = useTranslation();
  const id = useId();
  const ta = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ta.current as HTMLTextAreaElement);
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);

  const options = query
    ? members.filter((m) => matchesMember(query.query, m.full_name, m.email)).slice(0, MAX_OPTIONS)
    : [];
  const shown = !!query && dismissed !== query.start;
  const open = shown && options.length > 0;
  // L43 : personne d'autre dans l'espace : la liste le dit au lieu de ne rien afficher
  const noOne = shown && members.length === 0;
  const activeIdx = Math.min(active, options.length - 1);
  const acId = listId ?? `${id}-ac`;
  const list = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  // Curseur à poser après la prochaine mise à jour du champ, dans le même rendu (useLayoutEffect).
  // Un requestAnimationFrame arrivait après les frappes suivantes et ramenait le curseur en arrière
  // (« merci » saisi juste après une mention devenait « ercim »).
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ta.current;
    const caret = pendingCaret.current;
    if (!el || caret === null) return;
    pendingCaret.current = null;
    if (document.activeElement !== el) el.focus();
    el.setSelectionRange(caret, caret);
  });

  useEffect(() => onOpenChange?.(open || noOne), [open, noOne, onOpenChange]);
  // Au-dessus du cadre ; dessous si la place manque (règle de placement L44)
  useLayoutEffect(() => {
    if (!(open || noOne) || !list.current || !ta.current) return setBelow(false);
    const h = list.current.offsetHeight;
    setBelow(ta.current.getBoundingClientRect().top - h - 6 < 8);
  }, [open, noOne, options.length]);

  // Bouton « Mentionner » : « @ » au curseur (précédé d'une espace si besoin), liste ouverte
  const signal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === signal.current) return;
    signal.current = openSignal;
    const el = ta.current;
    if (!el) return;
    const at = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? at;
    const before = value.slice(0, at);
    const ins = before && !/\s$/.test(before) ? ' @' : '@';
    const text = before + ins + value.slice(end);
    if (text.length > (el.maxLength > 0 ? el.maxLength : Infinity)) return el.focus();
    onValueChange(text, mentions);
    const caret = at + ins.length;
    setDismissed(null);
    setQuery({ start: caret - 1, query: '' });
    setActive(0);
    pendingCaret.current = caret;
  }, [openSignal, value, mentions, onValueChange]);

  const refreshQuery = (text: string, caret: number) => {
    const q = mentionQuery(text, caret);
    setQuery(q);
    if (!q || q.query !== query?.query) setActive(0);
    if (!q) setDismissed(null);
  };

  const choose = (m: MentionMember) => {
    const el = ta.current;
    if (!el || !query) return;
    const name = m.full_name || m.email;
    const r = insertMention(value, query.start, el.selectionStart, name);
    const next = mentions.some((x) => x.id === m.user_id && x.name === name)
      ? mentions
      : [...mentions, { name, id: m.user_id }];
    onValueChange(r.text, next);
    setQuery(null);
    pendingCaret.current = r.caret;
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (noOne && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDismissed(query!.start);
      return;
    }
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setActive((activeIdx + d + options.length) % options.length);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        const m = options[activeIdx];
        if (m) choose(m);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setDismissed(query!.start);
        return;
      }
    }
    if (e.key === 'Backspace' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const el = e.currentTarget;
      if (el.selectionStart === el.selectionEnd) {
        const r = backspaceMention(value, el.selectionStart, mentions);
        if (r) {
          e.preventDefault();
          onValueChange(r.text, mentions);
          pendingCaret.current = r.caret;
          return;
        }
      }
    }
    onKeyDown?.(e);
  };

  // Le calque suit le défilement du champ
  useLayoutEffect(() => {
    if (mirror.current && ta.current) mirror.current.scrollTop = ta.current.scrollTop;
  });

  const parts = draftParts(value, mentions);
  return (
    <div className={`mi${wrapClassName ? ` ${wrapClassName}` : ''}`}>
      <div ref={mirror} className={`mi-mirror ${className ?? ''}`} aria-hidden="true">
        {parts.map((p, i) =>
          'text' in p ? (
            <span key={i}>{p.text}</span>
          ) : (
            <span key={i} className="mi-tag">
              @{p.mention}
            </span>
          ),
        )}
        {/* Un caractère de plus : la dernière ligne vide garde sa hauteur */}
        {'​'}
      </div>
      <textarea
        {...rest}
        ref={ta}
        className={`mi-input ${className ?? ''}`}
        value={value}
        aria-autocomplete="list"
        aria-controls={open ? acId : undefined}
        aria-activedescendant={open ? `${id}-o${activeIdx}` : undefined}
        onChange={(e) => {
          onValueChange(e.target.value, mentions);
          refreshQuery(e.target.value, e.target.selectionStart);
        }}
        onSelect={(e) => refreshQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
        onScroll={(e) => {
          if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onBlur={(e) => {
          // Laisse le temps à un clic dans la liste
          setTimeout(() => setQuery(null), 150);
          rest.onBlur?.(e);
        }}
        onKeyDown={onKey}
      />
      {(open || noOne) && (
        <div ref={list} className={`mi-ac${below ? ' is-below' : ''}`}>
          <p className="mi-ac__title" aria-hidden="true">
            {t('editor.comments.mentionTitle')}
          </p>
          {noOne ? (
            <p className="mi-ac__empty" role="status">
              {t('editor.comments.mentionNoOne')}
            </p>
          ) : (
            <ul id={acId} role="listbox" aria-label={t('editor.comments.mentionList')}>
              {options.map((m, i) => (
                <li
                  key={m.user_id}
                  id={`${id}-o${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(m);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span
                    className={`cm-avatar cm-avatar--${avatarTone(m.user_id)} mi-avatar`}
                    aria-hidden="true"
                  >
                    {initials(m.full_name || m.email)}
                    <AvatarPhoto userId={m.user_id} />
                  </span>
                  <span className="mi-ac__name">
                    <b>{m.full_name || m.email}</b>
                    {presentIds?.has(m.user_id) && <small>{t('editor.comments.onDemo')}</small>}
                  </span>
                  {m.role && <span className="mi-ac__role">{t(`roles.${m.role}`)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});
