"use client";

import { useState, useMemo } from "react";

function quantize(value: number, bits: number): number {
  const levels = Math.pow(2, bits);
  const step = 2.0 / (levels - 1); // range [-1, 1]
  const clamped = Math.max(-1, Math.min(1, value));
  const quantized = Math.round((clamped + 1) / step) * step - 1;
  return quantized;
}

export default function QuantizationDemo() {
  const [bits, setBits] = useState(8);

  // Generate sample values
  const sampleValues = useMemo(() => {
    const vals: number[] = [];
    for (let i = 0; i < 200; i++) {
      // Use a simple deterministic pseudo-random distribution
      const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      vals.push((x - Math.floor(x)) * 2 - 1);
    }
    return vals;
  }, []);

  const quantizedValues = useMemo(
    () => sampleValues.map((v) => quantize(v, bits)),
    [sampleValues, bits]
  );

  const errors = useMemo(
    () => sampleValues.map((v, i) => Math.abs(v - quantizedValues[i])),
    [sampleValues, quantizedValues]
  );

  const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const maxError = Math.max(...errors);
  const levels = Math.pow(2, bits);
  const bitsPerParam = bits;
  const compressionRatio = (32 / bitsPerParam).toFixed(1);

  // Build histogram of quantized values
  const histBins = 40;
  const histogram = useMemo(() => {
    const bins = new Array(histBins).fill(0);
    for (const v of quantizedValues) {
      const idx = Math.min(
        histBins - 1,
        Math.max(0, Math.floor(((v + 1) / 2) * histBins))
      );
      bins[idx]++;
    }
    const max = Math.max(...bins);
    return bins.map((c) => (max > 0 ? c / max : 0));
  }, [quantizedValues]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm font-medium">Bit-width:</label>
        <input
          type="range"
          min={1}
          max={16}
          value={bits}
          onChange={(e) => setBits(parseInt(e.target.value))}
          className="flex-1"
        />
        <span className="font-mono font-bold text-lg w-8 text-right">
          {bits}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Levels</div>
          <div className="font-mono font-bold">{levels.toLocaleString()}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Compression</div>
          <div className="font-mono font-bold">{compressionRatio}x</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Mean Error</div>
          <div className="font-mono font-bold">{meanError.toFixed(5)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Max Error</div>
          <div className="font-mono font-bold">{maxError.toFixed(5)}</div>
        </div>
      </div>

      {/* Number line visualization */}
      <div className="mb-6">
        <div className="text-xs text-[var(--muted)] mb-2">
          Number Line (first 50 values)
        </div>
        <div className="relative h-24 bg-[#0d1117] rounded-lg overflow-hidden">
          {/* Grid lines */}
          {Array.from({ length: Math.min(levels + 1, 33) }).map((_, i) => {
            const pos = (i / Math.min(levels, 32)) * 100;
            return (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-[var(--border)]"
                style={{ left: `${pos}%`, opacity: 0.3 }}
              />
            );
          })}
          {/* Original values (blue) */}
          {sampleValues.slice(0, 50).map((v, i) => (
            <div
              key={`orig-${i}`}
              className="absolute w-1 h-1 rounded-full bg-blue-400"
              style={{
                left: `${((v + 1) / 2) * 100}%`,
                top: `${20 + (i % 5) * 10}px`,
                opacity: 0.5,
              }}
            />
          ))}
          {/* Quantized values (yellow) */}
          {quantizedValues.slice(0, 50).map((v, i) => (
            <div
              key={`quant-${i}`}
              className="absolute w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
              style={{
                left: `${((v + 1) / 2) * 100}%`,
                top: `${50 + (i % 5) * 10}px`,
                opacity: 0.8,
              }}
            />
          ))}
          {/* Labels */}
          <div className="absolute left-1 top-1 text-[10px] text-blue-400">
            Original
          </div>
          <div className="absolute left-1 bottom-1 text-[10px] text-[var(--accent)]">
            Quantized
          </div>
        </div>
      </div>

      {/* Histogram */}
      <div>
        <div className="text-xs text-[var(--muted)] mb-2">
          Distribution of Quantized Values
        </div>
        <div className="flex items-end gap-px h-20 bg-[#0d1117] rounded-lg p-2">
          {histogram.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${h * 100}%`,
                backgroundColor:
                  h > 0 ? "var(--accent)" : "transparent",
                opacity: 0.7 + h * 0.3,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-[var(--muted)] mt-1">
          <span>-1.0</span>
          <span>0.0</span>
          <span>1.0</span>
        </div>
      </div>
    </div>
  );
}
