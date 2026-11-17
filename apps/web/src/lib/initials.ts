/** Initiales pour l'avatar : « Marie Durand » → « MD », « jean@x.fr » → « J ». */
export function initials(nameOrEmail: string) {
  const base =
    nameOrEmail.includes('@') && !nameOrEmail.includes(' ') ? nameOrEmail.split('@')[0]! : nameOrEmail;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0]?.[0] ?? '?');
  return letters.toUpperCase();
}
