/**
 * Adresses e-mail en puces dans un seul champ (MODAL-01, retour client du 21/11). Le champ de saisie
 * est un vrai <input type="email" autocomplete="email"> : le navigateur propose les adresses connues
 * (RGAA 11.13). Virgule, point-virgule, Entrée ou sortie du champ transforment la saisie en puce ;
 * un collage de plusieurs adresses donne autant de puces ; Retour arrière sur le champ vide retire la
 * dernière. Le texte en cours compte aussi à l'envoi (draft), pour ne rien perdre.
 */
import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

/** Découpe une saisie (collage, texte en cours) en adresses, en minuscules, sans doublon. */
export function splitEmails(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}
export const isEmail = (x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);

export function EmailChips({
  id,
  values,
  draft,
  onChange,
  onDraft,
  invalid,
  describedBy,
  placeholder,
  autoFocus,
}: {
  id: string;
  values: string[];
  draft: string;
  onChange: (next: string[]) => void;
  onDraft: (text: string) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const add = (list: string[]) => {
    const next = [...values];
    for (const x of list) if (!next.includes(x)) next.push(x);
    onChange(next);
  };
  const commit = () => {
    const list = splitEmails(draft);
    if (list.length) add(list);
    onDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === ';') && draft.trim()) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const list = splitEmails(draft + ' ' + e.clipboardData.getData('text'));
    if (list.length > 1) {
      e.preventDefault();
      add(list);
      onDraft('');
    }
  };
  return (
    <div
      className={`email-chips${invalid ? ' is-invalid' : ''}`}
      onClick={(e) => e.target === e.currentTarget && input.current?.focus()}
    >
      {values.map((v) => (
        <span key={v} className={`email-chip${isEmail(v) ? '' : ' is-invalid'}`}>
          <span className="email-chip__text">{v}</span>
          <button
            type="button"
            className="email-chip__remove"
            aria-label={t('members.removeEmail', { email: v })}
            onClick={() => {
              onChange(values.filter((x) => x !== v));
              input.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={input}
        id={id}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        autoFocus={autoFocus}
        className="email-chips__input"
        placeholder={values.length ? undefined : placeholder}
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={onKey}
        onPaste={onPaste}
        onBlur={(e) => {
          // Vers le bouton d'envoi : pas de puce maintenant (le champ grandirait et déplacerait le bouton
          // sous le pointeur, le clic serait perdu) ; le texte en cours est compté à l'envoi
          if ((e.relatedTarget as HTMLButtonElement | null)?.type === 'submit') return;
          commit();
        }}
      />
    </div>
  );
}
