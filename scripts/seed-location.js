const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Chhattisgarh: 33 Districts with key Tehsils
const CG_DISTRICTS = [
  { name: 'Balod', nameHi: 'बालोद', tehsils: ['Balod', 'Dondi', 'Gurur'] },
  { name: 'Baloda Bazar', nameHi: 'बलौदा बाजार', tehsils: ['Baloda Bazar', 'Bhatapara', 'Kasdol', 'Palari', 'Simga'] },
  { name: 'Balrampur', nameHi: 'बलरामपुर', tehsils: ['Balrampur', 'Ramanujnagar', 'Shankargarh'] },
  { name: 'Bastar', nameHi: 'बस्तर', tehsils: ['Bastar', 'Bhanupratappur', 'Jagdalpur', 'Kondagaon'] },
  { name: 'Bemetara', nameHi: 'बेमेतरा', tehsils: ['Bemetara', 'Berla', 'Nawagarh', 'Saja'] },
  { name: 'Bijapur', nameHi: 'बीजापुर', tehsils: ['Bijapur', 'Bhopalpatnam', 'Usoor'] },
  { name: 'Bilaspur', nameHi: 'बिलासपुर', tehsils: ['Bilaspur', 'Bilha', 'Kota', 'Lormi', 'Masturi', 'Pendra', 'Takhatpur'] },
  { name: 'Dantewada', nameHi: 'दंतेवाड़ा', tehsils: ['Dantewada', 'Geedam', 'Kuakonda'] },
  { name: 'Dhamtari', nameHi: 'धमतरी', tehsils: ['Dhamtari', 'Kurud', 'Magarlod', 'Nagari', 'Sihawa'] },
  { name: 'Durg', nameHi: 'दुर्ग', tehsils: ['Durg', 'Bhilai', 'Patan', 'Risali', 'Uttara'] },
  { name: 'Gariaband', nameHi: 'गरियाबंद', tehsils: ['Gariaband', 'Chhura', 'Deobhog', 'Fingeshwar'] },
  { name: 'Janjgir-Champa', nameHi: 'जांजगीर-चांपा', tehsils: ['Janjgir', 'Champa', 'Akaltara', 'Bamhani', 'Dabhra', 'Malkharoda', 'Naila', 'Pamgarh', 'Sakti'] },
  { name: 'Jashpur', nameHi: 'जशपुर', tehsils: ['Jashpur', 'Bagicha', 'Duldula', 'Kansabel', 'Kunkuri', 'Manora', 'Pathalgaon'] },
  { name: 'Kabeerdham', nameHi: 'कबीरधाम', tehsils: ['Kawardha', 'Bodla', 'Pandariya', 'Sahaspur Lohara'] },
  { name: 'Kanker', nameHi: 'कांकेर', tehsils: ['Kanker', 'Antagarh', 'Bhanupratappur', 'Charama', 'Durgukondal', 'Koylibera', 'Narharpur', 'Packbar'] },
  { name: 'Kondagaon', nameHi: 'कोंडागांव', tehsils: ['Kondagaon', 'Dhanora', 'Makdi', 'Mulguma'] },
  { name: 'Korba', nameHi: 'कोरबा', tehsils: ['Korba', 'Katghora', 'Pali', 'Rampur'] },
  { name: 'Koriya', nameHi: 'कोरिया', tehsils: ['Baikunthpur', 'Khadgawan', 'Manendragarh', 'Sonhat'] },
  { name: 'Mahasamund', nameHi: 'महासमुंद', tehsils: ['Mahasamund', 'Bagbahra', 'Basma', 'Chhura', 'Pithora', 'Saraipali'] },
  { name: 'Mungeli', nameHi: 'मुंगेली', tehsils: ['Mungeli', 'Lormi', 'Pathariya'] },
  { name: 'Narayanpur', nameHi: 'नारायणपुर', tehsils: ['Narayanpur', 'Chotedongar', 'Orchha'] },
  { name: 'Raigarh', nameHi: 'रायगढ़', tehsils: ['Raigarh', 'Dharamjaigarh', 'Gharghoda', 'Khalti', 'Pussore', 'Ramanujganj', 'Sarangarh', 'Tamnar'] },
  { name: 'Raipur', nameHi: 'रायपुर', tehsils: ['Raipur', 'Arang', 'Dharsiva', 'Gariaband', 'Manpur', 'Tilda', 'Urla', 'Abhanpur', 'Naya Raipur'] },
  { name: 'Rajnandgaon', nameHi: 'राजनांदगांव', tehsils: ['Rajnandgaon', 'Ambagarh Chowki', 'Chhuikhadan', 'Dongargarh', 'Khairagarh', 'Manpur', 'Mohla', 'S Rampur'] },
  { name: 'Sukma', nameHi: 'सुकमा', tehsils: ['Sukma', 'Chhindgarh', 'Dornapal', 'Gadiras', 'Konta'] },
  { name: 'Surajpur', nameHi: 'सूरजपुर', tehsils: ['Surajpur', 'Bhaiyathan', 'Odia', 'Pratappur', 'Ramanujnagar'] },
  { name: 'Surguja', nameHi: 'सरगुजा', tehsils: ['Ambikapur', 'Bhatin', 'Lakhanpur', 'Lundra', 'Mainpat', 'Premnagar', 'Ramanujganj', 'Sitapur', 'Udaipur'] },
  { name: 'Tikamgarh', nameHi: 'टीकमगढ़', tehsils: ['Tikamgarh', 'Baldevgarh', 'Jatara', 'Niwari', 'Palera', 'Prithvipur'] },
  { name: 'Uttar Bastar Kanker', nameHi: 'उत्तर बस्तर कांकेर', tehsils: ['Antagarh', 'Bhanupratappur', 'Kanker', 'Narharpur'] },
  { name: 'Bilaspur New', nameHi: 'बिलासपुर नवा', tehsils: ['Bilha', 'Kota', 'Lormi', 'Masturi', 'Pendra Road'] },
  { name: 'Mohla-Manpur-Ambagarh', nameHi: 'मोहला-मानपुर-अम्बागढ़', tehsils: ['Mohla', 'Manpur', 'Ambagarh Chowki'] },
  { name: 'Sakti', nameHi: 'सक्ती', tehsils: ['Sakti', 'Jashpur', 'Malkharoda'] },
  { name: 'Sarangarh-Bilaigarh', nameHi: 'सारंगढ़-बिलाईगढ़', tehsils: ['Sarangarh', 'Bilaigarh'] },
];

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function seed() {
  const existing = await db.location.count();
  if (existing > 0) {
    console.log('Locations already seeded:', existing);
    await db.$disconnect();
    return;
  }

  // State
  const state = await db.location.create({
    data: { name: 'Chhattisgarh', nameHi: 'छत्तीसगढ़', level: 'STATE', slug: 'chhattisgarh', sortOrder: 1 },
  });
  console.log('State:', state.name);

  let districtCount = 0;
  let tehsilCount = 0;

  for (const d of CG_DISTRICTS) {
    const district = await db.location.create({
      data: { name: d.name, nameHi: d.nameHi, level: 'DISTRICT', slug: slug(d.name), parentId: state.id, sortOrder: districtCount + 1 },
    });
    districtCount++;

    for (const t of d.tehsils) {
      await db.location.create({
        data: { name: t, nameHi: t, level: 'TEHSIL', slug: slug(d.name + '-' + t), parentId: district.id, sortOrder: tehsilCount + 1 },
      });
      tehsilCount++;
    }
  }

  const total = await db.location.count();
  console.log('Districts:', districtCount, 'Tehsils:', tehsilCount, 'Total:', total);
  await db.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
