import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createMockServer } from "./helpers/mock-server";
import { runHook } from "./helpers/run-hook";

const fixturesDir = path.resolve(__dirname, "fixtures");
const readEnvelope = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(fixturesDir, "envelopes", name), "utf-8"));
const readExpected = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(fixturesDir, "expected", name), "utf-8"));

describe("hook-script", () => {
  let server: ReturnType<typeof createMockServer>;
  let port: number;

  beforeAll(() => {
    // Check jq is available
    try {
      execSync("which jq", { stdio: "ignore" });
    } catch {
      throw new Error("jq is required for hook script tests");
    }
  });

  beforeAll(async () => {
    server = createMockServer();
    port = await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    server.reset();
  });

  const hookEnv = () => ({
    TOQQEN_API_KEY: "test-key-123",
    TOQQEN_URL: `http://localhost:${port}`,
  });

  describe("Claude Code", () => {
    it("posts correct payload for normal session", async () => {
      const envelope = readEnvelope("claude-code.json");
      const result = await runHook({
        envelope,
        transcriptFixture: "claude-code.jsonl",
        env: hookEnv(),
      });

      expect(result.exitCode).toBe(0);
      const req = server.getLastRequest();
      expect(req).not.toBeNull();

      const body = JSON.parse(req!.body);
      const expected = readExpected("claude-code-payload.json");
      expect(body).toEqual(expected);
      expect(req!.headers.authorization).toBe("Bearer test-key-123");
      expect(req!.headers["content-type"]).toBe("application/json");
    });

    it("exits without POST when tokens are zero", async () => {
      const envelope = readEnvelope("claude-code.json");
      const result = await runHook({
        envelope,
        transcriptFixture: "claude-code-zero.jsonl",
        env: hookEnv(),
      });

      expect(result.exitCode).toBe(0);
      expect(server.getLastRequest()).toBeNull();
    });

    it("exits without POST when transcript is missing", async () => {
      const envelope = readEnvelope("claude-code-no-transcript.json");
      const result = await runHook({
        envelope,
        env: hookEnv(),
      });

      expect(result.exitCode).toBe(0);
      expect(server.getLastRequest()).toBeNull();
    });

    it("posts correct payload for single turn", async () => {
      const envelope = readEnvelope("claude-code.json");
      const result = await runHook({
        envelope,
        transcriptFixture: "claude-code-single.jsonl",
        env: hookEnv(),
      });

      expect(result.exitCode).toBe(0);
      const req = server.getLastRequest();
      expect(req).not.toBeNull();

      const body = JSON.parse(req!.body);
      expect(body.num_turns).toBe(1);
      expect(body.source).toBe("claude-code");
      expect(body.input_tokens).toBe(1050); // 1000 + 50 + 0
      expect(body.output_tokens).toBe(200);
    });
  });

  describe("Cursor", () => {
    it("posts with zero tokens when no transcript", async () => {
      const envelope = readEnvelope("cursor.json");
      const result = await runHook({
        envelope,
        env: hookEnv(),
      });

      expect(result.exitCode).toBe(0);
      const req = server.getLastRequest();
      expect(req).not.toBeNull();

      const body = JSON.parse(req!.body);
      const expected = readExpected("cursor-payload.json");
      expect(body).toEqual(expected);
    });

    it("posts with correct num_turns when transcript exists", async () => {
      const envelope = readEnvelope("cursor-with-transcript.json");
      const result = await runHook({
        envelope,
        transcriptFixture: "cursor.jsonl",
        env: hookEnv(),
      });

      expect(result.exitCode).toBe(0);
      const req = server.getLastRequest();
      expect(req).not.toBeNull();

      const body = JSON.parse(req!.body);
      expect(body.source).toBe("cursor");
      expect(body.num_turns).toBe(3); // 3 assistant turns
      expect(body.total_tokens).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("exits without POST when no API key", async () => {
      const envelope = readEnvelope("claude-code.json");
      const result = await runHook({
        envelope,
        transcriptFixture: "claude-code.jsonl",
        // No TOQQEN_API_KEY in env
      });

      expect(result.exitCode).toBe(0);
      expect(server.getLastRequest()).toBeNull();
    });

    it("outputs debug log path in stderr when debug mode enabled", async () => {
      const envelope = readEnvelope("claude-code.json");
      const result = await runHook({
        envelope,
        transcriptFixture: "claude-code.jsonl",
        env: {
          ...hookEnv(),
          TOQQEN_DEBUG: "1",
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("toqqen: debug log at");
      expect(result.stderr).toContain("/tmp/toqqen-debug/");
    });
  });
});
