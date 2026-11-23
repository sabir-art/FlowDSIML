/**
 * Politique de mot de passe de l'app : la seule source côté client. Elle recopie celle de Supabase Auth
 * (supabase/config.toml : minimum_password_length et password_requirements =
 * "lower_upper_letters_digits_symbols", l'option recommandée ; même réglage dans le tableau de bord de la
 * production, choix du client du 23/11). Le serveur reste juge : la liste de règles des formulaires et
 * les messages d'erreur s'appuient sur ces valeurs.
 */
export const PASSWORD_POLICY = { minLength: 8, lower: true, upper: true, digit: true, symbol: true } as const;

export type PasswordRule = 'length' | 'lower' | 'upper' | 'digit' | 'symbol';

/** Jeux de caractères de Supabase Auth : une lettre accentuée ou un autre signe n'y comptent pas. */
export const PASSWORD_CHARS: Record<Exclude<PasswordRule, 'length'>, RegExp> = {
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digit: /[0-9]/,
  symbol: /[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~]/,
};

/** Règles de la politique, dans l'ordre d'affichage, avec leur état pour ce mot de passe. */
export function passwordRules(password: string): Array<{ rule: PasswordRule; ok: boolean }> {
  return [
    { rule: 'length', ok: password.length >= PASSWORD_POLICY.minLength },
    { rule: 'lower', ok: PASSWORD_CHARS.lower.test(password) },
    { rule: 'upper', ok: PASSWORD_CHARS.upper.test(password) },
    { rule: 'digit', ok: PASSWORD_CHARS.digit.test(password) },
    { rule: 'symbol', ok: PASSWORD_CHARS.symbol.test(password) },
  ];
}
