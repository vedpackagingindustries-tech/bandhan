import { getHealthStatus } from '@/services/monitoring'
import { success } from '@/lib/api-response'

export async function GET() {
  const health = await getHealthStatus()
  return success(health)
}

