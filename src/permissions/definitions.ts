export const ROLES = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
  READ_ONLY: 'READ_ONLY',
} as const;

export type Role = keyof typeof ROLES;

export function isSystemOperator(user: { role?: string } | null | undefined): boolean {
  if (!user || !user.role) return false;
  return user.role === 'SYSTEM_ADMIN' || user.role === 'SUPER_ADMIN';
}


export const PERMISSIONS = {
  // Lead permissions
  LEAD_READ: 'lead:read',
  LEAD_CREATE: 'lead:create',
  LEAD_UPDATE: 'lead:update',
  LEAD_DELETE: 'lead:delete',
  LEAD_BULK_DELETE: 'lead:bulk_delete',

  // Discovery permissions
  DISCOVERY_READ: 'discovery:read',
  DISCOVERY_CREATE: 'discovery:create',

  // Billing permissions
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',

  // Integration permissions
  INTEGRATION_READ: 'integration:read',
  INTEGRATION_CONFIGURE: 'integration:configure',

  // AI permissions
  AI_CHAT: 'ai:chat',
  AI_ACTION_LOW_RISK: 'ai:action:low_risk',
  AI_ACTION_SENSITIVE: 'ai:action:sensitive',

  // User management
  USERS_MANAGE: 'users:manage',

  // Auditing
  AUDIT_READ: 'audit:read',

  // Organization settings
  ORG_SETTINGS: 'org:settings',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Map roles to their allowed permissions
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.SYSTEM_ADMIN]: Object.values(PERMISSIONS), // System admin has full cross-system access
  [ROLES.OWNER]: Object.values(PERMISSIONS), // Owner has all permissions
  [ROLES.ADMIN]: [
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.LEAD_DELETE,
    PERMISSIONS.LEAD_BULK_DELETE,
    PERMISSIONS.DISCOVERY_READ,
    PERMISSIONS.DISCOVERY_CREATE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_MANAGE,
    PERMISSIONS.INTEGRATION_READ,
    PERMISSIONS.INTEGRATION_CONFIGURE,
    PERMISSIONS.AI_CHAT,
    PERMISSIONS.AI_ACTION_LOW_RISK,
    PERMISSIONS.AI_ACTION_SENSITIVE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.AUDIT_READ,
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.LEAD_DELETE,
    PERMISSIONS.DISCOVERY_READ,
    PERMISSIONS.DISCOVERY_CREATE,
    PERMISSIONS.INTEGRATION_READ,
    PERMISSIONS.AI_CHAT,
    PERMISSIONS.AI_ACTION_LOW_RISK,
  ],
  [ROLES.MEMBER]: [
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.DISCOVERY_READ,
    PERMISSIONS.AI_CHAT,
  ],
  [ROLES.READ_ONLY]: [
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.DISCOVERY_READ,
    PERMISSIONS.AI_CHAT,
  ],
};
