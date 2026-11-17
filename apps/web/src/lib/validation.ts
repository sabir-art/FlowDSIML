import type { TFunction } from 'i18next';

export type FieldErrors = Record<string, string>;

/**
 * Validation sans bulles natives (W19) : lit les contraintes HTML (required, type=email, minLength)
 * des champs du formulaire et renvoie un message traduit par id de champ.
 */
export function validateForm(form: HTMLFormElement, t: TFunction): FieldErrors {
  const errors: FieldErrors = {};
  for (const el of Array.from(form.querySelectorAll<HTMLInputElement>('input[id]'))) {
    const v = el.type === 'checkbox' ? '' : el.value.trim();
    if (el.type === 'checkbox' && el.required && !el.checked) errors[el.id] = t('validation.consent');
    else if (el.required && !v) errors[el.id] = t('validation.required');
    else if (el.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
      errors[el.id] = t('validation.email');
    else if (el.minLength > 0 && v && v.length < el.minLength)
      errors[el.id] = t('validation.passwordMin', { min: el.minLength });
  }
  return errors;
}

/** Focalise le premier champ en erreur ; renvoie true s'il y a des erreurs. */
export function focusFirstError(form: HTMLFormElement, errors: FieldErrors): boolean {
  const first = Object.keys(errors)[0];
  if (first) (form.querySelector<HTMLElement>(`#${CSS.escape(first)}`) ?? null)?.focus();
  return Boolean(first);
}

/** Attributs ARIA d'un champ selon son erreur. */
export function fieldA11y(id: string, errors: FieldErrors) {
  return errors[id] ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};
}

/** Robustesse indicative du mot de passe (0–3), sans dépendance. */
export function passwordStrength(p: string): 0 | 1 | 2 | 3 {
  if (p.length < 8) return 0;
  let score = 0;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return Math.max(1, score) as 1 | 2 | 3;
}
