import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: vi.fn() },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/users/me/analytics/trends/route'
import { adminDb } from '@/lib/firebase/admin'
import { auth } from '@/auth'

describe('GET /api/users/me/analytics/trends', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/users/me/analytics/trends'))
    expect(res.status).toBe(401)
  })

  it('returns weekly aggregated trends', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { firestoreId: 'u1' } } as any)

    const mockDocs = [
      { data: () => ({ timestamp: { toDate: () => new Date('2026-03-01T10:00:00Z') }, totalTokens: 1000, costUsd: 0.05 }) },
      { data: () => ({ timestamp: { toDate: () => new Date('2026-03-02T10:00:00Z') }, totalTokens: 2000, costUsd: 0.10 }) },
      { data: () => ({ timestamp: { toDate: () => new Date('2026-03-09T10:00:00Z') }, totalTokens: 3000, costUsd: 0.15 }) },
    ]

    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    } as any)

    const res = await GET(new Request('http://localhost/api/users/me/analytics/trends?granularity=week'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.periods).toBeDefined()
    expect(data.periods.length).toBeGreaterThan(0)
  })
})
