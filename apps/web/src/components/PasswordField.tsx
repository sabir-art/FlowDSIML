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

/** Champ de mot de passe avec son œil. Un œil par champ, indépendant ; l'envoi du formulaire remasque. */
export function PasswordInput({ className, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
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
  return (
    // ALIGN-01 : le champ composé compte par son cadre (l'œil est son contenu)
    <span className={`fd-pw${className ? ` ${className}` : ''}`} data-align-zone="">
      <input {...input} ref={ref} className="fd-pw__input" type={shown ? 'text' : 'password'} />
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
    </span>
  );
}

const LEVELS: readonly string[] = ['weak', 'medium', 'good', 'strong'];

/** Jauge de force : Faible (1 segment), Moyen (2), Bon (3), Fort (4). Elle informe, elle ne bloque pas. */
export function PasswordMeter({ password }: { password: string }) {
  const { t } = useTranslation();
  const level = password ? passwordStrength(password) : -1;
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
