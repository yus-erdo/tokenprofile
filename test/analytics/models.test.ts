import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: vi.fn() },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/users/me/analytics/models/route'
import { adminDb } from '@/lib/firebase/admin'
import { auth } from '@/auth'

describe('GET /api/users/me/analytics/models', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns model breakdown with percentages', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { firestoreId: 'u1' } } as any)

    const mockDocs = [
      { data: () => ({ model: 'claude-opus-4-6', totalTokens: 5000, costUsd: 0.25 }) },
      { data: () => ({ model: 'claude-opus-4-6', totalTokens: 3000, costUsd: 0.15 }) },
      { data: () => ({ model: 'claude-sonnet-4-6', totalTokens: 2000, costUsd: 0.05 }) },
    ]

    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    } as any)

    const res = await GET(new Request('http://localhost/api/users/me/analytics/models?year=2026'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.models).toHaveLength(2)
    expect(data.models[0].model).toBe('claude-opus-4-6')
    expect(data.models[0].completions).toBe(2)
    expect(data.models[0].tokens).toBe(8000)
    expect(data.models[0].percentage).toBeCloseTo(80) // 8000/10000 * 100
  })
})
