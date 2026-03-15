"use client";

import { useMemo } from "react";
import { MODEL_COLORS } from "@/lib/charts/chart-colors";

interface ModelTokenData {
  input?: number;
  output?: number;
  total?: number;
}

interface UsageFlowProps {
  /** Record of model name -> token breakdown */
  modelTokens: Record<string, ModelTokenData>;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UsageFlow({ modelTokens }: UsageFlowProps) {
  const { models, totalInput, totalOutput, grandTotal, hasData } = useMemo(() => {
    const entries = Object.entries(modelTokens)
      .map(([name, data]) => ({
        name,
        input: data.input ?? 0,
        output: data.output ?? 0,
        total: data.total ?? (data.input ?? 0) + (data.output ?? 0),
      }))
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8); // top 8 models

    const totalInput = entries.reduce((s, m) => s + m.input, 0);
    const totalOutput = entries.reduce((s, m) => s + m.output, 0);
    const grandTotal = entries.reduce((s, m) => s + m.total, 0);

    return {
      models: entries,
      totalInput,
      totalOutput,
      grandTotal,
      hasData: entries.length > 0,
    };
  }, [modelTokens]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-600 font-mono-accent text-xs">
        <div>no model token data yet</div>
      </div>
    );
  }

  const barHeight = 28;
  const gap = 6;
  const colWidth = 140;
  const flowWidth = 60;
  const svgWidth = colWidth * 3 + flowWidth * 2;
  const svgHeight = Math.max(models.length, 2) * (barHeight + gap) + gap + 24;

  // Column positions
  const col1X = 0;
  const flow1X = colWidth;
  const col2X = colWidth + flowWidth;
  const flow2X = col2X + colWidth;
  const col3X = flow2X + flowWidth;

  // Calculate model bar heights and positions
  const modelBars = models.map((m, i) => ({
    ...m,
    y: gap + 20 + i * (barHeight + gap),
    width: grandTotal > 0 ? Math.max((m.total / grandTotal) * colWidth * 0.9, 8) : 8,
    color: MODEL_COLORS[i % MODEL_COLORS.length],
  }));

  // Token type bars
  const tokenTypes = [
    { label: "input", value: totalInput, y: gap + 20 },
    { label: "output", value: totalOutput, y: gap + 20 + barHeight + gap },
  ];

  const maxTokenType = Math.max(totalInput, totalOutput, 1);

  return (
    <div className="overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="font-mono-accent"
        style={{ minWidth: 360 }}
      >
        {/* Column headers */}
        <text
          x={col1X + colWidth / 2}
          y={12}
          textAnchor="middle"
          className="fill-gray-400 dark:fill-gray-600"
          fontSize={10}
        >
          ~ models
        </text>
        <text
          x={col2X + colWidth / 2}
          y={12}
          textAnchor="middle"
          className="fill-gray-400 dark:fill-gray-600"
          fontSize={10}
        >
          ~ token type
        </text>
        <text
          x={col3X + colWidth / 2}
          y={12}
          textAnchor="middle"
          className="fill-gray-400 dark:fill-gray-600"
          fontSize={10}
        >
          ~ volume
        </text>

        {/* Model bars (left column) */}
        {modelBars.map((m) => (
          <g key={m.name}>
            <rect
              x={col1X}
              y={m.y}
              width={m.width}
              height={barHeight}
              rx={3}
              fill={m.color}
              opacity={0.8}
            />
            <text
              x={col1X + m.width + 6}
              y={m.y + barHeight / 2 + 4}
              fontSize={9}
              className="fill-gray-700 dark:fill-gray-300"
            >
              {m.name.length > 16 ? m.name.slice(0, 15) + "\u2026" : m.name}
            </text>
          </g>
        ))}

        {/* Flow lines from models to token types */}
        {modelBars.map((m) => {
          const startX = col1X + m.width;
          const startY = m.y + barHeight / 2;

          // Split flow: portion going to input vs output
          const inputRatio = m.total > 0 ? m.input / m.total : 0.5;

          return (
            <g key={`flow1-${m.name}`} opacity={0.3}>
              {/* Flow to input */}
              {m.input > 0 && (
                <path
                  d={`M ${startX} ${startY} C ${flow1X + flowWidth / 2} ${startY}, ${flow1X + flowWidth / 2} ${tokenTypes[0].y + barHeight / 2}, ${col2X} ${tokenTypes[0].y + barHeight / 2}`}
                  fill="none"
                  stroke={m.color}
                  strokeWidth={Math.max(inputRatio * 3, 0.5)}
                />
              )}
              {/* Flow to output */}
              {m.output > 0 && (
                <path
                  d={`M ${startX} ${startY} C ${flow1X + flowWidth / 2} ${startY}, ${flow1X + flowWidth / 2} ${tokenTypes[1].y + barHeight / 2}, ${col2X} ${tokenTypes[1].y + barHeight / 2}`}
                  fill="none"
                  stroke={m.color}
                  strokeWidth={Math.max((1 - inputRatio) * 3, 0.5)}
                />
              )}
            </g>
          );
        })}

        {/* Token type bars (middle column) */}
        {tokenTypes.map((t) => {
          const barW = Math.max((t.value / maxTokenType) * colWidth * 0.7, 8);
          return (
            <g key={t.label}>
              <rect
                x={col2X}
                y={t.y}
                width={barW}
                height={barHeight}
                rx={3}
                className={
                  t.label === "input"
                    ? "fill-emerald-500/70 dark:fill-emerald-400/70"
                    : "fill-indigo-500/70 dark:fill-indigo-400/70"
                }
              />
              <text
                x={col2X + barW + 6}
                y={t.y + barHeight / 2 + 4}
                fontSize={9}
                className="fill-gray-700 dark:fill-gray-300"
              >
                {t.label} ({formatTokens(t.value)})
              </text>
            </g>
          );
        })}

        {/* Flow lines from token types to volume (right column) */}
        {tokenTypes.map((t) => {
          const barW = Math.max((t.value / maxTokenType) * colWidth * 0.7, 8);
          const startX = col2X + barW;
          const startY = t.y + barHeight / 2;
          const endY = gap + 20 + barHeight / 2;
          return (
            <path
              key={`flow2-${t.label}`}
              d={`M ${startX} ${startY} C ${flow2X + flowWidth / 2} ${startY}, ${flow2X + flowWidth / 2} ${endY}, ${col3X} ${endY}`}
              fill="none"
              className={
                t.label === "input"
                  ? "stroke-emerald-500/30 dark:stroke-emerald-400/30"
                  : "stroke-indigo-500/30 dark:stroke-indigo-400/30"
              }
              strokeWidth={Math.max((t.value / (grandTotal || 1)) * 4, 0.5)}
            />
          );
        })}

        {/* Volume total (right column) */}
        <rect
          x={col3X}
          y={gap + 20}
          width={colWidth * 0.7}
          height={barHeight}
          rx={3}
          className="fill-gray-300/70 dark:fill-gray-700/70"
        />
        <text
          x={col3X + 8}
          y={gap + 20 + barHeight / 2 + 4}
          fontSize={10}
          fontWeight="bold"
          className="fill-gray-800 dark:fill-gray-200"
        >
          {formatTokens(grandTotal)} total
        </text>
      </svg>
    </div>
  );
}
