/**
 * Politique de mot de passe de l'app : la seule source côté client. Elle recopie celle de Supabase Auth
 * (supabase/config.toml : minimum_password_length et password_requirements = "letters_digits" ; même
 * réglage dans le tableau de bord de la production). Le serveur reste juge : la liste de règles des
 * formulaires et les messages d'erreur s'appuient sur ces valeurs, sans jamais bloquer l'envoi.
 */
export const PASSWORD_POLICY = { minLength: 8, letter: true, digit: true } as const;

export type PasswordRule = 'length' | 'letter' | 'digit';

/** Règles de la politique, dans l'ordre d'affichage, avec leur état pour ce mot de passe. */
export function passwordRules(password: string): Array<{ rule: PasswordRule; ok: boolean }> {
  return [
    { rule: 'length', ok: password.length >= PASSWORD_POLICY.minLength },
    { rule: 'letter', ok: /\p{L}/u.test(password) },
    { rule: 'digit', ok: /\d/.test(password) },
  ];
}
