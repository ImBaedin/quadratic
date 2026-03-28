export const roleOrder = {
  member: 1,
  admin: 2,
  owner: 3,
} as const;

export type WorkspaceRole = keyof typeof roleOrder;

export function hasRequiredRole(currentRole: WorkspaceRole, requiredRole: WorkspaceRole) {
  return roleOrder[currentRole] >= roleOrder[requiredRole];
}
