"use client";

import { useState } from "react";

const SEQ_LEN = 32;

// Interpolate between two hex colors
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

// Simulate BPB for a token given its context amount (0 to SEQ_LEN-1).
// More context = lower BPB. Uses a sqrt curve for diminishing returns.
function simulatedBpb(contextAmount: number): number {
  const maxBpb = 2.5;
  const minBpb = 0.8;
  const t = contextAmount / (SEQ_LEN - 1);
  return maxBpb - (maxBpb - minBpb) * Math.sqrt(t);
}

const LOW_CONTEXT_COLOR = "#ef4444";
const HIGH_CONTEXT_COLOR = "#22c55e";
const SCORED_BORDER = "#facc15";
const INACTIVE_BG = "#1e293b";

export default function ContextGradientDemo() {
  const [mode, setMode] = useState<"all" | "stride">("all");
  const [stride, setStride] = useState(8);

  // In "Score All" mode, stride equals seq_len (all tokens scored).
  // In "Score Last N" mode, only the last `stride` tokens are scored.
  const effectiveStride = mode === "all" ? SEQ_LEN : stride;
  const scoreStart = SEQ_LEN - effectiveStride;

  // Stats for scored tokens
  const scoredCount = effectiveStride;
  const minContext = scoreStart;
  const avgContext =
    scoredCount > 0
      ? Array.from({ length: scoredCount })
          .map((_, i) => scoreStart + i)
          .reduce((sum, idx) => sum + idx, 0) / scoredCount
      : 0;

  // Average BPB across scored tokens
  const avgBpb =
    scoredCount > 0
      ? Array.from({ length: scoredCount })
          .map((_, i) => simulatedBpb(scoreStart + i))
          .reduce((sum, bpb) => sum + bpb, 0) / scoredCount
      : 0;

  // Baseline: BPB when scoring all tokens
  const baselineBpb =
    Array.from({ length: SEQ_LEN })
      .map((_, i) => simulatedBpb(i))
      .reduce((sum, bpb) => sum + bpb, 0) / SEQ_LEN;

  const bpbImprovement = ((baselineBpb - avgBpb) / baselineBpb) * 100;

  // Compute cost: more overlapping windows needed when stride < seq_len
  const computeCost = SEQ_LEN / effectiveStride;

  return (
    <div>
      {/* Instruction */}
      <p className="text-sm text-[var(--muted)] mb-4">
        Each token in a window has different amounts of prior context. Early
        tokens (red) have little context and are hard to predict; late tokens
        (green) have full context. Switch scoring mode and adjust stride to see
        how it affects average loss.
      </p>

      {/* Mode toggle */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <label className="text-sm font-medium">Scoring mode:</label>
        <button
          onClick={() => setMode("all")}
          className="px-3 py-1 rounded text-sm transition-colors"
          style={{
            backgroundColor: mode === "all" ? "#facc15" : "var(--border)",
            color: mode === "all" ? "#000" : "inherit",
            fontWeight: mode === "all" ? 600 : 400,
          }}
        >
          Score All (stride = seq_len)
        </button>
        <button
          onClick={() => setMode("stride")}
          className="px-3 py-1 rounded text-sm transition-colors"
          style={{
            backgroundColor: mode === "stride" ? "#22c55e" : "var(--border)",
            color: mode === "stride" ? "#000" : "inherit",
            fontWeight: mode === "stride" ? 600 : 400,
          }}
        >
          Score Last N (stride = N)
        </button>
      </div>

      {/* Stride slider (only in stride mode) */}
      {mode === "stride" && (
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-medium whitespace-nowrap">
            Stride:
          </label>
          <input
            type="range"
            min={1}
            max={SEQ_LEN}
            value={stride}
            onChange={(e) => setStride(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="font-mono font-bold text-lg w-8 text-right">
            {stride}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Scored</div>
          <div className="font-mono font-bold">
            {scoredCount}/{SEQ_LEN}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Min Context</div>
          <div className="font-mono font-bold">{minContext}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Avg Context</div>
          <div className="font-mono font-bold">{avgContext.toFixed(0)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Avg BPB</div>
          <div
            className="font-mono font-bold"
            style={{
              color: lerpColor(
                LOW_CONTEXT_COLOR,
                HIGH_CONTEXT_COLOR,
                1 - (avgBpb - 0.8) / (2.5 - 0.8)
              ),
            }}
          >
            {avgBpb.toFixed(3)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">BPB Impact</div>
          <div
            className="font-mono font-bold"
            style={{
              color: bpbImprovement > 0.1 ? "#22c55e" : "inherit",
            }}
          >
            {bpbImprovement > 0.1 ? "-" : ""}
            {Math.abs(bpbImprovement).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Token visualization */}
      <div className="mb-2">
        <div className="text-xs text-[var(--muted)] mb-1">
          Window tokens ({SEQ_LEN} total, representing a 1024-token window)
        </div>
        <div className="flex gap-px flex-wrap">
          {Array.from({ length: SEQ_LEN }).map((_, i) => {
            const isScored = i >= scoreStart;
            const contextFraction = i / (SEQ_LEN - 1);
            const color = lerpColor(
              LOW_CONTEXT_COLOR,
              HIGH_CONTEXT_COLOR,
              contextFraction
            );

            return (
              <div
                key={i}
                className="transition-all duration-200"
                style={{
                  width: "12px",
                  height: "24px",
                  backgroundColor: isScored ? color : INACTIVE_BG,
                  borderBottom: `2px solid ${isScored ? SCORED_BORDER : "transparent"}`,
                  borderRadius: "2px",
                  opacity: isScored ? 1 : 0.3,
                }}
                title={`Token ${i} | Context: ${i} tokens | BPB: ${simulatedBpb(i).toFixed(3)}${isScored ? " (scored)" : " (not scored)"}`}
              />
            );
          })}
        </div>
      </div>

      {/* Context bars (staircase) */}
      <div className="mb-4">
        <div className="text-xs text-[var(--muted)] mb-1">
          Context available per token
        </div>
        <div
          className="flex gap-px flex-wrap items-end"
          style={{ height: "32px" }}
        >
          {Array.from({ length: SEQ_LEN }).map((_, i) => {
            const isScored = i >= scoreStart;
            const contextFraction = i / (SEQ_LEN - 1);
            const barHeight = Math.max(1, contextFraction * 28 + 2);
            const color = lerpColor(
              LOW_CONTEXT_COLOR,
              HIGH_CONTEXT_COLOR,
              contextFraction
            );

            return (
              <div
                key={i}
                className="transition-all duration-200"
                style={{
                  width: "12px",
                  height: `${barHeight}px`,
                  backgroundColor: isScored ? color : "#334155",
                  borderRadius: "1px 1px 0 0",
                  opacity: isScored ? 1 : 0.3,
                }}
                title={`Token ${i}: ${i} tokens of context`}
              />
            );
          })}
        </div>
      </div>

      {/* BPB per token (taller bars = worse loss) */}
      <div className="mb-4">
        <div className="text-xs text-[var(--muted)] mb-1">
          Per-token BPB (taller = worse prediction)
        </div>
        <div
          className="flex gap-px flex-wrap items-end"
          style={{ height: "40px" }}
        >
          {Array.from({ length: SEQ_LEN }).map((_, i) => {
            const isScored = i >= scoreStart;
            const bpb = simulatedBpb(i);
            const barHeight = (bpb / 2.5) * 36 + 2;
            const contextFraction = i / (SEQ_LEN - 1);
            const color = lerpColor(
              LOW_CONTEXT_COLOR,
              HIGH_CONTEXT_COLOR,
              contextFraction
            );

            return (
              <div
                key={i}
                className="transition-all duration-200"
                style={{
                  width: "12px",
                  height: `${barHeight}px`,
                  backgroundColor: isScored ? color : "#334155",
                  borderRadius: "1px 1px 0 0",
                  opacity: isScored ? 0.8 : 0.2,
                }}
                title={`Token ${i}: BPB = ${bpb.toFixed(3)}`}
              />
            );
          })}
        </div>
      </div>

      {/* Summary callout */}
      <div
        className="text-sm p-2 rounded mb-3"
        style={{
          backgroundColor: "var(--border)",
          borderLeft: `3px solid ${mode === "all" ? "#facc15" : "#22c55e"}`,
        }}
      >
        {mode === "all" ? (
          <span>
            Scoring all {SEQ_LEN} tokens. The red early tokens (with little
            context) drag the average BPB up to{" "}
            <span className="font-mono font-bold">{avgBpb.toFixed(3)}</span>.
          </span>
        ) : (
          <span>
            Scoring only the last {stride} tokens (stride = {stride}).
            Average BPB drops to{" "}
            <span className="font-mono font-bold">{avgBpb.toFixed(3)}</span>
            {bpbImprovement > 0.1 && (
              <span style={{ color: "#22c55e" }}>
                {" "}
                ({bpbImprovement.toFixed(1)}% lower)
              </span>
            )}
            , but requires{" "}
            <span className="font-mono font-bold">
              {computeCost.toFixed(1)}x
            </span>{" "}
            more compute (overlapping windows).
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-[var(--muted)] mt-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: LOW_CONTEXT_COLOR }}
          />
          Low context (high BPB)
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: HIGH_CONTEXT_COLOR }}
          />
          High context (low BPB)
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{
              backgroundColor: SCORED_BORDER,
              width: "12px",
              height: "3px",
              borderRadius: "1px",
            }}
          />
          Scored
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: INACTIVE_BG, opacity: 0.3 }}
          />
          Not scored
        </div>
      </div>
    </div>
  );
}
