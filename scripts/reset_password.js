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
  const prisma = new PrismaClient();
  const newHash = await hashPassword('Admin@123456');
  await prisma.user.update({
    where: { id: 'cmsh4r052006dnv1pzyal5wcu' },
    data: { passwordHash: newHash }
  });
  console.log('PASSWORD RESET SUCCESS');
  console.log('Email: admin@bandhan.com');
  console.log('New Password: Admin@123456');
}

main();
