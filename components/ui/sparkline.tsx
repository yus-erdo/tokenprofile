"use client";

interface SparklineProps {
  /** Array of numeric values to display */
  data: number[];
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Override color (otherwise auto: green=up, red=down, gray=flat) */
  color?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  color,
  className = "",
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          className="text-gray-300 dark:text-gray-700"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  const innerHeight = height - padding * 2;
  const stepX = (width - padding * 2) / (data.length - 1);

  const points = data.map((val, i) => {
    const x = padding + i * stepX;
    const y = padding + innerHeight - ((val - min) / range) * innerHeight;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  // Determine trend color
  const first = data.slice(0, Math.ceil(data.length / 2));
  const second = data.slice(Math.ceil(data.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const diff = avgSecond - avgFirst;
  const threshold = range * 0.05;

  let strokeColor = color;
  if (!strokeColor) {
    if (diff > threshold) {
      strokeColor = "#10b981"; // emerald-500 (up)
    } else if (diff < -threshold) {
      strokeColor = "#ef4444"; // red-500 (down)
    } else {
      strokeColor = "#9ca3af"; // gray-400 (flat)
    }
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on the last point */}
      <circle
        cx={padding + (data.length - 1) * stepX}
        cy={padding + innerHeight - ((data[data.length - 1] - min) / range) * innerHeight}
        r={1.5}
        fill={strokeColor}
      />
    </svg>
  );
}
