import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase admin
const mockAdd = vi.fn().mockResolvedValue({ id: "mock-event-id" });
const mockGet = vi.fn();
const mockCollection = vi.fn((name: string) => {
  if (name === "events") {
    return { add: mockAdd };
  }
  if (name === "users") {
    return {
      where: () => ({
        limit: () => ({
          get: mockGet,
        }),
      }),
    };
  }
  return {};
});
const mockDoc = vi.fn().mockReturnValue({
  get: vi.fn().mockResolvedValue({ exists: false }),
});

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: mockCollection,
    doc: mockDoc,
  },
}));

vi.mock("@/lib/firebase/model-costs", () => ({
  getModelCosts: vi.fn().mockResolvedValue({ models: {} }),
  calculateCost: vi.fn().mockReturnValue(null),
}));

const mockRateLimit = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/lib/rate-limit", () => ({
  rateLimiter: { limit: mockRateLimit },
}));

// Import after mocks
const { POST } = await import("@/app/api/ingest/route");

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validPayload = {
  event: "Stop",
  source: "claude-code",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  input_tokens: 4250,
  output_tokens: 800,
  total_tokens: 5050,
  cache_creation_tokens: 200,
  cache_read_tokens: 250,
  project: "my-app",
  num_turns: 2,
};

describe("ingest-route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: valid user found
    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ id: "user-123", data: () => ({ apiKey: "valid-key" }) }],
    });
    mockRateLimit.mockResolvedValue({ success: true });
  });

  it("returns 200 and stores event for valid Claude Code payload", async () => {
    const res = await POST(
      makeRequest(validPayload, { Authorization: "Bearer valid-key" })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockAdd).toHaveBeenCalledOnce();
    const stored = mockAdd.mock.calls[0][0];
    expect(stored.userId).toBe("user-123");
    expect(stored.source).toBe("claude-code");
    expect(stored.inputTokens).toBe(4250);
    expect(stored.outputTokens).toBe(800);
  });

  it("returns 200 for valid Cursor payload with zero tokens", async () => {
    const cursorPayload = { ...validPayload, source: "cursor", input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    const res = await POST(
      makeRequest(cursorPayload, { Authorization: "Bearer valid-key" })
    );

    expect(res.status).toBe(200);
    const stored = mockAdd.mock.calls[0][0];
    expect(stored.source).toBe("cursor");
    expect(stored.inputTokens).toBe(0);
  });

  it("returns 401 when no auth header", async () => {
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid API key", async () => {
    mockGet.mockResolvedValue({ empty: true, docs: [] });

    const res = await POST(
      makeRequest(validPayload, { Authorization: "Bearer invalid-key" })
    );
    expect(res.status).toBe(401);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-key",
        "Content-Type": "application/json",
      },
      body: "not json{{{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false });

    const res = await POST(
      makeRequest(validPayload, { Authorization: "Bearer valid-key" })
    );
    expect(res.status).toBe(429);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("defaults source to claude-code when not provided", async () => {
    const { source: _, ...noSource } = validPayload;
    const res = await POST(
      makeRequest(noSource, { Authorization: "Bearer valid-key" })
    );

    expect(res.status).toBe(200);
    const stored = mockAdd.mock.calls[0][0];
    expect(stored.source).toBe("claude-code");
  });
});
