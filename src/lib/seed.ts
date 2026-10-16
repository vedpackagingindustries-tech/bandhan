import { db } from '@/lib/db'
import { hashPassword, generateToken } from '@/lib/auth'
import { randomBytes } from 'crypto'

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
    // Generate a secure random password — NOT hardcoded
    // The admin must change this on first login (mustChangePassword = true)
    const tempPassword = randomBytes(12).toString('base64url').slice(0, 16) + '@A1'
    const passwordHash = await hashPassword(tempPassword)
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
        mustChangePassword: true, // Force password change on first login
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

    // Print temp credentials ONCE — admin must change immediately
    console.log('  ╔══════════════════════════════════════════════════════╗')
    console.log('  ║  SUPER ADMIN CREATED — CHANGE PASSWORD IMMEDIATELY   ║')
    console.log('  ╠══════════════════════════════════════════════════════╣')
    console.log(`  ║  Email:    admin@bandhan.com                          ║`)
    console.log(`  ║  Password: ${tempPassword.padEnd(43)}║`)
    console.log('  ║  ⚠️  This password is shown ONCE. Change it now!      ║')
    console.log('  ╚══════════════════════════════════════════════════════╝')
  } else {
    console.log('  Super Admin already exists')
  }

  console.log('Database seeded successfully!')

  // 5. Seed membership plans
  const plans = [
    {
      name: 'FREE',
      displayName: 'Free Plan',
      description: 'Basic access with limited features',
      price: 0,
      durationDays: 365,
      features: JSON.stringify(['View profiles', 'Basic search', '5 profile photos', '10 contacts/month']),
      maxContacts: 10,
      maxPhotos: 5,
      priorityListing: false,
      sortOrder: 0,
    },
    {
      name: 'PREMIUM',
      displayName: 'Premium Plan',
      description: 'Enhanced features for serious members',
      price: 999,
      durationDays: 30,
      features: JSON.stringify(['All Free features', 'Contact details view', 'Advanced search', '25 profile photos', '100 contacts/month', 'Priority listing', 'AI recommendations']),
      maxContacts: 100,
      maxPhotos: 25,
      priorityListing: true,
      sortOrder: 1,
    },
    {
      name: 'ELITE',
      displayName: 'Elite Plan',
      description: 'Unlimited access with all premium features',
      price: 2499,
      durationDays: 30,
      features: JSON.stringify(['All Premium features', 'Unlimited contacts', '50 profile photos', 'AI match scoring', 'Astrology matching', 'Dedicated support', 'Featured profile']),
      maxContacts: 999999,
      maxPhotos: 50,
      priorityListing: true,
      sortOrder: 2,
    },
  ]

  for (const plan of plans) {
    await db.membershipPlan.upsert({
      where: { name: plan.name },
      update: { displayName: plan.displayName, description: plan.description, price: plan.price, durationDays: plan.durationDays, features: plan.features, maxContacts: plan.maxContacts, maxPhotos: plan.maxPhotos, priorityListing: plan.priorityListing, sortOrder: plan.sortOrder },
      create: plan,
    })
  }
  console.log('  Membership plans created:', plans.length)

  // 6. Seed system configuration
  const configs = [
    { key: 'site_name', value: '"Bandhan"', description: 'Platform name', category: 'GENERAL', isPublic: true },
    { key: 'site_description', value: '"Bandhan – Sahu Samaj Connects"', description: 'Platform description', category: 'GENERAL', isPublic: true },
    { key: 'max_login_attempts', value: '5', description: 'Maximum failed login attempts before lockout', category: 'SECURITY', isPublic: false },
    { key: 'lockout_duration_minutes', value: '30', description: 'Account lockout duration in minutes', category: 'SECURITY', isPublic: false },
    { key: 'otp_expiry_minutes', value: '10', description: 'OTP validity duration', category: 'SECURITY', isPublic: false },
    { key: 'otp_max_attempts', value: '5', description: 'Maximum OTP verification attempts', category: 'SECURITY', isPublic: false },
    { key: 'session_duration_days', value: '30', description: 'Session token validity', category: 'SECURITY', isPublic: false },
    { key: 'ai_approval_wait_hours', value: '2', description: 'Hours to wait before AI auto-approval check', category: 'AI', isPublic: false },
    { key: 'ai_approval_enabled', value: 'false', description: 'Enable AI auto-approval pipeline', category: 'AI', isPublic: false },
    { key: 'max_profile_photos', value: '5', description: 'Default max profile photos for free users', category: 'MEMBERSHIP', isPublic: true },
  ]

  for (const config of configs) {
    await db.systemConfiguration.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description, category: config.category, isPublic: config.isPublic },
      create: config,
    })
  }
  console.log('  System configurations created:', configs.length)

  // 7. Seed scheduled tasks
  const tasks = [
    { name: 'AD_EXPIRY', type: 'AD_EXPIRY', intervalMinutes: 60, isEnabled: true, metadata: JSON.stringify({ description: 'Expire completed ad campaigns' }) },
    { name: 'JOB_EXPIRY', type: 'JOB_EXPIRY', intervalMinutes: 60, isEnabled: true, metadata: JSON.stringify({ description: 'Expire jobs past their end date' }) },
    { name: 'MEMBERSHIP_EXPIRY', type: 'MEMBERSHIP_EXPIRY', intervalMinutes: 60, isEnabled: true, metadata: JSON.stringify({ description: 'Downgrade expired memberships' }) },
    { name: 'SESSION_CLEANUP', type: 'SESSION_CLEANUP', intervalMinutes: 30, isEnabled: true, metadata: JSON.stringify({ description: 'Remove expired user sessions' }) },
    { name: 'BACKUP', type: 'BACKUP', intervalMinutes: 1440, isEnabled: true, metadata: JSON.stringify({ description: 'Daily database backup', retentionDays: 30 }) },
    { name: 'HEALTH_CHECK', type: 'HEALTH_CHECK', intervalMinutes: 5, isEnabled: true, metadata: JSON.stringify({ description: 'System health monitoring' }) },
    { name: 'NOTIFICATION_RETRY', type: 'NOTIFICATION_RETRY', intervalMinutes: 15, isEnabled: false, metadata: JSON.stringify({ description: 'Retry failed notification deliveries' }) },
    { name: 'AI_PROVIDER_CHECK', type: 'AI_PROVIDER_CHECK', intervalMinutes: 10, isEnabled: true, metadata: JSON.stringify({ description: 'Check AI provider health' }) },
    { name: 'FEATURED_CONTENT_EXPIRY', type: 'AD_EXPIRY', intervalMinutes: 60, isEnabled: true, metadata: JSON.stringify({ description: 'Remove expired featured content' }) },
  ]

  for (const task of tasks) {
    const nextRun = new Date(Date.now() + task.intervalMinutes * 60 * 1000)
    await db.scheduledTask.upsert({
      where: { name: task.name },
      update: { type: task.type, intervalMinutes: task.intervalMinutes, isEnabled: task.isEnabled, metadata: task.metadata, nextRunAt: nextRun },
      create: { ...task, nextRunAt: nextRun },
    })
  }
  console.log('  Scheduled tasks created:', tasks.length)
}

// Run directly
seedDatabase().catch(console.error)
