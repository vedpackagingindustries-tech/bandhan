const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, phone: true, status: true, role: { select: { name: true, displayName: true } } }
  });
  const admins = users.filter(u => u.role && (u.role.name === 'SUPER_ADMIN' || u.role.name === 'ADMIN'));
  console.log(JSON.stringify(admins, null, 2));
  prisma.disconnect();
}
main();
