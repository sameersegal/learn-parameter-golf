"use client";

import { useState, useMemo, useCallback } from "react";

const INITIAL_SVS = [3.2, 1.8, 0.9, 0.4, 0.15, 0.05];
const SV_LABELS = ["σ₁", "σ₂", "σ₃", "σ₄", "σ₅", "σ₆"];
const ADAM_COLOR = "#60a5fa"; // blue-400
const MUON_COLOR = "#2dd4bf"; // teal-400
const MAX_SV_DISPLAY = 4.5; // max y-axis value for bar chart

interface OptimizerState {
  svs: number[];
  // Adam internals: first moment (m) and second moment (v) per singular value
  adamM: number[];
  adamV: number[];
}

function conditionNumber(svs: number[]): number {
  const max = Math.max(...svs);
  const min = Math.min(...svs);
  if (min < 1e-8) return Infinity;
  return max / min;
}

function formatCondition(val: number): string {
  if (!isFinite(val)) return "∞";
  return val.toFixed(1);
}

/** Simulate one Adam step on singular values */
function adamStep(state: OptimizerState, lr: number): OptimizerState {
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;

  const newSvs: number[] = [];
  const newM: number[] = [];
  const newV: number[] = [];

  for (let i = 0; i < state.svs.length; i++) {
    const sv = state.svs[i];
    // Gradient: larger SVs get proportionally larger gradients (loss pulls them down)
    // This models the typical case where large singular values dominate the gradient
    const grad = sv * 0.3 + 0.05; // proportional + small constant

    // Update moments
    const m = beta1 * state.adamM[i] + (1 - beta1) * grad;
    const v = beta2 * state.adamV[i] + (1 - beta2) * grad * grad;

    // Adam's per-element scaling: sqrt(v) normalizes by gradient magnitude
    // This means large-gradient directions get relatively smaller updates,
    // but the imbalance in SVs persists and can grow due to the proportional gradient
    const update = lr * m / (Math.sqrt(v) + eps);

    // The key effect: Adam doesn't equalize — large SVs stay large, small stay small
    // We simulate a loss that wants SVs near 1.0
    const target = 1.0;
    const direction = sv > target ? -1 : 1;
    const newSv = Math.max(0.01, sv + direction * update * 0.4);

    newSvs.push(newSv);
    newM.push(m);
    newV.push(v);
  }

  return { svs: newSvs, adamM: newM, adamV: newV };
}

/** Simulate one Muon step on singular values.
 *  Muon orthogonalizes the gradient via Newton-Schulz, making all singular values
 *  of the update matrix equal to 1. This acts as a spectral equalizer. */
function muonStep(svs: number[], stepSize: number): number[] {
  return svs.map((sv) => {
    // Muon moves every singular value toward 1.0 by the same fixed step
    const diff = 1.0 - sv;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), stepSize);
    return Math.max(0.01, sv + step);
  });
}

function BarChart({
  svs,
  color,
  label,
  width,
  height,
}: {
  svs: number[];
  color: string;
  label: string;
  width: number;
  height: number;
}) {
  const padding = { top: 24, bottom: 32, left: 8, right: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barGap = 6;
  const barWidth = (chartW - barGap * (svs.length - 1)) / svs.length;

  // Reference line at sv=1.0
  const refY = padding.top + chartH * (1 - 1.0 / MAX_SV_DISPLAY);

  return (
    <svg width={width} height={height} className="block">
      {/* Title */}
      <text
        x={width / 2}
        y={16}
        textAnchor="middle"
        fill={color}
        fontSize={13}
        fontWeight={600}
      >
        {label}
      </text>

      {/* Reference line at σ=1 */}
      <line
        x1={padding.left}
        y1={refY}
        x2={width - padding.right}
        y2={refY}
        stroke="var(--muted)"
        strokeDasharray="4 3"
        strokeWidth={1}
        opacity={0.4}
      />
      <text
        x={width - padding.right + 1}
        y={refY + 3}
        fill="var(--muted)"
        fontSize={9}
        textAnchor="start"
        opacity={0.6}
      >
      </text>

      {/* Bars */}
      {svs.map((sv, i) => {
        const barH = Math.min((sv / MAX_SV_DISPLAY) * chartH, chartH);
        const x = padding.left + i * (barWidth + barGap);
        const y = padding.top + chartH - barH;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={3}
              fill={color}
              opacity={0.75}
            />
            {/* Value label on bar */}
            <text
              x={x + barWidth / 2}
              y={y - 4}
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize={10}
              fontFamily="monospace"
            >
              {sv.toFixed(2)}
            </text>
            {/* SV label below */}
            <text
              x={x + barWidth / 2}
              y={padding.top + chartH + 16}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={11}
            >
              {SV_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function MuonVsAdamDemo() {
  const [step, setStep] = useState(0);
  const [adamState, setAdamState] = useState<OptimizerState>({
    svs: [...INITIAL_SVS],
    adamM: new Array(INITIAL_SVS.length).fill(0),
    adamV: new Array(INITIAL_SVS.length).fill(0),
  });
  const [muonSvs, setMuonSvs] = useState<number[]>([...INITIAL_SVS]);

  const lr = 0.08;
  const muonStepSize = 0.18;

  const handleStep = useCallback(() => {
    setAdamState((prev) => adamStep(prev, lr));
    setMuonSvs((prev) => muonStep(prev, muonStepSize));
    setStep((prev) => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setAdamState({
      svs: [...INITIAL_SVS],
      adamM: new Array(INITIAL_SVS.length).fill(0),
      adamV: new Array(INITIAL_SVS.length).fill(0),
    });
    setMuonSvs([...INITIAL_SVS]);
    setStep(0);
  }, []);

  const adamCondition = useMemo(
    () => conditionNumber(adamState.svs),
    [adamState.svs]
  );
  const muonCondition = useMemo(() => conditionNumber(muonSvs), [muonSvs]);

  // Chart dimensions
  const chartWidth = 260;
  const chartHeight = 200;

  return (
    <div>
      <p className="text-sm text-[var(--muted)] mb-4">
        Click <strong>Step</strong> to advance both optimizers. Watch how Adam
        preserves spectral imbalance while Muon equalizes singular values toward
        1.
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleStep}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-[var(--accent)] text-[var(--background)] hover:opacity-90 transition-opacity"
        >
          Step
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-1.5 rounded-md text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
        >
          Reset
        </button>
        <span className="text-sm text-[var(--muted)] ml-auto font-mono">
          Step {step}
        </span>
      </div>

      {/* Side-by-side charts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0d1117] rounded-lg p-3 flex flex-col items-center">
          <BarChart
            svs={adamState.svs}
            color={ADAM_COLOR}
            label="Adam"
            width={chartWidth}
            height={chartHeight}
          />
          <div className="mt-2 text-center">
            <div className="text-[10px] text-[var(--muted)]">
              Condition Number (σ<sub>max</sub>/σ<sub>min</sub>)
            </div>
            <div
              className="font-mono font-bold text-base"
              style={{ color: ADAM_COLOR }}
            >
              {formatCondition(adamCondition)}
            </div>
          </div>
        </div>

        <div className="bg-[#0d1117] rounded-lg p-3 flex flex-col items-center">
          <BarChart
            svs={muonSvs}
            color={MUON_COLOR}
            label="Muon"
            width={chartWidth}
            height={chartHeight}
          />
          <div className="mt-2 text-center">
            <div className="text-[10px] text-[var(--muted)]">
              Condition Number (σ<sub>max</sub>/σ<sub>min</sub>)
            </div>
            <div
              className="font-mono font-bold text-base"
              style={{ color: MUON_COLOR }}
            >
              {formatCondition(muonCondition)}
            </div>
          </div>
        </div>
      </div>

      {/* Legend / insight */}
      <div className="text-xs text-[var(--muted)] text-center">
        Dashed line = σ = 1.0 (ideal orthonormal target)
      </div>
    </div>
  );
}
