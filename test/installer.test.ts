import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createMockServer } from "./helpers/mock-server";
import { runInstaller } from "./helpers/run-installer";

// Read the installer script from the route file
function getInstallerScript(): string {
  const routeFile = fs.readFileSync(
    path.resolve(__dirname, "../app/api/hook-script/route.ts"),
    "utf-8"
  );
  // Extract the SCRIPT constant (between first ` and last `)
  const match = routeFile.match(/const SCRIPT = `([\s\S]*?)`;/);
  if (!match) throw new Error("Could not extract installer script from route.ts");
  // Unescape template literal escapes
  return match[1]
    .replace(/\\`/g, "`")
    .replace(/\\\$/g, "$")
    .replace(/\\\\/g, "\\");
}

describe("installer", () => {
  let server: ReturnType<typeof createMockServer>;
  let port: number;
  let installerScript: string;

  beforeAll(async () => {
    installerScript = getInstallerScript();
    server = createMockServer();
    port = await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    server.reset();
  });

  it("creates settings.json for Claude Code only", async () => {
    const result = await runInstaller({
      homeDirs: [".claude"],
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      expect(result.fileExists(".tokenprofile/hook.sh")).toBe(true);
      expect(result.fileExists(".claude/settings.json")).toBe(true);

      const settings = JSON.parse(result.readFile(".claude/settings.json")!);
      expect(settings.hooks.Stop).toBeDefined();
      expect(settings.hooks.Stop[0].hooks[0].command).toContain("hook.sh");
    } finally {
      result.cleanup();
    }
  });

  it("creates hooks.json for Cursor only", async () => {
    const result = await runInstaller({
      homeDirs: [".cursor"],
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      expect(result.fileExists(".cursor/hooks.json")).toBe(true);

      const hooks = JSON.parse(result.readFile(".cursor/hooks.json")!);
      expect(hooks.hooks.stop).toBeDefined();
      expect(hooks.hooks.stop[0].args[0]).toContain("hook.sh");
    } finally {
      result.cleanup();
    }
  });

  it("configures both tools when both dirs exist", async () => {
    const result = await runInstaller({
      homeDirs: [".claude", ".cursor"],
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      expect(result.fileExists(".claude/settings.json")).toBe(true);
      expect(result.fileExists(".cursor/hooks.json")).toBe(true);
    } finally {
      result.cleanup();
    }
  });

  it("preserves existing hooks in settings.json", async () => {
    const existingSettings = {
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [{ type: "command", command: "echo existing" }],
          },
        ],
      },
    };

    const result = await runInstaller({
      homeDirs: [".claude"],
      homeFiles: {
        ".claude/settings.json": JSON.stringify(existingSettings, null, 2),
      },
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      const settings = JSON.parse(result.readFile(".claude/settings.json")!);
      // Should have both the existing hook and the new one
      expect(settings.hooks.Stop.length).toBeGreaterThanOrEqual(2);
      const commands = settings.hooks.Stop.map(
        (s: { hooks: { command: string }[] }) => s.hooks[0].command
      );
      expect(commands).toContain("echo existing");
      expect(commands.some((c: string) => c.includes("hook.sh"))).toBe(true);
    } finally {
      result.cleanup();
    }
  });

  it("does not duplicate API key in shell config", async () => {
    const result = await runInstaller({
      homeFiles: {
        ".zshrc": 'export TOKEN_PROFILE_API_KEY="existing-key"\n',
      },
      homeDirs: [".claude"],
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      const zshrc = result.readFile(".zshrc")!;
      const matches = zshrc.match(/TOKEN_PROFILE_API_KEY/g);
      expect(matches?.length).toBe(1);
      expect(result.stdout).toContain("already set");
    } finally {
      result.cleanup();
    }
  });

  it("removes old hook file if present", async () => {
    const result = await runInstaller({
      homeDirs: [".claude"],
      homeFiles: {
        ".claude/hooks/tokenprofile-hook.sh": "#!/bin/bash\necho old",
      },
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      expect(result.fileExists(".claude/hooks/tokenprofile-hook.sh")).toBe(false);
      expect(result.stdout).toContain("Cleaned up old hook");
    } finally {
      result.cleanup();
    }
  });

  it("installs hook script even when neither tool dir exists", async () => {
    const result = await runInstaller({
      homeFiles: { ".zshrc": "" },
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      expect(result.fileExists(".tokenprofile/hook.sh")).toBe(true);
      expect(result.stdout).toContain("Neither");
    } finally {
      result.cleanup();
    }
  });

  it("is idempotent on re-run", async () => {
    // First run
    const result1 = await runInstaller({
      homeDirs: [".claude"],
      mockServerPort: port,
      installerScript,
    });

    expect(result1.exitCode).toBe(0);

    // Second run in the SAME home dir
    const result2 = await runInstaller({
      existingHomeDir: result1.homeDir,
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result2.exitCode).toBe(0);
      const settings = JSON.parse(result2.readFile(".claude/settings.json")!);
      // unique_by should prevent duplicates
      const hookCommands = settings.hooks.Stop.map(
        (s: { hooks: { command: string }[] }) => s.hooks[0].command
      );
      const tpHooks = hookCommands.filter((c: string) => c.includes("hook.sh"));
      expect(tpHooks.length).toBe(1);
    } finally {
      result1.cleanup();
    }
  });
});
