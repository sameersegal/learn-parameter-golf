"use client";

import { useState, useMemo, useCallback } from "react";

const INITIAL_SINGULAR_VALUES = [2.5, 1.6, 0.8, 0.3, 0.1];
const NORMALIZATION_FACTOR = 3.0;
const MAX_ITERATIONS = 5;
const LABELS = ["σ₁", "σ₂", "σ₃", "σ₄", "σ₅"];

// Newton-Schulz step: σ_new = σ * (3 - σ²) / 2
// This is the scalar form of X_{k+1} = X_k(3I - X_k^T X_k) / 2
// applied independently to each singular value
function newtonSchulzStep(sigmas: number[]): number[] {
  return sigmas.map((s) => s * (3 - s * s) / 2);
}

// Color interpolation: green when close to 1.0, warm orange/red when far
function sigmaColor(sigma: number): string {
  const dist = Math.min(Math.abs(sigma - 1.0), 1.0);
  const r = Math.round(40 + dist * 215);
  const g = Math.round(200 - dist * 140);
  const b = Math.round(80 - dist * 40);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function NewtonSchulzDemo() {
  const [iteration, setIteration] = useState(0);
  const [history, setHistory] = useState<number[][]>([
    INITIAL_SINGULAR_VALUES.map((v) => v / NORMALIZATION_FACTOR),
  ]);

  const currentSigmas = history[history.length - 1];
  const converged = iteration >= MAX_ITERATIONS;
  const maxError = Math.max(...currentSigmas.map((s) => Math.abs(s - 1.0)));

  const handleStep = useCallback(() => {
    if (converged) return;
    setHistory((prev) => [...prev, newtonSchulzStep(prev[prev.length - 1])]);
    setIteration((prev) => prev + 1);
  }, [converged]);

  const handleReset = useCallback(() => {
    setIteration(0);
    setHistory([INITIAL_SINGULAR_VALUES.map((v) => v / NORMALIZATION_FACTOR)]);
  }, []);

  // SVG dimensions
  const svgWidth = 500;
  const svgHeight = 250;
  const margin = { top: 30, right: 65, bottom: 28, left: 40 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;
  const barHeight = chartHeight / 5 - 6;

  // Scale: domain [0, 1.15] -> [0, chartWidth]
  const maxDomain = 1.15;
  const xScale = (v: number) => Math.max(0, (v / maxDomain) * chartWidth);
  const targetX = xScale(1.0);

  // Convergence history sparkline data for the mini chart
  const sparkData = useMemo(() => {
    return history.map((sigmas) =>
      Math.max(...sigmas.map((s) => Math.abs(s - 1.0)))
    );
  }, [history]);

  return (
    <div>
      {/* Formula */}
      <div className="text-center mb-4">
        <span
          className="font-mono text-xs sm:text-sm inline-block px-3 py-1.5 rounded"
          style={{ backgroundColor: "#1a1a2e", color: "#94a3b8" }}
        >
          X<sub>k+1</sub> = X<sub>k</sub>(3I − X<sub>k</sub>
          <sup>⊤</sup>X<sub>k</sub>) / 2 &nbsp;→&nbsp; per σ: σ′ = σ(3 −
          σ²) / 2
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Iteration</div>
          <div className="font-mono font-bold text-lg">
            {iteration}
            <span className="text-xs font-normal text-[var(--muted)]">
              {" "}
              / {MAX_ITERATIONS}
            </span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Max |σ − 1|</div>
          <div className="font-mono font-bold text-lg">
            {maxError < 0.00005 ? "≈ 0" : maxError.toFixed(4)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Status</div>
          <div
            className="font-mono font-bold text-lg"
            style={{ color: converged ? "#48bb78" : "#ecc94b" }}
          >
            {converged ? "Converged!" : "Iterating…"}
          </div>
        </div>
      </div>

      {/* SVG bar chart */}
      <div
        className="rounded-lg overflow-hidden mb-4"
        style={{ backgroundColor: "#0d1117" }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          style={{ display: "block" }}
        >
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Subtle vertical grid lines */}
            {[0.2, 0.4, 0.6, 0.8].map((tick) => (
              <line
                key={`grid-${tick}`}
                x1={xScale(tick)}
                y1={0}
                x2={xScale(tick)}
                y2={chartHeight}
                stroke="#1e293b"
                strokeWidth={0.5}
              />
            ))}

            {/* Target line at σ = 1.0 */}
            <line
              x1={targetX}
              y1={-10}
              x2={targetX}
              y2={chartHeight + 4}
              stroke="#48bb78"
              strokeWidth={1.5}
              strokeDasharray="6,3"
              opacity={0.7}
            />
            <text
              x={targetX}
              y={-14}
              fill="#48bb78"
              fontSize={10}
              textAnchor="middle"
              fontFamily="monospace"
            >
              σ = 1.0 (orthogonal)
            </text>

            {/* X-axis ticks */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((tick) => (
              <g key={tick}>
                <line
                  x1={xScale(tick)}
                  y1={chartHeight}
                  x2={xScale(tick)}
                  y2={chartHeight + 4}
                  stroke="#4a5568"
                  strokeWidth={0.5}
                />
                <text
                  x={xScale(tick)}
                  y={chartHeight + 16}
                  fill="#64748b"
                  fontSize={9}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}

            {/* Bars */}
            {currentSigmas.map((sigma, i) => {
              const y = i * (chartHeight / 5) + 3;
              const barW = Math.max(2, xScale(Math.min(sigma, maxDomain)));
              const color = sigmaColor(sigma);
              return (
                <g key={i}>
                  {/* Row label */}
                  <text
                    x={-6}
                    y={y + barHeight / 2 + 4}
                    fill="#94a3b8"
                    fontSize={11}
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {LABELS[i]}
                  </text>
                  {/* Bar -- CSS transition animates width and fill color */}
                  <rect
                    x={0}
                    y={y}
                    width={barW}
                    height={barHeight}
                    rx={3}
                    fill={color}
                    opacity={0.9}
                    style={{
                      transition: "width 0.45s ease-out, fill 0.45s ease-out",
                    }}
                  />
                  {/* Value label -- positioned via transform for smooth animation */}
                  <text
                    x={0}
                    y={y + barHeight / 2 + 4}
                    fill="#e2e8f0"
                    fontSize={11}
                    fontFamily="monospace"
                    style={{
                      transition: "transform 0.45s ease-out",
                      transform: `translateX(${barW + 6}px)`,
                    }}
                  >
                    {sigma.toFixed(4)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Convergence sparkline: shows max error at each iteration */}
      {history.length > 1 && (
        <div className="mb-4">
          <div className="text-xs text-[var(--muted)] mb-1">
            Convergence (max error per iteration)
          </div>
          <div
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: "#0d1117",
              height: "48px",
              position: "relative",
            }}
          >
            <svg
              viewBox={`0 0 200 40`}
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              style={{ display: "block" }}
            >
              {/* Sparkline path */}
              <polyline
                fill="none"
                stroke="#48bb78"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={sparkData
                  .map((err, i) => {
                    const x = (i / MAX_ITERATIONS) * 190 + 5;
                    // Log scale for visibility: map [0, ~0.97] to [35, 5]
                    const logErr =
                      err > 0.00001 ? Math.log10(err) : Math.log10(0.00001);
                    const logMin = Math.log10(0.00001);
                    const logMax = Math.log10(1.0);
                    const y =
                      5 + ((logErr - logMax) / (logMin - logMax)) * 30;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
              {/* Dots at each iteration */}
              {sparkData.map((err, i) => {
                const x = (i / MAX_ITERATIONS) * 190 + 5;
                const logErr =
                  err > 0.00001 ? Math.log10(err) : Math.log10(0.00001);
                const logMin = Math.log10(0.00001);
                const logMax = Math.log10(1.0);
                const y =
                  5 + ((logErr - logMax) / (logMin - logMax)) * 30;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={3}
                    fill="#48bb78"
                    opacity={i === sparkData.length - 1 ? 1 : 0.5}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleStep}
          disabled={converged}
          className="px-4 py-2 rounded font-mono text-sm font-bold"
          style={{
            backgroundColor: converged ? "#2d3748" : "#4299e1",
            color: converged ? "#718096" : "#fff",
            cursor: converged ? "not-allowed" : "pointer",
            border: "none",
          }}
        >
          Next Iteration
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded font-mono text-sm font-bold"
          style={{
            backgroundColor: "#2d3748",
            color: "#e2e8f0",
            cursor: "pointer",
            border: "1px solid #4a5568",
          }}
        >
          Reset
        </button>
      </div>

      {/* Initial values footnote */}
      <div className="text-center mt-3">
        <span className="text-xs text-[var(--muted)]">
          Initial singular values [{INITIAL_SINGULAR_VALUES.join(", ")}]
          normalized by ÷{NORMALIZATION_FACTOR} for convergence
        </span>
      </div>
    </div>
  );
}
