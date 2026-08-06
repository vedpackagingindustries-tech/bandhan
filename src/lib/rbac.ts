// ═══════════════════════════════════════════════════════════
// DYNAMIC ROLE BASED ACCESS CONTROL
// Permissions loaded from PostgreSQL, cached in memory.
// Role changes by Super Admin take effect immediately via
// cache invalidation.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  FREE_USER: 'FREE_USER',
  PREMIUM_USER: 'PREMIUM_USER',
  ELITE_USER: 'ELITE_USER',
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

// Permission definitions (static catalog — the canonical list of
// permission names that can be assigned. Actual assignments are
// stored in the database via RolePermission junction table.)
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

// ═══════════════════════════════════════════════════════════
// DYNAMIC PERMISSION CACHE
// ═══════════════════════════════════════════════════════════

interface CachedRoleData {
  name: string
  level: number
  permissions: Set<string>
  loadedAt: number
}

const roleCache = new Map<string, CachedRoleData>()
const CACHE_TTL_MS = 60 * 1000 // 1 minute — short TTL for near-real-time updates

/**
 * Load a single role's permissions from the database.
 * Populates the in-memory cache.
 */
async function loadRolePermissions(roleName: string): Promise<CachedRoleData | null> {
  try {
    const role = await db.role.findUnique({
      where: { name: roleName },
      include: {
        permissions: {
          include: { permission: { select: { name: true } } },
        },
      },
    })

    if (!role) return null

    const permSet = new Set(role.permissions.map((rp) => rp.permission.name))
    const cached: CachedRoleData = {
      name: role.name,
      level: role.level,
      permissions: permSet,
      loadedAt: Date.now(),
    }

    roleCache.set(roleName, cached)
    return cached
  } catch (err) {
    console.error(`[RBAC] Failed to load permissions for role ${roleName}:`, err)
    return null
  }
}

/**
 * Get cached role data. Loads from DB if not cached or expired.
 */
async function getRoleData(roleName: string): Promise<CachedRoleData | null> {
  const cached = roleCache.get(roleName)
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached
  }
  return loadRolePermissions(roleName)
}

/**
 * Invalidate the permission cache for a specific role.
 * Call this when Super Admin changes role permissions.
 */
export async function invalidateRoleCache(roleName?: string): Promise<void> {
  if (roleName) {
    roleCache.delete(roleName)
    console.log(`[RBAC] Cache invalidated for role: ${roleName}`)
  } else {
    roleCache.clear()
    console.log('[RBAC] All role caches invalidated')
  }
}

/**
 * Preload all roles into cache. Call on server startup.
 */
export async function preloadAllRoles(): Promise<void> {
  try {
    const roles = await db.role.findMany({
      include: {
        permissions: {
          include: { permission: { select: { name: true } } },
        },
      },
      })

    for (const role of roles) {
      const permSet = new Set(role.permissions.map((rp) => rp.permission.name))
      roleCache.set(role.name, {
        name: role.name,
        level: role.level,
        permissions: permSet,
        loadedAt: Date.now(),
      })
    }

    console.log(`[RBAC] Preloaded ${roles.length} roles into cache`)
  } catch (err) {
    console.error('[RBAC] Failed to preload roles:', err)
  }
}

// ═══════════════════════════════════════════════════════════
// PERMISSION CHECK FUNCTIONS (database-driven)
// ═══════════════════════════════════════════════════════════

/**
 * Check if a role has a specific permission.
 * Loads from database if cache miss.
 */
export async function hasPermission(roleName: string | null | undefined, permission: string): Promise<boolean> {
  if (!roleName) return false

  const roleData = await getRoleData(roleName)
  if (!roleData) return false

  return roleData.permissions.has(permission)
}

/**
 * Check if a role has ALL specified permissions.
 */
export async function hasAllPermissions(roleName: string | null | undefined, permissions: string[]): Promise<boolean> {
  if (!roleName) return false
  const roleData = await getRoleData(roleName)
  if (!roleData) return false
  return permissions.every((p) => roleData.permissions.has(p))
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export async function hasAnyPermission(roleName: string | null | undefined, permissions: string[]): Promise<boolean> {
  if (!roleName) return false
  const roleData = await getRoleData(roleName)
  if (!roleData) return false
  return permissions.some((p) => roleData.permissions.has(p))
}

/**
 * Get all permissions for a role (from database).
 */
export async function getRolePermissions(roleName: string): Promise<string[]> {
  const roleData = await getRoleData(roleName)
  if (!roleData) return []
  return Array.from(roleData.permissions)
}

/**
 * Check if a role meets minimum level requirement (from database).
 */
export async function hasMinRoleLevel(roleName: string | null | undefined, minLevel: number): Promise<boolean> {
  if (!roleName) return false
  const roleData = await getRoleData(roleName)
  if (!roleData) return false
  return roleData.level >= minLevel
}

// ═══════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════

const ADMIN_MIN_LEVEL = 5

/**
 * Check if role is at least admin level (database-driven).
 */
export async function isAdmin(roleName: string | null | undefined): Promise<boolean> {
  return hasMinRoleLevel(roleName, ADMIN_MIN_LEVEL)
}

/**
 * Check if role is super admin (database-driven).
 */
export async function isSuperAdmin(roleName: string | null | undefined): Promise<boolean> {
  if (!roleName) return false
  return roleName === ROLES.SUPER_ADMIN
}

/**
 * Get all roles with their levels from the database.
 */
export async function getAllRoles() {
  const roles = await db.role.findMany({
    orderBy: { level: 'desc' },
  })
  return roles
}

/**
 * Get role level from the database.
 */
export async function getRoleLevel(roleName: string): Promise<number> {
  const roleData = await getRoleData(roleName)
  return roleData?.level ?? 0
}
