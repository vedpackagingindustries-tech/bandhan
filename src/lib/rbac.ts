// ═══════════════════════════════════════════════════════════
// ROLE BASED ACCESS CONTROL
// ═══════════════════════════════════════════════════════════

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  FREE_USER: 'FREE_USER',
  PREMIUM_USER: 'PREMIUM_USER',
  ELITE_USER: 'ELITE_USER',
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

// Role hierarchy levels
export const ROLE_LEVELS: Record<RoleName, number> = {
  [ROLES.ELITE_USER]: 1,
  [ROLES.PREMIUM_USER]: 2,
  [ROLES.FREE_USER]: 3,
  [ROLES.MODERATOR]: 4,
  [ROLES.ADMIN]: 5,
  [ROLES.SUPER_ADMIN]: 6,
}

// Permission definitions per module
export const PERMISSIONS = {
  // User management
  'users.read': 'View user profiles and listings',
  'users.create': 'Create new users',
  'users.update': 'Update user information',
  'users.delete': 'Delete users',
  'users.approve': 'Approve pending users',
  'users.reject': 'Reject users',
  'users.block': 'Block/unblock users',

  // Admin operations
  'admin.dashboard': 'Access admin dashboard',
  'admin.settings': 'Modify system settings',
  'admin.roles': 'Manage roles and permissions',
  'admin.audit': 'View audit logs',
  'admin.security': 'View security events',

  // Content management
  'content.advertisements': 'Manage advertisements',
  'content.notifications': 'Send system notifications',

  // Matrimony
  'matrimony.profiles': 'View matrimony profiles',
  'matrimony.contact': 'Send contact requests',
  'matrimony.search': 'Advanced search',

  // Business
  'business.listings': 'Manage business listings',
  'business.search': 'Search businesses',

  // Jobs
  'jobs.post': 'Post job listings',
  'jobs.apply': 'Apply to jobs',
  'jobs.search': 'Search jobs',

  // Directory
  'directory.organizations': 'Manage organizations',
  'directory.search': 'Search directory',

  // Membership
  'membership.view': 'View membership details',
  'membership.manage': 'Manage memberships',
  'membership.upgrade': 'Upgrade membership',

  // Media
  'media.upload': 'Upload media files',
  'media.delete': 'Delete media files',

  // Profile
  'profile.view': 'View own profile',
  'profile.edit': 'Edit own profile',
  'profile.privacy': 'Manage privacy settings',
} as const

export type PermissionName = keyof typeof PERMISSIONS

// Default permissions per role
export const ROLE_PERMISSIONS: Partial<Record<RoleName, PermissionName[]>> = {
  [ROLES.SUPER_ADMIN]: Object.keys(PERMISSIONS) as PermissionName[],
  [ROLES.ADMIN]: [
    'users.read', 'users.approve', 'users.reject', 'users.block', 'users.update',
    'admin.dashboard', 'admin.audit', 'admin.security',
    'content.advertisements', 'content.notifications',
    'membership.view', 'membership.manage',
    'profile.view', 'profile.edit',
  ],
  [ROLES.MODERATOR]: [
    'users.read', 'users.approve',
    'admin.dashboard',
    'content.advertisements',
    'profile.view', 'profile.edit',
  ],
  [ROLES.FREE_USER]: [
    'profile.view', 'profile.edit', 'profile.privacy',
    'matrimony.profiles', 'matrimony.search',
    'business.search', 'jobs.search', 'jobs.apply',
    'directory.search',
    'media.upload', 'membership.view',
  ],
  [ROLES.PREMIUM_USER]: [
    'profile.view', 'profile.edit', 'profile.privacy',
    'matrimony.profiles', 'matrimony.contact', 'matrimony.search',
    'business.search', 'business.listings',
    'jobs.search', 'jobs.apply', 'jobs.post',
    'directory.search',
    'media.upload', 'membership.view', 'membership.upgrade',
  ],
  [ROLES.ELITE_USER]: [
    'profile.view', 'profile.edit', 'profile.privacy',
    'matrimony.profiles', 'matrimony.contact', 'matrimony.search',
    'business.search', 'business.listings',
    'jobs.search', 'jobs.apply', 'jobs.post',
    'directory.search', 'directory.organizations',
    'media.upload', 'media.delete',
    'membership.view', 'membership.upgrade',
  ],
}

// Check if a role has a specific permission
export function hasPermission(roleName: string | null | undefined, permission: PermissionName): boolean {
  if (!roleName) return false
  const perms = ROLE_PERMISSIONS[roleName as RoleName]
  return perms ? perms.includes(permission) : false
}

// Check if a role meets minimum level requirement
export function hasMinRoleLevel(roleName: string | null | undefined, minLevel: number): boolean {
  if (!roleName) return false
  return (ROLE_LEVELS[roleName as RoleName] ?? 0) >= minLevel
}

// Check if role is at least admin level
export function isAdmin(roleName: string | null | undefined): boolean {
  return hasMinRoleLevel(roleName, ROLE_LEVELS[ROLES.ADMIN])
}

// Check if role is super admin
export function isSuperAdmin(roleName: string | null | undefined): boolean {
  return roleName === ROLES.SUPER_ADMIN
}
