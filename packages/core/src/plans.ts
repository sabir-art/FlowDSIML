export type PlanCode = 'free' | 'pro' | 'business' | 'enterprise';

export interface PlanLimits {
  publishedDemos: number | null; // null = illimité
  members: number | null;
  stepsPerDemo: number | null;
  analyticsRetentionDays: number;
}

/**
 * Miroir de la table public.plans (seed). Sert à l'affichage ; l'application des limites est en SQL.
 * L48-A : plus aucune fonction n'est réservée à une offre ; seuls les quotas restent.
 */
export const PLAN_DEFAULTS: Record<PlanCode, PlanLimits> = {
  free: {
    publishedDemos: 3,
    members: 2,
    stepsPerDemo: 30,
    analyticsRetentionDays: 30,
  },
  pro: {
    publishedDemos: 25,
    members: 5,
    stepsPerDemo: 100,
    analyticsRetentionDays: 365,
  },
  business: {
    publishedDemos: null,
    members: 25,
    stepsPerDemo: null,
    analyticsRetentionDays: 730,
  },
  enterprise: {
    publishedDemos: null,
    members: null,
    stepsPerDemo: null,
    analyticsRetentionDays: 1095,
  },
};

export function withinLimit(limit: number | null | undefined, current: number): boolean {
  return limit === null || limit === undefined || current < limit;
}
