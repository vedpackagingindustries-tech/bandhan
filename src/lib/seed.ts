import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const ROLES = [
  { name: 'SUPER_ADMIN', displayName: 'Super Admin', level: 6, description: 'Full system access' },
  { name: 'ADMIN', displayName: 'Admin', level: 5, description: 'Administrative access' },
  { name: 'MODERATOR', displayName: 'Moderator', level: 4, description: 'Content moderation' },
  { name: 'FREE_USER', displayName: 'Free User', level: 3, description: 'Basic access' },
  { name: 'PREMIUM_USER', displayName: 'Premium User', level: 2, description: 'Premium features' },
  { name: 'ELITE_USER', displayName: 'Elite User', level: 1, description: 'All features' },
]

const PERMISSIONS = [
  { name: 'users.read', module: 'users', description: 'View user profiles and listings' },
  { name: 'users.create', module: 'users', description: 'Create new users' },
  { name: 'users.update', module: 'users', description: 'Update user information' },
  { name: 'users.delete', module: 'users', description: 'Delete users' },
  { name: 'users.approve', module: 'users', description: 'Approve pending users' },
  { name: 'users.reject', module: 'users', description: 'Reject users' },
  { name: 'users.block', module: 'users', description: 'Block/unblock users' },
  { name: 'admin.dashboard', module: 'admin', description: 'Access admin dashboard' },
  { name: 'admin.settings', module: 'admin', description: 'Modify system settings' },
  { name: 'admin.roles', module: 'admin', description: 'Manage roles and permissions' },
  { name: 'admin.audit', module: 'admin', description: 'View audit logs' },
  { name: 'admin.security', module: 'admin', description: 'View security events' },
  { name: 'content.advertisements', module: 'content', description: 'Manage advertisements' },
  { name: 'content.notifications', module: 'content', description: 'Send system notifications' },
  { name: 'matrimony.profiles', module: 'matrimony', description: 'View matrimony profiles' },
  { name: 'matrimony.contact', module: 'matrimony', description: 'Send contact requests' },
  { name: 'matrimony.search', module: 'matrimony', description: 'Advanced search' },
  { name: 'business.listings', module: 'business', description: 'Manage business listings' },
  { name: 'business.search', module: 'business', description: 'Search businesses' },
  { name: 'jobs.post', module: 'jobs', description: 'Post job listings' },
  { name: 'jobs.apply', module: 'jobs', description: 'Apply to jobs' },
  { name: 'jobs.search', module: 'jobs', description: 'Search jobs' },
  { name: 'directory.organizations', module: 'directory', description: 'Manage organizations' },
  { name: 'directory.search', module: 'directory', description: 'Search directory' },
  { name: 'membership.view', module: 'membership', description: 'View membership details' },
  { name: 'membership.manage', module: 'membership', description: 'Manage memberships' },
  { name: 'membership.upgrade', module: 'membership', description: 'Upgrade membership' },
  { name: 'media.upload', module: 'media', description: 'Upload media files' },
  { name: 'media.delete', module: 'media', description: 'Delete media files' },
  { name: 'profile.view', module: 'profile', description: 'View own profile' },
  { name: 'profile.edit', module: 'profile', description: 'Edit own profile' },
  { name: 'profile.privacy', module: 'profile', description: 'Manage privacy settings' },
]

// Permission mapping per role
const ROLE_PERMS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map(p => p.name),
  ADMIN: [
    'users.read', 'users.approve', 'users.reject', 'users.block', 'users.update',
    'admin.dashboard', 'admin.audit', 'admin.security',
    'content.advertisements', 'content.notifications',
    'membership.view', 'membership.manage',
    'profile.view', 'profile.edit',
  ],
  MODERATOR: [
    'users.read', 'users.approve',
    'admin.dashboard',
    'content.advertisements',
    'profile.view', 'profile.edit',
  ],
  FREE_USER: [
    'profile.view', 'profile.edit', 'profile.privacy',
    'matrimony.profiles', 'matrimony.search',
    'business.search', 'jobs.search', 'jobs.apply',
    'directory.search', 'media.upload', 'membership.view',
  ],
  PREMIUM_USER: [
    'profile.view', 'profile.edit', 'profile.privacy',
    'matrimony.profiles', 'matrimony.contact', 'matrimony.search',
    'business.search', 'business.listings',
    'jobs.search', 'jobs.apply', 'jobs.post',
    'directory.search', 'media.upload', 'membership.view', 'membership.upgrade',
  ],
  ELITE_USER: [
    'profile.view', 'profile.edit', 'profile.privacy',
    'matrimony.profiles', 'matrimony.contact', 'matrimony.search',
    'business.search', 'business.listings',
    'jobs.search', 'jobs.apply', 'jobs.post',
    'directory.search', 'directory.organizations',
    'media.upload', 'media.delete',
    'membership.view', 'membership.upgrade',
  ],
}

export async function seedDatabase() {
  console.log('Seeding database...')

  // 1. Create roles
  for (const role of ROLES) {
    await db.role.upsert({
      where: { name: role.name },
      update: { displayName: role.displayName, level: role.level, description: role.description },
      create: role,
    })
  }
  console.log('  Roles created:', ROLES.length)

  // 2. Create permissions
  for (const perm of PERMISSIONS) {
    await db.permission.upsert({
      where: { name: perm.name },
      update: { module: perm.module, description: perm.description },
      create: perm,
    })
  }
  console.log('  Permissions created:', PERMISSIONS.length)

  // 3. Assign permissions to roles
  for (const [roleName, permNames] of Object.entries(ROLE_PERMS)) {
    const role = await db.role.findUnique({ where: { name: roleName } })
    if (!role) continue

    // Clear existing
    await db.rolePermission.deleteMany({ where: { roleId: role.id } })

    for (const permName of permNames) {
      const perm = await db.permission.findUnique({ where: { name: permName } })
      if (perm) {
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        })
      }
    }
  }
  console.log('  Role permissions assigned')

  // 4. Create Super Admin user
  const superAdminRole = await db.role.findUnique({ where: { name: 'SUPER_ADMIN' } })
  const existingAdmin = await db.user.findFirst({
    where: { role: { name: 'SUPER_ADMIN' } },
  })

  if (!existingAdmin && superAdminRole) {
    const passwordHash = await hashPassword('Admin@123')
    const admin = await db.user.create({
      data: {
        email: 'admin@bandhan.com',
        phone: '+919999999999',
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
        membershipTier: 'ELITE',
        registrationCategory: 'GENERAL',
        roleId: superAdminRole.id,
        acceptedTerms: true,
      },
    })

    await db.profile.create({
      data: {
        userId: admin.id,
        firstName: 'Super',
        lastName: 'Admin',
        displayName: 'Super Admin',
        gender: 'MALE',
      },
    })

    console.log('  Super Admin created: admin@bandhan.com / Admin@123')
  } else {
    console.log('  Super Admin already exists')
  }

  console.log('Database seeded successfully!')
}

// Run directly
seedDatabase().catch(console.error)
