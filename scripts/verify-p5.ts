import { db } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function fullVerify() {
  const results: Record<string, string> = {};

  // GOTRA
  const gotraTotal = await db.gotra.count();
  const gotraUnique = (await db.gotra.groupBy({ by: ['name'] })).length;
  results.gotraTotal = String(gotraTotal);
  results.gotraUnique = String(gotraUnique);
  results.gotraDuplicates = String(gotraTotal - gotraUnique);

  // PHASE 5 NEW TABLES
  const backupCount = await db.backupRecord.count();
  results.backupRecords = String(backupCount);
  const scheduledTaskCount = await db.scheduledTask.count();
  results.scheduledTasks = String(scheduledTaskCount);

  // PHASE 5 API ROUTES COUNT
  function countRoutes(dir: string): number {
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countRoutes(fullPath);
      } else if (entry.isFile() && entry.name === 'route.ts') {
        count++;
      }
    }
    return count;
  }

  const opsDir = 'src/app/api/v1/admin/ops';
  const opsRoutes = fs.existsSync(opsDir) ? countRoutes(opsDir) : 0;
  results.opsApiRoutes = String(opsRoutes);

  const adDir = 'src/app/api/v1/ads';
  const adRoutes = fs.existsSync(adDir) ? countRoutes(adDir) : 0;
  results.adApiRoutes = String(adRoutes);

  // NEW SERVICE FILES
  const services = ['automation', 'observability'];
  for (const s of services) {
    const p = 'src/services/' + s + '.ts';
    results['service_' + s] = String(fs.existsSync(p));
  }

  // AI SERVICE CHECK (Phase 4 preserved)
  const aiFiles = fs.readdirSync('src/services/ai').filter(f => f.endsWith('.ts'));
  results.aiServiceFiles = String(aiFiles.length);

  // SCHEMA MODELS COUNT
  const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf-8');
  const modelMatches = schemaContent.match(/^model /gm);
  results.totalModels = String(modelMatches ? modelMatches.length : 0);

  // i18n CHECK
  const translationsContent = fs.readFileSync('src/i18n/translations.ts', 'utf-8');
  const hasAdminEn = translationsContent.includes('admin: {') && translationsContent.indexOf('admin: {') < translationsContent.indexOf('hi: {');
  results.hasAdminEn = String(hasAdminEn);
  const hasAdminHi = translationsContent.includes('एडमिन डैशबोर्ड');
  results.hasAdminHi = String(hasAdminHi);

  // SEO CHECK
  const layoutContent = fs.readFileSync('src/app/layout.tsx', 'utf-8');
  results.hasTemplateTitle = String(layoutContent.includes('template:'));
  results.hasTwitterCard = String(layoutContent.includes('twitter'));
  results.hasRobots = String(layoutContent.includes('robots'));
  results.hasCanonical = String(layoutContent.includes('canonical'));
  results.hasThemeColor = String(layoutContent.includes('theme-color'));
  results.hasAlternateLocale = String(layoutContent.includes('alternateLocale'));

  // SEED CHECK
  const seedContent = fs.readFileSync('src/lib/seed.ts', 'utf-8');
  results.seedHasScheduledTasks = String(seedContent.includes('ScheduledTask'));

  // PRE-EXISTING LINT ERROR CHECK
  const campaignsContent = fs.readFileSync('src/app/api/v1/admin/campaigns/route.ts', 'utf-8');
  results.preExistingLintError = String(campaignsContent.includes('const module'));

  console.log(JSON.stringify(results, null, 2));
}

fullVerify().catch(e => console.error(e));
