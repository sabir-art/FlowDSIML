/**
 * EXT-02 §7 : champ de mot de passe commun (Inscription, Nouveau mot de passe, Profil).
 *  - œil afficher / masquer intégré au champ (champ composé, FIELD-01 §11.3) ;
 *  - jauge de force à 4 segments, indicative ;
 *  - règles de la politique (lib/passwordPolicy.ts) cochées en direct ;
 *  - erreur sous le champ : une phrase qui dit quoi faire.
 * Le serveur reste juge : rien ici ne désactive le bouton d'envoi.
 */
import { Circle, CircleAlert, CircleCheck, CircleX, Eye, EyeOff } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PASSWORD_POLICY, passwordRules } from '../lib/passwordPolicy';
import { passwordStrength } from '../lib/validation';

/**
 * Champ de mot de passe avec son œil. Un œil par champ, indépendant ; l'envoi du formulaire remasque.
 *
 * EXT-02 §7.1 (sécurité, retour client du 24/11) : l'œil ne révèle jamais une valeur que la personne n'a
 * pas saisie elle-même. Il n'apparaît qu'après une frappe (clavier, collage, dépôt) dans un champ parti
 * de vide. Une valeur arrivée autrement (remplissage automatique du navigateur, gestionnaire de mots de
 * passe, valeur posée par le code) reste masquée et sans œil jusqu'à ce que le champ soit vidé puis
 * ressaisi. Quitter le champ remasque.
 *  - `noEye` : jamais d'œil (mot de passe actuel) ;
 *  - `guard` : champ en lecture seule tant qu'il n'a pas le focus, pour que le navigateur ne le
 *    préremplisse pas à l'affichage.
 */
export function PasswordInput({
  className,
  noEye = false,
  guard = false,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { noEye?: boolean; guard?: boolean }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  // `own` : la valeur vient de la frappe de la personne ; `foreign` : une valeur est arrivée autrement
  const [own, setOwn] = useState(false);
  const foreign = useRef(false);
  const gesture = useRef(false);
  const seen = useRef('');
  const [armed, setArmed] = useState(!guard);
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<[number | null, number | null] | null>(null);
  // Changer le type du champ remet la sélection à zéro dans Chromium, parfois après le rendu : le
  // curseur est remis à sa place tout de suite, puis de nouveau à l'image suivante
  useLayoutEffect(() => {
    const el = ref.current;
    const saved = caret.current;
    caret.current = null;
    if (!el || !saved || saved[0] === null) return;
    const restore = () => {
      if (document.activeElement === el) el.setSelectionRange(saved[0], saved[1] ?? saved[0]);
    };
    restore();
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [shown]);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener('submit', hide);
    return () => form.removeEventListener('submit', hide);
  }, []);

  // Gestes de la personne (frappe, effacement, collage, dépôt, saisie composée, clavier virtuel) : le
  // navigateur les annonce par `beforeinput`. Un remplissage automatique n'en envoie pas, ou l'annonce
  // comme un remplacement de texte.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const before = (e: Event) => {
      const type = (e as InputEvent).inputType ?? '';
      gesture.current = /^(insert(Text|CompositionText|FromPaste|FromDrop|FromYank)|delete)/.test(type);
    };
    el.addEventListener('beforeinput', before);
    return () => el.removeEventListener('beforeinput', before);
  }, []);

  /** Classe la valeur du champ : saisie par la personne, ou arrivée d'ailleurs. */
  const settle = (value: string, typed: boolean) => {
    seen.current = value;
    if (value === '') {
      // Champ vidé : on repart de zéro, la prochaine frappe rendra l'œil
      foreign.current = false;
      setOwn(false);
      setShown(false);
    } else if (typed && !foreign.current) setOwn(true);
    else {
      foreign.current = true;
      setOwn(false);
      setShown(false);
    }
  };
  // Valeur changée sans événement de saisie (posée par le code, restaurée par le navigateur)
  useLayoutEffect(() => {
    const value = ref.current?.value ?? '';
    if (value !== seen.current) settle(value, false);
  });

  const eye = !noEye && own;
  return (
    // ALIGN-01 : le champ composé compte par son cadre (l'œil est son contenu)
    <span
      className={`fd-pw${className ? ` ${className}` : ''}`}
      data-align-zone=""
      // Quitter le champ (et son œil) remasque
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShown(false);
      }}
    >
      <input
        {...input}
        ref={ref}
        className="fd-pw__input"
        type={shown && eye ? 'text' : 'password'}
        readOnly={input.readOnly || !armed}
        onFocus={(e) => {
          setArmed(true);
          input.onFocus?.(e);
        }}
        onPointerDown={(e) => {
          setArmed(true);
          input.onPointerDown?.(e);
        }}
        onInput={(e) => {
          const typed = gesture.current;
          gesture.current = false;
          settle(e.currentTarget.value, typed);
          input.onInput?.(e);
        }}
      />
      {eye && (
        <button
          type="button"
          className="fd-pw__eye"
          aria-label={t('password.show')}
          aria-pressed={shown}
          // Le clic garde le focus et le curseur dans le champ
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const el = ref.current;
            if (el) caret.current = [el.selectionStart, el.selectionEnd];
            setShown((s) => !s);
          }}
        >
          {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      )}
    </span>
  );
}

const LEVELS: readonly string[] = ['weak', 'medium', 'good', 'strong'];

/** Jauge de force : Faible (1 segment), Moyen (2), Bon (3), Fort (4). Elle informe, elle ne bloque pas. */
export function PasswordMeter({ password }: { password: string }) {
  const { t } = useTranslation();
  // EXT-02 §7.3 : la jauge apparaît au premier caractère, quand elle a quelque chose à dire
  if (!password) return null;
  // Tant qu'une règle de la politique manque, la jauge s'arrête à « Faible » : elle ne dit jamais
  // « Moyen » d'un mot de passe que le serveur refuse
  const level = passwordRules(password).every((r) => r.ok) ? Math.max(1, passwordStrength(password)) : 0;
  return (
    <div className="fd-pw-meter" data-level={level < 0 ? undefined : LEVELS[level]}>
      {/* §18.6 : segments d'une même jauge, accolés à 4 px */}
      <span className="fd-pw-meter__bar" aria-hidden="true" data-gap-exempt="">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= level ? 'is-on' : undefined} />
        ))}
      </span>
      <span className="fd-pw-meter__label">
        {level >= 0 && (
          <>
            <span className="sr-only">{t('password.strength')} </span>
            {t(`password.level.${LEVELS[level]}`)}
          </>
        )}
      </span>
    </div>
  );
}

function Rule({ state, children }: { state: 'ok' | 'todo' | 'failed'; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <li className={`fd-pw-rule is-${state}`}>
      {state === 'ok' ? (
        <CircleCheck aria-hidden="true" />
      ) : state === 'failed' ? (
        <CircleX aria-hidden="true" />
      ) : (
        <Circle aria-hidden="true" />
      )}
      <span>
        {children}
        <span className="sr-only"> : {t(state === 'ok' ? 'password.met' : 'password.unmet')}</span>
      </span>
    </li>
  );
}

/**
 * Règles de la politique, une ligne chacune. `failed` : un envoi vient d'être refusé, les règles
 * manquantes passent en erreur. Une région polie annonce le nombre de règles respectées, 1 s après la
 * dernière frappe et seulement s'il a changé.
 */
export function PasswordRules({ id, password, failed }: { id: string; password: string; failed?: boolean }) {
  const { t } = useTranslation();
  const rules = passwordRules(password);
  const ok = rules.filter((r) => r.ok).length;
  const [said, setSaid] = useState('');
  const last = useRef(ok);
  useEffect(() => {
    if (ok === last.current) return;
    const timer = setTimeout(() => {
      last.current = ok;
      setSaid(t('password.count', { count: ok, total: rules.length }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [ok, rules.length, t]);
  return (
    <>
      <ul id={id} className="fd-pw-rules" role="list">
        {rules.map((r) => (
          <Rule key={r.rule} state={r.ok ? 'ok' : failed ? 'failed' : 'todo'}>
            {t(`password.rule.${r.rule}`, { min: PASSWORD_POLICY.minLength })}
          </Rule>
        ))}
      </ul>
      <span className="sr-only" role="status" aria-live="polite">
        {said}
      </span>
    </>
  );
}

/** Règle unique de la confirmation, visible dès qu'on y tape. */
export function PasswordMatch({ id, password, confirm }: { id: string; password: string; confirm: string }) {
  const { t } = useTranslation();
  if (!confirm) return null;
  return (
    <ul id={id} className="fd-pw-rules" role="list">
      <Rule state={confirm === password ? 'ok' : 'todo'}>{t('password.match')}</Rule>
    </ul>
  );
}

/** Erreur sous le champ : une phrase qui dit quoi faire. */
export function PasswordError({ id, children }: { id: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="fd-pw-error" role="alert">
      <CircleAlert aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
