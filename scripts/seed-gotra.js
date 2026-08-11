const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// ═══════════════════════════════════════════════════════════
// OFFICIAL 93 GOTRAS — DO NOT ALTER NAMES
// ═══════════════════════════════════════════════════════════
const GOTRA_MASTER = [
  'अष्ठबंधु',
  'अठभैया',
  'आडिल',
  'अटभया',
  'अटलखाम',
  'अरठोना',
  'अडील',
  'आटनागर',
  'आडी',
  'कन्नोजिया',
  'कलिहारी',
  'कश्यप',
  'कुंवरढांढर',
  'किराहीबोईर',
  'किरण',
  'केकती',
  'गंजीर',
  'गंगबेर',
  'गंगबोइर',
  'गजपाल',
  'गायग्वलिन',
  'गाडागुरडा',
  'गुरूपंच',
  'गुरूमाणिक पंच',
  'गुरू पंचांग',
  'घिडोरा',
  'चंदोले',
  'चंदन मलागर',
  'चोरनार',
  'चोरमार',
  'छटबी',
  'जग्डिया',
  'जेठमल',
  'झपटमार',
  'झपटमार सार्वा',
  'ढावना',
  'तेलासी',
  'तोनिहा',
  'तुरूपमार',
  'तिलभुजिया',
  'दहेले',
  'धुवक्का',
  'नाग',
  'बाडाबाघ',
  'बारावाघ',
  'बाडावाक',
  'बनपेला',
  'बरपेला',
  'बरामार',
  'बेलपुरिया',
  'भैंसा',
  'भोंसले',
  'मांढर टेका',
  'मांढारटेका',
  'महापात्र',
  'मलघाटी',
  'महमल्ला',
  'महेश्वरी',
  'सार्वा',
  'साबराटी',
  'साहढा',
  'सिंह सार्वा',
  'सिरपारू',
  'सेनकपाट',
  'सोनबोईर',
  'सोनबरहा',
  'सोनबरसा',
  'सोनवानी',
  'सोनकालर',
  'सोनकथरी',
  'सोनकलिहारी',
  'सोनखडी',
  'सोनगेर',
  'सेनगेरवा',
  'सोनबेर',
  'सोनबेरसा',
  'सोनसाटी',
  'सोनपडे',
  'हिरवानी',
  'गुपकुमार सार्वा',
  'सिरसाठ',
  'सोनकला',
  'सांधुरि',
  'साबरसांटी',
  'कौशिक',
  'कौशिल',
  'सुलुभ मलागर',
  'लोहोरिया',
  'खांडढिहा',
  'बागरिया',
  'पांच खोरिहा',
  'मरकाम',
  'चंदन',
];

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0900-\u097fa-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

async function seedGotra() {
  console.log('=== GOTRA MASTER SEED ===');
  console.log('Expected:', GOTRA_MASTER.length);

  // Check existing
  const existing = await db.gotra.count();
  console.log('Already in DB:', existing);

  if (existing === GOTRA_MASTER.length) {
    console.log('Already seeded. Skipping.');
    const activeCount = await db.gotra.count({ where: { isActive: true } });
    console.log('Active:', activeCount);
    await db.$disconnect();
    return;
  }

  // Clear and re-seed if counts differ
  if (existing > 0) {
    console.log('Clearing existing Gotra records for clean seed...');
    // First null out gotraId references
    await db.profile.updateMany({ data: { gotraId: null } });
    await db.gotra.deleteMany();
  }

  let inserted = 0;
  let duplicates = 0;
  const seen = new Set();

  for (const name of GOTRA_MASTER) {
    if (seen.has(name)) {
      duplicates++;
      console.log('DUPLICATE:', name);
      continue;
    }
    seen.add(name);

    const slug = slugify(name);
    try {
      await db.gotra.create({
        data: { name, slug, isActive: true },
      });
      inserted++;
    } catch (e) {
      if (e.code === 'P2002') {
        console.log('UNIQUE VIOLATION:', name, 'slug:', slug);
        duplicates++;
      } else {
        throw e;
      }
    }
  }

  const total = await db.gotra.count();
  const activeCount = await db.gotra.count({ where: { isActive: true } });
  const uniqueNames = await db.gotra.groupBy({ by: ['name'] });

  console.log('\n=== SEED RESULT ===');
  console.log('Inserted:', inserted);
  console.log('Duplicates (skipped):', duplicates);
  console.log('Total in DB:', total);
  console.log('Unique names:', uniqueNames.length);
  console.log('Active:', activeCount);

  // Migration safety: link existing free-text gotra to master
  const profilesWithGotra = await db.profile.findMany({
    where: { gotra: { not: null, not: '' }, gotraId: null },
    select: { id: true, gotra: true },
  });
  console.log('\n=== MIGRATION SAFETY ===');
  console.log('Profiles with legacy free-text gotra:', profilesWithGotra.length);
  let linked = 0;
  for (const p of profilesWithGotra) {
    const gotraName = p.gotra;
    const match = await db.gotra.findFirst({ where: { name: gotraName } });
    if (match) {
      await db.profile.update({ where: { id: p.id }, data: { gotraId: match.id } });
      linked++;
    } else {
      console.log('NO MATCH for legacy gotra:', p.gotra, '(profile:', p.id, ')');
    }
  }
  console.log('Legacy profiles linked to master:', linked);
  console.log('Unmatched legacy gotras:', profilesWithGotra.length - linked);

  await db.$disconnect();
}

seedGotra().catch((e) => { console.error(e); process.exit(1); });
