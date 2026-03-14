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
      expect(result.fileExists(".toqqen/hook.sh")).toBe(true);
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

  it("updates API key in shell config on re-run", async () => {
    const result = await runInstaller({
      homeFiles: {
        ".zshrc": 'export TOQQEN_API_KEY="old-key"\n',
      },
      homeDirs: [".claude"],
      mockServerPort: port,
      installerScript,
      apiKey: "new-key-456",
    });

    try {
      expect(result.exitCode).toBe(0);
      const zshrc = result.readFile(".zshrc")!;
      const matches = zshrc.match(/TOQQEN_API_KEY/g);
      expect(matches?.length).toBe(1);
      expect(zshrc).toContain('TOQQEN_API_KEY="new-key-456"');
      expect(zshrc).not.toContain("old-key");
      expect(result.stdout).toContain("Updated API key");
    } finally {
      result.cleanup();
    }
  });

  it("removes old hook file if present", async () => {
    const result = await runInstaller({
      homeDirs: [".claude"],
      homeFiles: {
        ".claude/hooks/toqqen-hook.sh": "#!/bin/bash\necho old",
      },
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      expect(result.fileExists(".claude/hooks/toqqen-hook.sh")).toBe(false);
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
      expect(result.fileExists(".toqqen/hook.sh")).toBe(true);
      expect(result.stdout).toContain("Neither");
    } finally {
      result.cleanup();
    }
  });

  it("skips settings.json rewrite when hook already configured", async () => {
    // First run to get hook installed with correct paths
    const result1 = await runInstaller({
      homeDirs: [".claude"],
      mockServerPort: port,
      installerScript,
    });

    expect(result1.exitCode).toBe(0);
    // Inject a custom key and use 4-space indent to detect any reformatting
    const settings = JSON.parse(result1.readFile(".claude/settings.json")!);
    settings.customKey = "user-value";
    const customContent = JSON.stringify(settings, null, 4);
    fs.writeFileSync(
      path.join(result1.homeDir, ".claude/settings.json"),
      customContent
    );

    // Second run should skip
    const result2 = await runInstaller({
      existingHomeDir: result1.homeDir,
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result2.exitCode).toBe(0);
      expect(result2.stdout).toContain("Hook already configured");
      // File should be byte-for-byte identical (no reformat)
      const afterContent = result2.readFile(".claude/settings.json")!;
      expect(afterContent).toBe(customContent);
    } finally {
      result1.cleanup();
    }
  });

  it("skips Cursor hooks.json rewrite when hook already configured", async () => {
    // First run to get hook installed with correct paths
    const result1 = await runInstaller({
      homeDirs: [".cursor"],
      mockServerPort: port,
      installerScript,
    });

    expect(result1.exitCode).toBe(0);
    const hooks = JSON.parse(result1.readFile(".cursor/hooks.json")!);
    hooks.customKey = "user-value";
    const customContent = JSON.stringify(hooks, null, 4);
    fs.writeFileSync(
      path.join(result1.homeDir, ".cursor/hooks.json"),
      customContent
    );

    // Second run should skip
    const result2 = await runInstaller({
      existingHomeDir: result1.homeDir,
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result2.exitCode).toBe(0);
      expect(result2.stdout).toContain("Hook already configured");
      const afterContent = result2.readFile(".cursor/hooks.json")!;
      expect(afterContent).toBe(customContent);
    } finally {
      result1.cleanup();
    }
  });

  it("uses python3 fallback for Claude Code when jq is unavailable", async () => {
    const noJq = (s: string) => s.replace(/command -v jq/g, "false");
    const existingSettings = {
      customKey: "preserve-me",
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
      scriptTransform: noJq,
    });

    try {
      expect(result.exitCode).toBe(0);
      const settings = JSON.parse(result.readFile(".claude/settings.json")!);
      // Existing data preserved
      expect(settings.customKey).toBe("preserve-me");
      // Both hooks present
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

  it("uses python3 fallback for Cursor when jq is unavailable", async () => {
    const noJq = (s: string) => s.replace(/command -v jq/g, "false");
    const existingHooks = {
      version: 1,
      customKey: "preserve-me",
      hooks: {
        stop: [
          {
            command: "/bin/bash",
            args: ["/usr/local/bin/other-hook.sh"],
          },
        ],
      },
    };

    const result = await runInstaller({
      homeDirs: [".cursor"],
      homeFiles: {
        ".cursor/hooks.json": JSON.stringify(existingHooks, null, 2),
      },
      mockServerPort: port,
      installerScript,
      scriptTransform: noJq,
    });

    try {
      expect(result.exitCode).toBe(0);
      const hooks = JSON.parse(result.readFile(".cursor/hooks.json")!);
      // Existing data preserved
      expect(hooks.customKey).toBe("preserve-me");
      expect(hooks.version).toBe(1);
      // Both hooks present
      expect(hooks.hooks.stop.length).toBe(2);
      const args = hooks.hooks.stop.map(
        (h: { args: string[] }) => h.args[0]
      );
      expect(args).toContain("/usr/local/bin/other-hook.sh");
      expect(args.some((a: string) => a.includes("hook.sh"))).toBe(true);
    } finally {
      result.cleanup();
    }
  });

  it("preserves existing Cursor hooks.json when merging", async () => {
    const existingHooks = {
      version: 1,
      hooks: {
        stop: [
          {
            command: "/bin/bash",
            args: ["/usr/local/bin/other-hook.sh"],
          },
        ],
      },
    };

    const result = await runInstaller({
      homeDirs: [".cursor"],
      homeFiles: {
        ".cursor/hooks.json": JSON.stringify(existingHooks, null, 2),
      },
      mockServerPort: port,
      installerScript,
    });

    try {
      expect(result.exitCode).toBe(0);
      const hooks = JSON.parse(result.readFile(".cursor/hooks.json")!);
      expect(hooks.hooks.stop.length).toBe(2);
      const args = hooks.hooks.stop.map(
        (h: { args: string[] }) => h.args[0]
      );
      expect(args).toContain("/usr/local/bin/other-hook.sh");
      expect(args.some((a: string) => a.includes("hook.sh"))).toBe(true);
    } finally {
      result.cleanup();
    }
  });

  it("fails with error when no API key and no TTY", async () => {
    const result = await runInstaller({
      homeDirs: [".claude"],
      mockServerPort: port,
      installerScript,
      skipApiKey: true,
    });

    try {
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("API key is required");
      expect(result.stderr).toContain("Usage:");
      expect(result.fileExists(".toqqen/hook.sh")).toBe(false);
    } finally {
      result.cleanup();
    }
  });

  it("prompts for API key interactively via TTY", async () => {
    const result = await runInstaller({
      homeDirs: [".claude"],
      homeFiles: { ".zshrc": "" },
      mockServerPort: port,
      installerScript,
      skipApiKey: true,
      ttyInput: "tty-key-789\n",
    });

    try {
      expect(result.exitCode).toBe(0);
      expect(result.fileExists(".toqqen/hook.sh")).toBe(true);

      // API key from TTY should be saved in shell config
      const zshrc = result.readFile(".zshrc");
      expect(zshrc).toContain('TOQQEN_API_KEY="tty-key-789"');

      // Welcome message should appear
      expect(result.stdout).toContain("Welcome to toqqen");
      expect(result.stdout).toContain("toqqen.dev/settings");
    } finally {
      result.cleanup();
    }
  });

  it("prefers CLI argument over TTY when both available", async () => {
    const result = await runInstaller({
      homeDirs: [".claude"],
      homeFiles: { ".zshrc": "" },
      mockServerPort: port,
      installerScript,
      apiKey: "cli-key-abc",
      ttyInput: "tty-key-xyz\n",
    });

    try {
      expect(result.exitCode).toBe(0);
      const zshrc = result.readFile(".zshrc");
      expect(zshrc).toContain('TOQQEN_API_KEY="cli-key-abc"');
      expect(zshrc).not.toContain("tty-key-xyz");
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
