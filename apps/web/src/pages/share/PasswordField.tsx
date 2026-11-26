import { Copy, Eye, EyeOff, Key, Lock } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/Toast';

/** Mots du mot de passe proposé (lisibles, sans accent ni caractère ambigu). */
const ADJ = [
  'Rapide',
  'Calme',
  'Rouge',
  'Brave',
  'Vif',
  'Doux',
  'Clair',
  'Sage',
  'Agile',
  'Joyeux',
  'Sobre',
  'Franc',
];
const NOUN = [
  'Cactus',
  'Lune',
  'Rivage',
  'Sapin',
  'Orage',
  'Phare',
  'Comete',
  'Falaise',
  'Prairie',
  'Volcan',
  'Ruisseau',
  'Atlas',
];

const pick = <T,>(list: T[], r: number) => list[r % list.length]!;

/**
 * Retours client, planche 1 : mot de passe proposé, façon gestionnaire de mots de passe. Quatre parties
 * (« Rapide-Cactus-48-Lune »), 16 caractères au moins, tirées au hasard du navigateur (crypto).
 */
export function suggestPassword(): string {
  for (;;) {
    const r = crypto.getRandomValues(new Uint32Array(4));
    const pw = [pick(ADJ, r[0]!), pick(NOUN, r[1]!), String(10 + (r[2]! % 90)), pick(NOUN, r[3]!)].join('-');
    if (pw.length >= 16) return pw;
  }
}

/**
 * Champ « Mot de passe » de l'accès protégé (planche 1). Clé à gauche ; Afficher et Copier, boutons icône
 * de 32 px dans le champ. Au focus d'un champ vide, une suggestion s'ouvre sous le champ (combobox +
 * listbox) : clic ou Entrée la choisit ; taper ou Échap la ferme. Elle change à chaque ouverture.
 */
export function PasswordField({
  value,
  onChange,
  placeholder,
  describedBy,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  describedBy: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const listId = `${id}-list`;
  const optId = `${id}-opt`;
  const [show, setShow] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const open = suggestion !== null;
  const close = () => {
    setSuggestion(null);
    setActive(false);
  };
  const choose = () => {
    if (!suggestion) return;
    onChange(suggestion);
    close();
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Les flèches restent dans le champ (la liste des modes d'accès les écoute aussi)
    if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') e.stopPropagation();
    if (!open) {
      if (e.key === 'ArrowDown' && !value) {
        e.preventDefault();
        setSuggestion(suggestPassword());
        setActive(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose();
    }
  };
  return (
    <div className="pwf">
      <div className="pwf-box">
        <Key className="pwf-key" aria-hidden="true" />
        <input
          id="acc-pw"
          className="input pwf-input"
          type={show ? 'text' : 'password'}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active ? optId : undefined}
          autoComplete="new-password"
          minLength={8}
          maxLength={200}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          disabled={disabled}
          onFocus={() => !value && setSuggestion(suggestPassword())}
          onBlur={close}
          onKeyDown={onKey}
          onChange={(e) => {
            // Le visiteur tape : il garde son propre mot de passe
            close();
            onChange(e.target.value);
          }}
        />
        <span className="pwf-acts">
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('access.showPw')}
            aria-pressed={show}
            disabled={disabled}
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('access.copyPw')}
            aria-disabled={!value || disabled ? true : undefined}
            onClick={() => {
              if (!value || disabled) return;
              void navigator.clipboard
                .writeText(value)
                .then(() => toast(t('access.pwCopied')))
                .catch(() => undefined);
            }}
          >
            <Copy aria-hidden="true" />
          </button>
        </span>
      </div>
      <ul
        id={listId}
        role="listbox"
        className="pwf-list"
        hidden={!open}
        aria-label={t('access.pwSuggestions')}
      >
        {suggestion && (
          <li
            id={optId}
            role="option"
            aria-selected={active}
            className="pwf-opt"
            // Avant le blur du champ : le choix est pris en compte
            onMouseDown={(e) => {
              e.preventDefault();
              choose();
            }}
          >
            <Lock aria-hidden="true" />
            <span className="pwf-tx">
              <b>{suggestion}</b>
              <small>{t('access.pwStrong', { n: suggestion.length })}</small>
            </span>
            <span className="fd-badge pwf-sug">{t('access.pwSuggested')}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
