import { Role, Permission, ROLE_PERMISSIONS, ROLES } from './definitions';

/**
 * Checks if a user has a specific permission based on their role.
 */
export function hasPermission(userRole: string | undefined | null, permission: Permission): boolean {
  if (!userRole) return false;

  // Fallback to MEMBER if role is not recognized
  const normalizedRole = (Object.values(ROLES).includes(userRole as any)
    ? userRole
    : ROLES.MEMBER) as Role;

  const allowedPermissions = ROLE_PERMISSIONS[normalizedRole];
  return allowedPermissions.includes(permission);
}

/**
 * Asserts that a user has a specific permission, throws an error otherwise.
 */
export function requirePermission(userRole: string | undefined | null, permission: Permission): void {
  if (!hasPermission(userRole, permission)) {
    throw new Error(`Permission denied: Missing required permission '${permission}'`);
  }
}
