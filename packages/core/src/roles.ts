export const ROLES = ['viewer', 'editor', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export type Action =
  | 'demo.view'
  | 'demo.edit'
  | 'demo.publish'
  | 'demo.delete'
  | 'analytics.view'
  | 'leads.view'
  | 'members.invite'
  | 'members.manage'
  | 'workspace.settings'
  | 'integrations.manage'
  | 'workspace.delete'
  | 'billing.manage';

/** Rôle minimal requis par action — miroir de la fonction SQL public.has_role(). */
const MIN_ROLE: Record<Action, Role> = {
  'demo.view': 'viewer',
  'analytics.view': 'viewer',
  'leads.view': 'editor',
  'demo.edit': 'editor',
  'demo.publish': 'editor',
  'demo.delete': 'editor',
  'members.invite': 'admin',
  'members.manage': 'admin',
  'workspace.settings': 'admin',
  // L23 : webhooks (adresses et secrets) réservés aux propriétaires et admins
  'integrations.manage': 'admin',
  'billing.manage': 'owner',
  'workspace.delete': 'owner',
};

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

export function can(role: Role | null | undefined, action: Action): boolean {
  if (!role) return false;
  return roleRank(role) >= roleRank(MIN_ROLE[action]);
}

/** Un admin ne peut attribuer que des rôles inférieurs ou égaux au sien, jamais owner. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === 'owner') return ['viewer', 'editor', 'admin', 'owner'];
  if (actor === 'admin') return ['viewer', 'editor', 'admin'];
  return [];
}
