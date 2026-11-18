/**
 * L22-07 : champ de commentaire avec mentions @.
 * Champ natif (saisie, curseur, IME, correcteur intacts) + calque derrière qui dessine les pastilles ;
 * « @ » ouvre une liste de membres (aria-autocomplete=list, listbox, aria-activedescendant).
 */
import {
  forwardRef,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from 'react';
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
};

const MAX_OPTIONS = 6;

export const MentionInput = forwardRef<HTMLTextAreaElement, Props>(function MentionInput(
  { value, mentions, onValueChange, members, presentIds, wrapClassName, onKeyDown, className, ...rest },
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
  const open = !!query && dismissed !== query.start && options.length > 0;
  const activeIdx = Math.min(active, options.length - 1);

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
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.caret, r.caret);
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
          requestAnimationFrame(() => el.setSelectionRange(r.caret, r.caret));
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
        aria-controls={open ? `${id}-ac` : undefined}
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
      {open && (
        <ul className="mi-ac" id={`${id}-ac`} role="listbox" aria-label={t('editor.comments.mentionList')}>
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
              <span className={`cm-avatar cm-avatar--${avatarTone(m.user_id)} mi-avatar`} aria-hidden="true">
                {initials(m.full_name || m.email)}
              </span>
              <span>
                <b>{m.full_name || m.email}</b>
                <small>
                  {[
                    m.role ? t(`roles.${m.role}`) : null,
                    presentIds?.has(m.user_id) ? t('editor.comments.onDemo') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
