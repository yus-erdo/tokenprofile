"use client";

import { useState, type ReactNode } from "react";

type ToolSelection = "claude-code" | "cursor" | "both";

interface HookInstallGuideProps {
  apiKey: string;
  footer?: ReactNode;
}

export function HookInstallGuide({ apiKey, footer }: HookInstallGuideProps) {
  const [tool, setTool] = useState<ToolSelection>("claude-code");
  const [tab, setTab] = useState<"automatic" | "manual">("automatic");
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedClaudeJson, setCopiedClaudeJson] = useState(false);
  const [copiedCursorJson, setCopiedCursorJson] = useState(false);

  const autoCommand = `curl -fsSL toqqen.dev/install | bash -s -- "${apiKey}"`;

  const claudeManualJson = JSON.stringify(
    {
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "bash ~/.toqqen/hook.sh",
                async: true,
              },
            ],
          },
        ],
      },
    },
    null,
    2
  );

  const cursorManualJson = JSON.stringify(
    {
      version: 1,
      hooks: {
        stop: [
          {
            command: "/bin/bash",
            args: ["~/.toqqen/hook.sh"],
          },
        ],
      },
    },
    null,
    2
  );

  function copyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  const toolOptions: { value: ToolSelection; label: string }[] = [
    { value: "claude-code", label: "Claude Code" },
    { value: "cursor", label: "Cursor" },
    { value: "both", label: "Both" },
  ];

  const showClaude = tool === "claude-code" || tool === "both";
  const showCursor = tool === "cursor" || tool === "both";

  return (
    <div>
      {/* Tabs */}
      <div className="flex mb-4 bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5">
        {(["automatic", "manual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize ${
              tab === t
                ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mb-4">
        {tab === "automatic" ? (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Run this in your terminal (auto-detects installed tools):
            </p>
            {/* Terminal block */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="w-2 h-2 rounded-full bg-red-400/60" />
                <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
                <div className="w-2 h-2 rounded-full bg-green-400/60" />
                <span className="text-[10px] text-gray-400 dark:text-gray-600 ml-1.5 font-mono">terminal</span>
              </div>
              <div className="relative bg-gray-950 p-3">
                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all leading-relaxed pr-14">
                  <span className="text-gray-500">$ </span>{autoCommand}
                </pre>
                <button
                  onClick={() => copyText(autoCommand, setCopiedCommand)}
                  className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
                    copiedCommand
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {copiedCommand ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Tool selector pills */}
            <div className="flex gap-1.5">
              {toolOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTool(value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 ${
                    tool === value
                      ? "border-orange-500/50 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      : "border-gray-200 dark:border-gray-800 text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 text-[10px] font-bold mr-1.5">1</span>
                Add to <code className="text-[11px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">~/.bashrc</code> or <code className="text-[11px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">~/.zshrc</code>:
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2 ml-[22px]">
                The hook script reads this key to authenticate with Toqqen.
              </p>
              <div className="relative rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="bg-gray-950 p-3">
                  <code className="text-xs font-mono text-green-400">
                    <span className="text-gray-500">export </span>TOQQEN_API_KEY=<span className="text-amber-400">&quot;{apiKey}&quot;</span>
                  </code>
                </div>
                <button
                  onClick={() => copyText(`export TOQQEN_API_KEY="${apiKey}"`, setCopiedKey)}
                  className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
                    copiedKey
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {copiedKey ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {showClaude && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 text-[10px] font-bold mr-1.5">{tool === "both" ? "2a" : "2"}</span>
                  Add to <code className="text-[11px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">~/.claude/settings.json</code>
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2 ml-[22px]">
                  This registers a Stop hook that runs after each conversation turn.
                </p>
                <div className="relative rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="bg-gray-950 p-3">
                    <pre className="text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">{claudeManualJson}</pre>
                  </div>
                  <button
                    onClick={() => copyText(claudeManualJson, setCopiedClaudeJson)}
                    className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
                      copiedClaudeJson
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {copiedClaudeJson ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            {showCursor && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 text-[10px] font-bold mr-1.5">{tool === "both" ? "2b" : "2"}</span>
                  Add to <code className="text-[11px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">~/.cursor/hooks.json</code>
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-2 ml-[22px]">
                  This registers a stop hook that runs after each agent response.
                </p>
                <div className="relative rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="bg-gray-950 p-3">
                    <pre className="text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">{cursorManualJson}</pre>
                  </div>
                  <button
                    onClick={() => copyText(cursorManualJson, setCopiedCursorJson)}
                    className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
                      copiedCursorJson
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {copiedCursorJson ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {footer}
    </div>
  );
}
