/**
 * Variables de build obligatoires : aucune valeur par défaut dans le code (dépôt public). Le build
 * s'arrête avec un message clair si l'une manque : variables du dépôt en CI, sinon .env.production.local
 * (jamais commité). Utilisé par les configurations Vite et WXT.
 */
export function assertBuildEnv(env: Record<string, string | undefined>, names: readonly string[]): void {
  const missing = names.filter((n) => !env[n]?.trim());
  if (missing.length === 0) return;
  throw new Error(
    `Variable(s) de build manquante(s) : ${missing.join(', ')}. ` +
      'Renseignez-les dans l’environnement (variables du dépôt en CI) ou dans .env.production.local (jamais commité).',
  );
}
