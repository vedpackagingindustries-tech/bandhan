const { PrismaClient } = require('@prisma/client');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return salt + ':' + derivedKey.toString('hex');
}

async function seed() {
  const db = new PrismaClient();
  const roles = [
    { name: 'SUPER_ADMIN', displayName: 'Super Admin', level: 6, description: 'Full system access' },
    { name: 'ADMIN', displayName: 'Admin', level: 5, description: 'Administrative access' },
    { name: 'MODERATOR', displayName: 'Moderator', level: 4, description: 'Content moderation' },
    { name: 'FREE_USER', displayName: 'Free User', level: 3, description: 'Basic access' },
    { name: 'PREMIUM_USER', displayName: 'Premium User', level: 2, description: 'Premium features' },
    { name: 'ELITE_USER', displayName: 'Elite User', level: 1, description: 'All features' },
  ];
  const permissions = [
    { name: 'users.read', module: 'users', description: 'View user profiles' },
    { name: 'users.approve', module: 'users', description: 'Approve pending users' },
    { name: 'users.reject', module: 'users', description: 'Reject users' },
    { name: 'users.block', module: 'users', description: 'Block/unblock users' },
    { name: 'users.update', module: 'users', description: 'Update user info' },
    { name: 'admin.dashboard', module: 'admin', description: 'Access admin dashboard' },
    { name: 'admin.settings', module: 'admin', description: 'Modify system settings' },
    { name: 'admin.roles', module: 'admin', description: 'Manage roles' },
    { name: 'admin.audit', module: 'admin', description: 'View audit logs' },
    { name: 'admin.security', module: 'admin', description: 'View security events' },
    { name: 'content.advertisements', module: 'content', description: 'Manage ads' },
    { name: 'content.notifications', module: 'content', description: 'Send notifications' },
    { name: 'matrimony.profiles', module: 'matrimony', description: 'View matrimony profiles' },
    { name: 'matrimony.contact', module: 'matrimony', description: 'Send contact requests' },
    { name: 'matrimony.search', module: 'matrimony', description: 'Advanced search' },
    { name: 'business.listings', module: 'business', description: 'Manage businesses' },
    { name: 'business.search', module: 'business', description: 'Search businesses' },
    { name: 'jobs.post', module: 'jobs', description: 'Post jobs' },
    { name: 'jobs.apply', module: 'jobs', description: 'Apply to jobs' },
    { name: 'jobs.search', module: 'jobs', description: 'Search jobs' },
    { name: 'directory.organizations', module: 'directory', description: 'Manage organizations' },
    { name: 'directory.search', module: 'directory', description: 'Search directory' },
    { name: 'membership.view', module: 'membership', description: 'View membership' },
    { name: 'membership.manage', module: 'membership', description: 'Manage memberships' },
    { name: 'membership.upgrade', module: 'membership', description: 'Upgrade membership' },
    { name: 'media.upload', module: 'media', description: 'Upload media' },
    { name: 'media.delete', module: 'media', description: 'Delete media' },
    { name: 'profile.view', module: 'profile', description: 'View profile' },
    { name: 'profile.edit', module: 'profile', description: 'Edit profile' },
    { name: 'profile.privacy', module: 'profile', description: 'Manage privacy' },
  ];
  const rolePerms = {
    SUPER_ADMIN: permissions.map(function(p){return p.name}),
    ADMIN: ['users.read','users.approve','users.reject','users.block','users.update','admin.dashboard','admin.audit','admin.security','content.advertisements','content.notifications','membership.view','membership.manage','profile.view','profile.edit'],
    MODERATOR: ['users.read','users.approve','admin.dashboard','content.advertisements','profile.view','profile.edit'],
    FREE_USER: ['profile.view','profile.edit','profile.privacy','matrimony.profiles','matrimony.search','business.search','jobs.search','jobs.apply','directory.search','media.upload','membership.view'],
    PREMIUM_USER: ['profile.view','profile.edit','profile.privacy','matrimony.profiles','matrimony.contact','matrimony.search','business.search','business.listings','jobs.search','jobs.apply','jobs.post','directory.search','media.upload','membership.view','membership.upgrade'],
    ELITE_USER: ['profile.view','profile.edit','profile.privacy','matrimony.profiles','matrimony.contact','matrimony.search','business.search','business.listings','jobs.search','jobs.apply','jobs.post','directory.search','directory.organizations','media.upload','media.delete','membership.view','membership.upgrade'],
  };

  for (var i = 0; i < roles.length; i++) {
    var r = roles[i];
    await db.role.upsert({ where:{name:r.name}, update:{displayName:r.displayName,level:r.level,description:r.description}, create:r });
  }
  console.log('Roles:', roles.length);

  for (var j = 0; j < permissions.length; j++) {
    var p = permissions[j];
    await db.permission.upsert({ where:{name:p.name}, update:{module:p.module,description:p.description}, create:p });
  }
  console.log('Permissions:', permissions.length);

  var roleKeys = Object.keys(rolePerms);
  for (var k = 0; k < roleKeys.length; k++) {
    var rn = roleKeys[k];
    var pns = rolePerms[rn];
    var role = await db.role.findUnique({where:{name:rn}});
    if (!role) continue;
    await db.rolePermission.deleteMany({where:{roleId:role.id}});
    for (var m = 0; m < pns.length; m++) {
      var perm = await db.permission.findUnique({where:{name:pns[m]}});
      if (perm) await db.rolePermission.create({data:{roleId:role.id,permissionId:perm.id}});
    }
  }
  console.log('Permissions assigned');

  var saRole = await db.role.findUnique({where:{name:'SUPER_ADMIN'}});
  var existing = await db.user.findFirst({where:{role:{name:'SUPER_ADMIN'}}});
  if (!existing && saRole) {
    // ✅ SECURE: Generate random password — NO hardcoded credentials
    var tempPassword = randomBytes(12).toString('base64url').slice(0, 16) + '@A1';
    var hash = await hashPassword(tempPassword);
    var admin = await db.user.create({
      data: { email:'admin@bandhan.com', phone:'+919999999999', passwordHash:hash, status:'ACTIVE', emailVerified:true, phoneVerified:true, membershipTier:'ELITE', registrationCategory:'GENERAL', roleId:saRole.id, acceptedTerms:true, mustChangePassword:true }
    });
    await db.profile.create({ data:{ userId:admin.id, firstName:'Super', lastName:'Admin', displayName:'Super Admin', gender:'MALE' } });
    // Print credentials ONCE — admin must change immediately
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║  SUPER ADMIN CREATED — CHANGE PASSWORD IMMEDIATELY   ║');
    console.log('  ╠══════════════════════════════════════════════════════╣');
    console.log('  ║  Email:    admin@bandhan.com                          ║');
    console.log('  ║  Password: ' + tempPassword.padEnd(43) + '║');
    console.log('  ║  ⚠️  This password is shown ONCE. Change it now!      ║');
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log('');
  } else {
    console.log('Super Admin already exists');
  }
  console.log('Seed complete!');
  await db.$disconnect();
}
seed().catch(function(e){console.error(e);process.exit(1)});
