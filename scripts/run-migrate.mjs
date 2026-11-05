// ═══════════════════════════════════════════════════════════════
// BANDHAN — Self-healing migration runner for the build pipeline.
//
// 1. No PostgreSQL DATABASE_URL (local compile build)  → skip.
// 2. DB host unreachable from this environment         → skip.
// 3. `prisma migrate deploy` normally.
// 4. If deploy fails (classic P3005: schema exists but no
//    migration history, e.g. DB was created via `db push`):
//      a. Apply the additive migration DDL directly via
//         `prisma db execute` (every statement is IF NOT EXISTS —
//         idempotent, additive-only, zero data loss).
//      b. Baseline history: `prisma migrate resolve --applied`.
//      c. Re-run `prisma migrate deploy` to confirm clean state.
//
// All migrations in this project are ADDITIVE-ONLY
// (CREATE TABLE / ADD COLUMN / CREATE INDEX IF NOT EXISTS).
// ═══════════════════════════════════════════════════════════════
import net from 'node:net'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const SCHEMA = 'prisma/schema.prisma'

function parseHostPort(url) {
  try {
    const u = new URL(url)
    return { host: u.hostname, port: Number(u.port) || (u.protocol === 'postgresql:' ? 5432 : 0) }
  } catch {
    return null
  }
}

function canConnect(host, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const done = (ok) => { socket.destroy(); resolve(ok) }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' })
  return r.status ?? 1
}

function listMigrations() {
  const dir = 'prisma/migrations'
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((d) => {
      const p = path.join(dir, d)
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'migration.sql'))
    })
    .sort()
}

const dbUrl = process.env.DATABASE_URL || ''
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
const parsed = parseHostPort(dbUrl)

if (!isPostgres || !parsed) {
  console.log('[MIGRATE] No PostgreSQL DATABASE_URL configured — skipping migration (local compile build).')
  process.exit(0)
}

const reachable = await canConnect(parsed.host, parsed.port)
if (!reachable) {
  console.log(`[MIGRATE] Database host ${parsed.host}:${parsed.port} unreachable from this environment — skipping migration.`)
  console.log('[MIGRATE] (In production the database is reachable and migrations run during deploy.)')
  process.exit(0)
}

console.log('[MIGRATE] Database reachable — running prisma migrate deploy...')
const first = run('npx', ['prisma', 'migrate', 'deploy', '--schema', SCHEMA])
if (first === 0) {
  console.log('[MIGRATE] migrate deploy OK.')
  process.exit(0)
}

// ── P3005 / no-migration-history self-healing ──────────────────
console.log('[MIGRATE] migrate deploy failed (expected P3005 if DB predates migration history).')
console.log('[MIGRATE] Self-healing: applying additive DDL directly, then baselining history.')

const migrations = listMigrations()
if (migrations.length === 0) {
  console.error('[MIGRATE] FATAL: no migrations found to baseline.')
  process.exit(1)
}

for (const name of migrations) {
  const sqlFile = path.join('prisma', 'migrations', name, 'migration.sql')
  console.log(`[MIGRATE] Applying additive DDL for ${name} via db execute (idempotent)...`)
  const applied = run('npx', ['prisma', 'db', 'execute', '--schema', SCHEMA, '--file', sqlFile])
  if (applied !== 0) {
    console.error(`[MIGRATE] FATAL: could not apply DDL for ${name}.`)
    process.exit(1)
  }
  console.log(`[MIGRATE] Baseline history for ${name} (resolve --applied)...`)
  const resolved = run('npx', ['prisma', 'migrate', 'resolve', '--schema', SCHEMA, '--applied', name])
  if (resolved !== 0) {
    // Entry may already exist from a previous partial attempt — non-fatal.
    console.warn(`[MIGRATE] resolve for ${name} returned ${resolved} (may already be recorded) — continuing.`)
  }
}

console.log('[MIGRATE] Re-running prisma migrate deploy to confirm clean state...')
const confirm = run('npx', ['prisma', 'migrate', 'deploy', '--schema', SCHEMA])
if (confirm !== 0) {
  console.error('[MIGRATE] FATAL: migrate deploy still failing after baseline.')
  process.exit(1)
}
console.log('[MIGRATE] Migration history baselined — all migrations applied. DONE.')
process.exit(0)
