import { PLAN_DEFAULTS, type PlanCode } from '@flowdsiml/core';
import { useWorkspace } from '../workspace/WorkspaceProvider';

/** Limites du plan du workspace courant (miroir de public.plans.limits). */
export function usePlan() {
  const { current } = useWorkspace();
  return PLAN_DEFAULTS[(current?.plan_code ?? 'free') as PlanCode] ?? PLAN_DEFAULTS.free;
}
