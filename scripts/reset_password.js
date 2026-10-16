// ═══════════════════════════════════════════════════════════
// RESET PASSWORD — Secure version
// Usage: node scripts/reset_password.js <email_or_phone>
// Generates a random temporary password and sets mustChangePassword=true
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64));
  return salt + ':' + derivedKey.toString('hex');
}

async function main() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('Usage: node scripts/reset_password.js <email_or_phone>');
    console.error('Example: node scripts/reset_password.js admin@bandhan.com');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier }
      ]
    }
  });

  if (!user) {
    console.error('User not found:', identifier);
    process.exit(1);
  }

  // ✅ SECURE: Generate random temporary password
  const tempPassword = randomBytes(12).toString('base64url').slice(0, 16) + '@A1';
  const newHash = await hashPassword(tempPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    }
  });

  // Invalidate all sessions
  await prisma.userSession.deleteMany({
    where: { userId: user.id }
  });

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║  PASSWORD RESET — CHANGE IMMEDIATELY ON LOGIN        ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║  User:     ' + (user.email || user.phone).padEnd(43) + '║');
  console.log('  ║  Password: ' + tempPassword.padEnd(43) + '║');
  console.log('  ║  ⚠️  mustChangePassword = true                         ║');
  console.log('  ║  ⚠️  All existing sessions invalidated                ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');

  await prisma.$disconnect();
}

main().catch(function(e) { console.error(e); process.exit(1); });
