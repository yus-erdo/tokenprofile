import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { GET } from '@/app/api/users/me/analytics/streaks/route'
import { adminDb } from '@/lib/firebase/admin'
import { auth } from '@/auth'

describe('GET /api/users/me/analytics/streaks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/users/me/analytics/streaks'))
    expect(res.status).toBe(401)
  })

  it('calculates current and longest streaks', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { firestoreId: 'user123' },
    } as any)

    // 3-day streak ending today (2026-03-14), plus a past 5-day streak
    const today = new Date('2026-03-14T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(today)

    const dates = [
      '2026-03-14', '2026-03-13', '2026-03-12', // current: 3 days
      '2026-03-05', '2026-03-04', '2026-03-03', '2026-03-02', '2026-03-01', // past: 5 days
    ]

    const mockDocs = dates.map(d => ({
      data: () => ({ timestamp: { toDate: () => new Date(d + 'T10:00:00Z') } }),
    }))

    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    } as any)

    const res = await GET(new Request('http://localhost/api/users/me/analytics/streaks'))
    const data = await res.json()

    expect(data.currentStreak).toBe(3)
    expect(data.longestStreak).toBe(5)

    vi.useRealTimers()
  })
})
