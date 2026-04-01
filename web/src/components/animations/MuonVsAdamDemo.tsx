"use client";

import { useState, useMemo, useCallback } from "react";

const INITIAL_SVS = [3.2, 1.8, 0.9, 0.4, 0.15, 0.05];
const SV_LABELS = ["σ₁", "σ₂", "σ₃", "σ₄", "σ₅", "σ₆"];
const ADAM_COLOR = "#60a5fa"; // blue-400
const MUON_COLOR = "#2dd4bf"; // teal-400

interface AdamState {
  svs: number[];
  m: number[]; // first moment estimates
  v: number[]; // second moment estimates
  t: number; // timestep for bias correction
}

function conditionNumber(svs: number[]): number {
  const max = Math.max(...svs);
  const min = Math.min(...svs);
  if (min < 1e-6) return Infinity;
  return max / min;
}

function formatCondition(val: number): string {
  if (!isFinite(val)) return "∞";
  if (val > 999) return val.toFixed(0);
  return val.toFixed(1);
}

/**
 * Adam update on singular values.
 *
 * Key insight: Adam normalizes gradients by their own RMS, which removes
 * magnitude information. When gradients are proportional to SV magnitude
 * (as with weight decay or typical loss landscapes), Adam's normalization
 * causes it to apply roughly equal-sized updates regardless of SV size.
 * This sounds good, but it means Adam can't efficiently correct spectral
 * imbalance — large SVs shrink slowly relative to their size, while
 * small SVs can overshoot or oscillate. The condition number stagnates
 * or grows.
 */
function adamStep(state: AdamState, lr: number): AdamState {
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;
  const t = state.t + 1;

  const newSvs: number[] = [];
  const newM: number[] = [];
  const newV: number[] = [];

  for (let i = 0; i < state.svs.length; i++) {
    const sv = state.svs[i];

    // Gradient toward target=1: includes a component proportional to sv magnitude
    // simulating that larger singular values produce larger gradient norms
    const rawGrad = (sv - 1.0) * 0.5 + (sv > 1 ? 0.1 * sv : -0.02);

    // Update biased moments
    const m = beta1 * state.m[i] + (1 - beta1) * rawGrad;
    const v = beta2 * state.v[i] + (1 - beta2) * rawGrad * rawGrad;

    // Bias-corrected moments
    const mHat = m / (1 - Math.pow(beta1, t));
    const vHat = v / (1 - Math.pow(beta2, t));

    // Adam update: division by sqrt(vHat) normalizes away gradient magnitude
    // For large SVs: large grad / large sqrt(v) ≈ moderate step
    // For small SVs: small grad / small sqrt(v) ≈ moderate step
    // Result: all SVs move at similar absolute rates, but large SVs need
    // proportionally bigger corrections — so imbalance persists
    const update = lr * mHat / (Math.sqrt(vHat) + eps);
    const newSv = Math.max(0.01, sv - update);

    newSvs.push(newSv);
    newM.push(m);
    newV.push(v);
  }

  return { svs: newSvs, m: newM, v: newV, t };
}

/**
 * Muon update on singular values.
 *
 * Muon orthogonalizes the gradient via Newton-Schulz iterations, which
 * maps all singular values of the gradient to exactly 1. This means the
 * update matrix has uniform spectral norm in every direction. The effect
 * is that each singular value of the weight matrix gets steered toward
 * 1.0 with a step proportional to how far it is — a spectral equalizer.
 */
function muonStep(svs: number[], stepSize: number): number[] {
  return svs.map((sv) => {
    // Muon's orthogonalized update pushes all SVs toward 1.0
    // The step is proportional to the distance from 1.0
    const diff = 1.0 - sv;
    const step = diff * stepSize;
    return Math.max(0.01, sv + step);
  });
}

function BarChart({
  svs,
  color,
  label,
  maxVal,
}: {
  svs: number[];
  color: string;
  label: string;
  maxVal: number;
}) {
  const padding = { top: 28, bottom: 34, left: 4, right: 4 };

  return (
    <svg
      viewBox="0 0 260 210"
      className="w-full h-auto block"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Title */}
      <text
        x={130}
        y={18}
        textAnchor="middle"
        fill={color}
        fontSize={14}
        fontWeight={600}
      >
        {label}
      </text>

      {(() => {
        const chartW = 260 - padding.left - padding.right;
        const chartH = 210 - padding.top - padding.bottom;
        const barGap = 6;
        const barWidth =
          (chartW - barGap * (svs.length - 1)) / svs.length;

        // Reference line at sv=1.0
        const refY = padding.top + chartH * (1 - 1.0 / maxVal);

        return (
          <>
            {/* Reference line at σ=1 */}
            <line
              x1={padding.left}
              y1={refY}
              x2={260 - padding.right}
              y2={refY}
              stroke="currentColor"
              strokeDasharray="4 3"
              strokeWidth={1}
              opacity={0.2}
            />
            <text
              x={260 - padding.right - 2}
              y={refY - 4}
              textAnchor="end"
              fill="currentColor"
              fontSize={9}
              opacity={0.35}
            >
              σ=1
            </text>

            {/* Bars */}
            {svs.map((sv, i) => {
              const clampedSv = Math.min(sv, maxVal);
              const barH = Math.max(
                2,
                (clampedSv / maxVal) * chartH
              );
              const x =
                padding.left + i * (barWidth + barGap);
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
                    opacity={0.8}
                  />
                  {/* Value label above bar */}
                  <text
                    x={x + barWidth / 2}
                    y={Math.max(y - 5, padding.top + 4)}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize={10}
                    fontFamily="ui-monospace, monospace"
                  >
                    {sv.toFixed(2)}
                  </text>
                  {/* SV label below */}
                  <text
                    x={x + barWidth / 2}
                    y={padding.top + chartH + 18}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize={11}
                    opacity={0.5}
                  >
                    {SV_LABELS[i]}
                  </text>
                </g>
              );
            })}
          </>
        );
      })()}
    </svg>
  );
}

export default function MuonVsAdamDemo() {
  const [step, setStep] = useState(0);
  const [adamState, setAdamState] = useState<AdamState>({
    svs: [...INITIAL_SVS],
    m: new Array(INITIAL_SVS.length).fill(0),
    v: new Array(INITIAL_SVS.length).fill(0),
    t: 0,
  });
  const [muonSvs, setMuonSvs] = useState<number[]>([...INITIAL_SVS]);

  const adamLr = 0.15;
  const muonStepSize = 0.22;

  const handleStep = useCallback(() => {
    setAdamState((prev) => adamStep(prev, adamLr));
    setMuonSvs((prev) => muonStep(prev, muonStepSize));
    setStep((prev) => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setAdamState({
      svs: [...INITIAL_SVS],
      m: new Array(INITIAL_SVS.length).fill(0),
      v: new Array(INITIAL_SVS.length).fill(0),
      t: 0,
    });
    setMuonSvs([...INITIAL_SVS]);
    setStep(0);
  }, []);

  const adamCondition = useMemo(
    () => conditionNumber(adamState.svs),
    [adamState.svs]
  );
  const muonCondition = useMemo(() => conditionNumber(muonSvs), [muonSvs]);

  // Dynamic y-axis: accommodate growth in Adam SVs
  const maxVal = useMemo(() => {
    const allMax = Math.max(...adamState.svs, ...muonSvs);
    return Math.max(4.0, Math.ceil(allMax + 0.5));
  }, [adamState.svs, muonSvs]);

  return (
    <div>
      <p className="text-sm text-[var(--muted)] mb-4">
        Click <strong>Step</strong> to advance both optimizers. Watch how Adam
        preserves spectral imbalance while Muon equalizes singular values
        toward 1.
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
            maxVal={maxVal}
          />
          <div className="mt-1 text-center">
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
            maxVal={maxVal}
          />
          <div className="mt-1 text-center">
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

      {/* Legend */}
      <div className="text-xs text-[var(--muted)] text-center">
        Dashed line = σ = 1.0 (ideal orthonormal target)
      </div>
    </div>
  );
}
