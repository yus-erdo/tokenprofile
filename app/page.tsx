"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

// Heatmap colors from components/heatmap.tsx (dark mode palette)
const HEATMAP_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

function generateHeatmapData(rows: number, cols: number): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      // Create a natural-looking pattern: more activity in recent weeks
      const recency = c / cols;
      const rand = Math.random();
      const threshold = 0.3 + recency * 0.4;
      if (rand < threshold) {
        row.push(Math.floor(Math.random() * 4) + 1);
      } else {
        row.push(0);
      }
    }
    grid.push(row);
  }
  return grid;
}

// --- Animated Counter ---
function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  duration = 2000,
  color,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  color: string;
}) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  const display =
    target >= 1_000_000
      ? (value / 1_000_000).toFixed(1) + "M"
      : target >= 1_000
        ? (value / 1_000).toFixed(target < 10_000 ? 1 : 0) + "K"
        : value.toString();

  return (
    <span ref={ref} className="font-mono text-2xl md:text-3xl font-bold" style={{ color }}>
      {prefix}
      {started ? display : "0"}
      {suffix}
    </span>
  );
}

// --- Scroll Reveal ---
function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add("visible"), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`animate-fade-slide-up ${className}`}>
      {children}
    </div>
  );
}

// --- Heatmap Grid ---
function HeroHeatmap() {
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGrid(generateHeatmapData(7, 52));
  }, []);

  useEffect(() => {
    if (!containerRef.current || !innerRef.current) return;
    function recalc() {
      const container = containerRef.current;
      const inner = innerRef.current;
      if (!container || !inner) return;
      const containerW = container.clientWidth;
      const innerW = inner.scrollWidth;
      setScale(innerW > containerW ? containerW / innerW : 1);
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [grid]);

  if (!grid) return <div className="h-[85px] md:h-[112px]" />;

  return (
    <div ref={containerRef} className="w-full overflow-hidden px-4">
      <div
        ref={innerRef}
        className="flex gap-[2px] justify-center"
        style={{ transform: `scale(${scale})`, transformOrigin: "top center", height: scale < 1 ? `${91 * scale}px` : undefined }}
      >
        {grid[0].map((_, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-[2px] shrink-0">
            {grid.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className="w-[11px] h-[11px] rounded-[2px] animate-heatmap-cell"
                style={{
                  backgroundColor: HEATMAP_COLORS[row[colIdx]],
                  animationDelay: `${(colIdx * 7 + rowIdx) * 8}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Copy Button ---
function CopyInstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <button
      onClick={copy}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[#333] bg-[#111] hover:border-[#555] transition-colors font-mono text-sm text-[#888] group"
    >
      <span>
        <span className="text-[#555]">$ </span>
        <span className="text-[#ccc]">{command}</span>
      </span>
      <span className="text-xs text-[#555] group-hover:text-[#888] transition-colors shrink-0">
        {copied ? "Copied!" : "Copy"}
      </span>
    </button>
  );
}

// --- Mini Heatmap Fragment ---
function MiniHeatmap({ rows = 4, cols = 8 }: { rows?: number; cols?: number }) {
  const [grid, setGrid] = useState<number[][] | null>(null);

  useEffect(() => {
    setGrid(generateHeatmapData(rows, cols));
  }, [rows, cols]);

  if (!grid) return <div style={{ height: rows * 10, width: cols * 10 }} />;

  return (
    <div className="flex gap-[2px]">
      {grid[0].map((_, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-[2px]">
          {grid.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="w-[8px] h-[8px] rounded-[1px]"
              style={{ backgroundColor: HEATMAP_COLORS[row[colIdx]] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// --- GitHub Sign In Button ---
function GitHubButton({ large = false }: { large?: boolean }) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    signIn("github");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2.5 rounded-lg font-semibold text-white bg-[#222] border border-[#333] hover:bg-[#2a2a2a] hover:border-[#444] transition-all disabled:opacity-70 ${large ? "px-8 py-3.5 text-lg" : "px-6 py-3"}`}
    >
      {loading ? (
        <>
          <div className={`${large ? "w-6 h-6" : "w-5 h-5"} border-2 border-white/30 border-t-white rounded-full animate-spin`} />
          Signing in...
        </>
      ) : (
        <>
          <svg className={large ? "w-6 h-6" : "w-5 h-5"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Sign in with GitHub
        </>
      )}
    </button>
  );
}

// --- Section Components ---

function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-8 max-w-2xl mx-auto">
        <p
          className="font-mono text-sm tracking-[3px]"
          style={{ color: "#00ff88" }}
        >
          toqqen
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">
          The Fitbit for your AI usage.
        </h1>
        <p className="text-base md:text-lg text-[#666] max-w-md mx-auto">
          Every developer&apos;s token pattern is unique. See yours.
        </p>

        <div className="py-4">
          <HeroHeatmap />
        </div>

        <div className="flex items-center justify-center gap-6 md:gap-8 flex-wrap">
          <div className="text-center">
            <AnimatedCounter target={1200000} suffix=" tokens" color="#39d353" />
            <p className="text-xs text-[#555] mt-1">tracked</p>
          </div>
          <div className="text-center">
            <AnimatedCounter target={42} prefix="$" color="#f85149" />
            <p className="text-xs text-[#555] mt-1">cost</p>
          </div>
          <div className="text-center">
            <AnimatedCounter target={14} suffix="d" color="#d29922" />
            <p className="text-xs text-[#555] mt-1">streak</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <GitHubButton />
          <CopyInstallCommand command="curl -fsSL toqqen.dev/install | bash" />
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      num: "1",
      title: "Install the hook",
      code: "curl -fsSL toqqen.dev/install | bash",
      desc: "One command. Works with Claude Code & Cursor.",
    },
    {
      num: "2",
      title: "Code with AI",
      code: "claude 'refactor the auth module...'",
      desc: "Use AI exactly like you always do. We track in the background.",
    },
    {
      num: "3",
      title: "See everything",
      desc: "Beautiful heatmaps, cost tracking, usage insights.",
      visual: true,
    },
  ];

  return (
    <section className="py-24 md:py-32 px-4 border-t border-[#1a1a1a]">
      <div className="max-w-5xl mx-auto">
        <ScrollReveal>
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-16">
            How it works
          </h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 200}>
              <div className="text-center space-y-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto font-mono font-bold text-[#0a0a0a]"
                  style={{ backgroundColor: "#00ff88" }}
                >
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                {step.code && (
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-lg px-4 py-3 font-mono text-sm text-[#ccc]">
                    <span className="text-[#555]">$ </span>
                    {step.code}
                  </div>
                )}
                {step.visual && (
                  <div className="flex justify-center py-2">
                    <MiniHeatmap rows={3} cols={10} />
                  </div>
                )}
                <p className="text-sm text-[#666]">{step.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureGridSection() {
  const features = [
    {
      title: "Usage Heatmaps",
      desc: "GitHub-style contribution graph for your AI usage. See patterns at a glance.",
      visual: "heatmap" as const,
    },
    {
      title: "Cost Tracking",
      desc: "Know exactly what you're spending. Per model, per day, per month.",
      visual: "cost" as const,
    },
    {
      title: "Public Profiles",
      desc: "Shareable profile pages. Your AI usage, visualized for the world.",
      visual: "profile" as const,
    },
    {
      title: "One Hook Setup",
      desc: "Works with Claude Code and Cursor. One command, zero config.",
      visual: "setup" as const,
    },
  ];

  return (
    <section className="py-24 md:py-32 px-4">
      <div className="max-w-4xl mx-auto">
        <ScrollReveal>
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-16">
            Everything you need
          </h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 100}>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6 md:p-8 space-y-4">
                <div className="h-12 flex items-center">
                  {feature.visual === "heatmap" && <MiniHeatmap rows={3} cols={12} />}
                  {feature.visual === "cost" && (
                    <span className="font-mono text-2xl font-bold text-[#f85149]">$42.17</span>
                  )}
                  {feature.visual === "profile" && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#222] border border-[#333]" />
                      <span className="font-mono text-sm text-[#888]">@yusuf</span>
                    </div>
                  )}
                  {feature.visual === "setup" && (
                    <div className="flex items-center gap-2 text-sm text-[#888]">
                      <span className="font-mono px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#333]">
                        Claude Code
                      </span>
                      <span className="text-[#555]">+</span>
                      <span className="font-mono px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#333]">
                        Cursor
                      </span>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="text-sm text-[#666] leading-relaxed">{feature.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileDemoSection() {
  return (
    <section className="py-24 md:py-32 px-4">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
            Your public profile
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="animate-float">
            {/* Browser chrome */}
            <div className="bg-[#1a1a1a] rounded-t-xl px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#f85149]" />
                <div className="w-3 h-3 rounded-full bg-[#d29922]" />
                <div className="w-3 h-3 rounded-full bg-[#39d353]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-[#111] rounded-md px-4 py-1 text-xs text-[#666] font-mono">
                  toqqen.dev/yusuf
                </div>
              </div>
            </div>

            {/* Profile content */}
            <div className="bg-[#111] border border-[#1a1a1a] border-t-0 rounded-b-xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#222] border border-[#333]" />
                <div>
                  <p className="font-semibold text-white">Yusuf</p>
                  <p className="text-sm text-[#555] font-mono">@yusuf</p>
                </div>
              </div>

              <div className="flex gap-6 text-sm">
                <div>
                  <span className="font-mono text-white font-semibold">1.2M</span>{" "}
                  <span className="text-[#555]">tokens</span>
                </div>
                <div>
                  <span className="font-mono text-white font-semibold">847</span>{" "}
                  <span className="text-[#555]">completions</span>
                </div>
                <div>
                  <span className="font-mono text-white font-semibold">14d</span>{" "}
                  <span className="text-[#555]">streak</span>
                </div>
              </div>

              <MiniHeatmap rows={7} cols={16} />

              <div className="space-y-2">
                {[
                  { model: "claude-sonnet-4", tokens: "284K", time: "2h ago" },
                  { model: "claude-opus-4", tokens: "156K", time: "5h ago" },
                ].map((entry) => (
                  <div
                    key={entry.model}
                    className="flex items-center justify-between text-xs text-[#666] bg-[#0a0a0a] rounded-lg px-3 py-2"
                  >
                    <span className="font-mono">{entry.model}</span>
                    <span>
                      {entry.tokens} tokens · {entry.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function SetupSnippetSection() {
  const command = "curl -fsSL toqqen.dev/install | bash";
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <section className="py-24 md:py-32 px-4 border-t border-[#1a1a1a]">
      <div className="max-w-xl mx-auto text-center space-y-8">
        <ScrollReveal>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Set up in 30 seconds.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="relative group">
            <div
              className="bg-[#111] border rounded-xl p-6 font-mono text-lg text-center"
              style={{ borderColor: "#0e4429" }}
            >
              <span className="text-[#39d353]">$ {command}</span>
            </div>
            <button
              onClick={copy}
              className="absolute top-3 right-3 text-xs text-[#555] hover:text-[#888] transition-colors px-2 py-1 rounded bg-[#1a1a1a]"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={400}>
          <p className="text-sm text-[#666]">
            Works with Claude Code and Cursor. No account needed to start.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="py-32 md:py-40 px-4">
      <div className="max-w-lg mx-auto text-center space-y-6">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Start tracking.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <p className="text-[#666]">Free. Open. No credit card.</p>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <GitHubButton large />
        </ScrollReveal>

        <ScrollReveal delay={400}>
          <div className="pt-8 flex justify-center opacity-30">
            <MiniHeatmap rows={3} cols={12} />
          </div>
        </ScrollReveal>

        <div className="pt-16">
          <p className="font-mono text-xs text-[#333] tracking-[2px]">
            toqqen
          </p>
        </div>
      </div>
    </section>
  );
}

// --- Main Page ---

export default function Home() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen overflow-x-hidden" style={{ colorScheme: "dark" }}>
      <HeroSection />
      <HowItWorksSection />
      <FeatureGridSection />
      <ProfileDemoSection />
      <SetupSnippetSection />
      <FinalCTASection />
    </div>
  );
}
