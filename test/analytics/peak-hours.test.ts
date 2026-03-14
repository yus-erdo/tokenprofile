import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase admin
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}))

// Mock next-auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { GET } from '@/app/api/users/me/analytics/peak-hours/route'
import { adminDb } from '@/lib/firebase/admin'
import { auth } from '@/auth'

describe('GET /api/users/me/analytics/peak-hours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new Request('http://localhost/api/users/me/analytics/peak-hours')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns hourly and daily aggregation', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { firestoreId: 'user123' },
    } as any)

    const mockEvents = [
      { timestamp: { toDate: () => new Date('2026-03-10T09:30:00Z') }, totalTokens: 1000, costUsd: 0.05 },
      { timestamp: { toDate: () => new Date('2026-03-10T09:45:00Z') }, totalTokens: 2000, costUsd: 0.10 },
      { timestamp: { toDate: () => new Date('2026-03-11T14:00:00Z') }, totalTokens: 3000, costUsd: 0.15 },
    ]

    const mockDocs = mockEvents.map(e => ({ data: () => e }))
    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    } as any)

    const req = new Request('http://localhost/api/users/me/analytics/peak-hours?year=2026')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.hourly).toHaveLength(24)
    expect(data.daily).toHaveLength(7)
    // Hour 9 should have 2 completions, 3000 tokens
    expect(data.hourly[9].completions).toBe(2)
    expect(data.hourly[9].tokens).toBe(3000)
  })
})
