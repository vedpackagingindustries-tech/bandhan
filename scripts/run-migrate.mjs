// ═══════════════════════════════════════════════════════════════
// Conditional migration runner for the build pipeline.
// - On Vercel (real DATABASE_URL, reachable host): runs `prisma migrate deploy`.
// - Locally (placeholder/unreachable DB): skips gracefully so the
//   production build can still be compile-validated.
// Migrations are ADDITIVE-ONLY (CREATE TABLE / ADD COLUMN IF NOT EXISTS).
// ═══════════════════════════════════════════════════════════════
import net from 'node:net'
import { spawnSync } from 'node:child_process'

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
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
