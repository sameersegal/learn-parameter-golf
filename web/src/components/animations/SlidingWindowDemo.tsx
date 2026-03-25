"use client";

import { useState, useEffect, useCallback } from "react";

const TOTAL_TOKENS = 64;
const SEQ_LEN = 16;

export default function SlidingWindowDemo() {
  const [stride, setStride] = useState(4);
  const [windowStart, setWindowStart] = useState(0);
  const [playing, setPlaying] = useState(false);

  const windowEnd = Math.min(windowStart + SEQ_LEN, TOTAL_TOKENS);
  const scoreStart = windowStart === 0 ? 0 : windowEnd - stride;
  const overlap = SEQ_LEN - stride;
  const totalWindows = Math.ceil((TOTAL_TOKENS - SEQ_LEN) / stride) + 1;
  const currentWindow = Math.floor(windowStart / stride);

  const step = useCallback(() => {
    setWindowStart((prev) => {
      const next = prev + stride;
      if (next + SEQ_LEN > TOTAL_TOKENS + stride) return 0;
      return next;
    });
  }, [stride]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(step, 600);
    return () => clearInterval(id);
  }, [playing, step]);

  // Reset when stride changes
  useEffect(() => {
    setWindowStart(0);
    setPlaying(false);
  }, [stride]);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium">Stride:</label>
        <input
          type="range"
          min={1}
          max={16}
          value={stride}
          onChange={(e) => setStride(parseInt(e.target.value))}
          className="flex-1"
        />
        <span className="font-mono font-bold text-lg w-8 text-right">
          {stride}
        </span>
        <button
          onClick={() => setPlaying(!playing)}
          className="px-3 py-1 rounded bg-[var(--border)] text-sm hover:bg-[var(--muted)] transition-colors"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={step}
          className="px-3 py-1 rounded bg-[var(--border)] text-sm hover:bg-[var(--muted)] transition-colors"
        >
          Step
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Overlap</div>
          <div className="font-mono font-bold">
            {((overlap / SEQ_LEN) * 100).toFixed(0)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Windows</div>
          <div className="font-mono font-bold">{totalWindows}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Compute</div>
          <div className="font-mono font-bold">
            {(SEQ_LEN / stride).toFixed(1)}x
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Step</div>
          <div className="font-mono font-bold">
            {currentWindow + 1}/{totalWindows}
          </div>
        </div>
      </div>

      {/* Token visualization */}
      <div className="mb-2">
        <div className="text-xs text-[var(--muted)] mb-1">
          Document tokens ({TOTAL_TOKENS} total)
        </div>
        <div className="flex gap-px flex-wrap">
          {Array.from({ length: TOTAL_TOKENS }).map((_, i) => {
            const inWindow = i >= windowStart && i < windowEnd;
            const isScored = inWindow && i >= scoreStart;
            const isContext = inWindow && !isScored;

            let bg = "#1e293b"; // not in window
            let border = "transparent";
            if (isScored) {
              bg = "#facc15";
              border = "#facc15";
            } else if (isContext) {
              bg = "#334155";
              border = "#60a5fa";
            }

            return (
              <div
                key={i}
                className="transition-all duration-200"
                style={{
                  width: "12px",
                  height: "24px",
                  backgroundColor: bg,
                  borderBottom: `2px solid ${border}`,
                  borderRadius: "2px",
                  opacity: inWindow ? 1 : 0.3,
                }}
                title={`Token ${i}${isScored ? " (scored)" : isContext ? " (context)" : ""}`}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-[var(--muted)] mt-3">
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "#facc15" }}
          />
          Scored tokens (stride)
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{
              backgroundColor: "#334155",
              border: "1px solid #60a5fa",
            }}
          />
          Context only
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "#1e293b", opacity: 0.3 }}
          />
          Outside window
        </div>
      </div>
    </div>
  );
}
