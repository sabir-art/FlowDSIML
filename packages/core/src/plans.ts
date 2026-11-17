export type PlanCode = 'free' | 'pro' | 'business' | 'enterprise';

export interface PlanLimits {
  publishedDemos: number | null; // null = illimité
  members: number | null;
  stepsPerDemo: number | null;
  removeBranding: boolean;
  leadForms: boolean;
  analyticsRetentionDays: number;
}

/** Miroir de la table public.plans (seed). Sert à l'affichage ; l'application des limites est en SQL. */
export const PLAN_DEFAULTS: Record<PlanCode, PlanLimits> = {
  free: {
    publishedDemos: 3,
    members: 2,
    stepsPerDemo: 30,
    removeBranding: false,
    leadForms: false,
    analyticsRetentionDays: 30,
  },
  pro: {
    publishedDemos: 25,
    members: 5,
    stepsPerDemo: 100,
    removeBranding: true,
    leadForms: true,
    analyticsRetentionDays: 365,
  },
  business: {
    publishedDemos: null,
    members: 25,
    stepsPerDemo: null,
    removeBranding: true,
    leadForms: true,
    analyticsRetentionDays: 730,
  },
  enterprise: {
    publishedDemos: null,
    members: null,
    stepsPerDemo: null,
    removeBranding: true,
    leadForms: true,
    analyticsRetentionDays: 1095,
  },
};

export function withinLimit(limit: number | null | undefined, current: number): boolean {
  return limit === null || limit === undefined || current < limit;
}
