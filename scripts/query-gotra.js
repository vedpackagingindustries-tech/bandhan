const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // Step 1: Get all tables
  const tables = await db.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
  console.log('=== ALL TABLES ===');
  tables.forEach(t => console.log(t.name));

  // Step 2: Check for any Gotra-related table
  const gotraTables = tables.filter(t => t.name.toLowerCase().includes('gotra'));
  if (gotraTables.length > 0) {
    console.log('\n=== GOTRA TABLES FOUND ===');
    for (const gt of gotraTables) {
      const count = await db.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "${gt.name}"`);
      console.log(`Table: ${gt.name}, Rows: ${count[0].cnt}`);
      const rows = await db.$queryRawUnsafe(`SELECT * FROM "${gt.name}" ORDER BY id`);
      console.log(JSON.stringify(rows, null, 2));
    }
  } else {
    console.log('\n=== NO GOTRA TABLE FOUND ===');
  }

  // Step 3: Check Profile table for distinct gotra values
  console.log('\n=== DISTINCT GOTRA VALUES IN PROFILE ===');
  const gotraValues = await db.$queryRaw`SELECT DISTINCT gotra, COUNT(*) as count FROM Profile WHERE gotra IS NOT NULL AND gotra != '' GROUP BY gotra ORDER BY gotra`;
  console.log(`Total distinct gotra values: ${gotraValues.length}`);
  gotraValues.forEach((g, i) => console.log(`${i+1}. ${g.gotra} (count: ${g.count})`));

  // Step 4: Total profiles with gotra
  const totalWithGotra = await db.$queryRaw`SELECT COUNT(*) as cnt FROM Profile WHERE gotra IS NOT NULL AND gotra != ''`;
  console.log(`\nTotal profiles with gotra set: ${totalWithGotra[0].cnt}`);

  // Step 5: Check SystemConfiguration for gotra-related config
  console.log('\n=== SYSTEM CONFIG WITH GOTRA ===');
  const gotraConfigs = await db.$queryRaw`SELECT * FROM SystemConfiguration WHERE key LIKE '%gotra%' OR key LIKE '%Gotra%'`;
  console.log(`Found ${gotraConfigs.length} gotra-related configs`);
  gotraConfigs.forEach(c => console.log(JSON.stringify(c, null, 2)));

  // Step 6: Check all SystemConfiguration keys
  console.log('\n=== ALL SYSTEM CONFIG KEYS ===');
  const allConfigs = await db.$queryRaw`SELECT key FROM SystemConfiguration ORDER BY key`;
  allConfigs.forEach(c => console.log(c.key));

  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
