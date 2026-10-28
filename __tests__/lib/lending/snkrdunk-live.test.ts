// @vitest-environment node
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { fetchSnkrdunkSnapshot } from '@/lib/lending/snkrdunk'

// Explicit opt-in only: one request, no scheduled collection or pagination.
it.skipIf(process.env.RUN_SNKRDUNK_LIVE !== '1')('reads a real PSA10 snapshot through the production adapter', async () => {
  const snapshot = await fetchSnkrdunkSnapshot('408333')
  expect(snapshot.grade).toBe('PSA10')
  expect(snapshot.currency).toBe('JPY')
  expect(snapshot.floorPriceJpy).toBeGreaterThan(0)
  expect(snapshot.sales.length).toBeGreaterThan(0)
  expect(snapshot.dailySalesAverage).toBeNull()
}, 15000)
