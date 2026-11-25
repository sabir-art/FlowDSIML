let seq = 0;

/**
 * Nom d'un canal temps réel qui écoute des changements en base (`postgres_changes`). Le nom n'y sert pas
 * d'adresse : il doit seulement être unique. `supabase.channel(nom)` rend le canal existant tant que son
 * retrait (asynchrone) n'est pas fini ; un composant remonté aussitôt retombait donc sur un canal déjà
 * abonné, et y ajouter un écouteur lève une erreur qui vidait la page. Un suffixe par abonnement l'évite.
 * À ne pas utiliser pour la présence ni la diffusion, où le nom est partagé entre les participants.
 */
export const changesChannel = (base: string) => `${base}:${++seq}`;
