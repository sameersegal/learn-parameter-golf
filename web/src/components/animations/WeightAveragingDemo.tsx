"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// --- Constants ---
const CANVAS_SIZE = 400;
const CENTER_X = 0; // Optimum in parameter space
const CENTER_Y = 0;
const VIEW_RANGE = 3.5; // Coordinate range [-3.5, 3.5]

const CHECKPOINT_COLOR = "#60a5fa"; // blue-400
const AVERAGE_COLOR = "#facc15"; // yellow-400
const OPTIMUM_COLOR = "#2dd4bf"; // teal-400
const CONTOUR_COLOR = "rgba(100, 140, 200, 0.15)";
const TRAIL_COLOR = "rgba(96, 165, 250, 0.25)";

// Ellipse parameters for the loss bowl (slightly elongated)
const ELLIPSE_A = 1.0; // x-axis scale
const ELLIPSE_B = 1.4; // y-axis scale (taller = narrower in y)

/** Compute loss value for contour levels */
function loss(x: number, y: number): number {
  return (x * ELLIPSE_A) ** 2 + (y * ELLIPSE_B) ** 2;
}

/** Convert parameter-space coords to canvas pixel coords */
function toCanvas(x: number, y: number, size: number): [number, number] {
  const scale = size / (2 * VIEW_RANGE);
  return [size / 2 + x * scale, size / 2 - y * scale];
}

/** Generate a noisy SGD trajectory that orbits around the optimum */
function generateTrajectoryStep(
  prevX: number,
  prevY: number,
  step: number
): [number, number] {
  // Gradient descent component (pull toward center)
  const gradX = 2 * ELLIPSE_A * ELLIPSE_A * prevX;
  const gradY = 2 * ELLIPSE_B * ELLIPSE_B * prevY;
  const lr = 0.08;

  // Mini-batch noise
  const noiseScale = 0.35;
  const noiseX = (Math.random() - 0.5) * 2 * noiseScale;
  const noiseY = (Math.random() - 0.5) * 2 * noiseScale;

  // Slight oscillatory component to make trajectory interesting
  const oscX = 0.05 * Math.sin(step * 0.3);
  const oscY = 0.05 * Math.cos(step * 0.37);

  const newX = prevX - lr * gradX + noiseX + oscX;
  const newY = prevY - lr * gradY + noiseY + oscY;

  return [newX, newY];
}

interface Checkpoint {
  x: number;
  y: number;
  step: number;
}

export default function WeightAveragingDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"ema" | "swa">("swa");
  const [emaDecay, setEmaDecay] = useState(0.997);
  const [isPlaying, setIsPlaying] = useState(false);
  const [swaWindow] = useState(20); // fixed SWA window for clarity

  // Use refs for animation state to avoid re-render on every frame
  const checkpointsRef = useRef<Checkpoint[]>([]);
  const animFrameRef = useRef<number>(0);
  const stepCountRef = useRef(0);
  const frameCountRef = useRef(0);

  // Refs that mirror state for use in animation loop
  const modeRef = useRef(mode);
  const emaDecayRef = useRef(emaDecay);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { emaDecayRef.current = emaDecay; }, [emaDecay]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Display state (updated periodically to avoid excessive re-renders)
  const [displayInfo, setDisplayInfo] = useState({
    step: 0,
    currentDist: 0,
    avgDist: 0,
    numCheckpoints: 0,
  });

  const computeAverage = useCallback((
    checkpoints: Checkpoint[],
    currentMode: "ema" | "swa",
    decay: number,
    window: number
  ): [number, number] => {
    if (checkpoints.length === 0) return [0, 0];

    if (currentMode === "swa") {
      // SWA: equal average of last N checkpoints
      const start = Math.max(0, checkpoints.length - window);
      const subset = checkpoints.slice(start);
      const avgX = subset.reduce((s, c) => s + c.x, 0) / subset.length;
      const avgY = subset.reduce((s, c) => s + c.y, 0) / subset.length;
      return [avgX, avgY];
    } else {
      // EMA: exponential moving average
      let emaX = checkpoints[0].x;
      let emaY = checkpoints[0].y;
      for (let i = 1; i < checkpoints.length; i++) {
        emaX = decay * emaX + (1 - decay) * checkpoints[i].x;
        emaY = decay * emaY + (1 - decay) * checkpoints[i].y;
      }
      return [emaX, emaY];
    }
  }, []);

  const draw = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;

    // Set canvas resolution
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, size, size);

    // Draw contour lines (concentric ellipses)
    const contourLevels = [0.5, 1.0, 2.0, 3.5, 5.5, 8.0, 11.0, 15.0];
    const scale = size / (2 * VIEW_RANGE);
    for (const level of contourLevels) {
      const rx = Math.sqrt(level) / ELLIPSE_A * scale;
      const ry = Math.sqrt(level) / ELLIPSE_B * scale;
      ctx.beginPath();
      ctx.ellipse(size / 2, size / 2, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = CONTOUR_COLOR;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw optimum crosshair
    const [optX, optY] = toCanvas(CENTER_X, CENTER_Y, size);
    ctx.strokeStyle = OPTIMUM_COLOR;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    const crossSize = 8;
    ctx.beginPath();
    ctx.moveTo(optX - crossSize, optY);
    ctx.lineTo(optX + crossSize, optY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(optX, optY - crossSize);
    ctx.lineTo(optX, optY + crossSize);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Label for optimum
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = OPTIMUM_COLOR;
    ctx.textAlign = "left";
    ctx.fillText("optimum", optX + 12, optY - 4);

    const checkpoints = checkpointsRef.current;
    const currentMode = modeRef.current;
    const decay = emaDecayRef.current;

    if (checkpoints.length === 0) return;

    // Draw trail lines
    if (checkpoints.length > 1) {
      ctx.beginPath();
      const [sx, sy] = toCanvas(checkpoints[0].x, checkpoints[0].y, size);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < checkpoints.length; i++) {
        const [px, py] = toCanvas(checkpoints[i].x, checkpoints[i].y, size);
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = TRAIL_COLOR;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Determine which checkpoints contribute to the average
    const swaStart = currentMode === "swa"
      ? Math.max(0, checkpoints.length - swaWindow)
      : 0;

    // Draw checkpoints
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const [px, py] = toCanvas(cp.x, cp.y, size);

      let radius = 3;
      let alpha = 0.3;

      if (currentMode === "swa") {
        // SWA: last N checkpoints are highlighted equally
        if (i >= swaStart) {
          radius = 4;
          alpha = 0.85;
        }
      } else {
        // EMA: recent checkpoints are brighter/larger
        const age = checkpoints.length - 1 - i;
        const weight = Math.pow(decay, age);
        radius = 2 + weight * 4;
        alpha = 0.15 + weight * 0.75;
      }

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = CHECKPOINT_COLOR;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Compute and draw average point
    const [avgX, avgY] = computeAverage(checkpoints, currentMode, decay, swaWindow);
    const [apx, apy] = toCanvas(avgX, avgY, size);

    // Glow effect for average point
    ctx.beginPath();
    ctx.arc(apx, apy, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(250, 204, 21, 0.15)";
    ctx.fill();

    // Average point
    ctx.beginPath();
    ctx.arc(apx, apy, 7, 0, Math.PI * 2);
    ctx.fillStyle = AVERAGE_COLOR;
    ctx.fill();
    ctx.strokeStyle = "#0d1117";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label for average
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.fillStyle = AVERAGE_COLOR;
    ctx.textAlign = "left";
    ctx.fillText(currentMode === "swa" ? "SWA avg" : "EMA avg", apx + 12, apy + 4);

    // Draw dashed line from average to optimum
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(apx, apy);
    ctx.lineTo(optX, optY);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw current checkpoint highlight
    const latest = checkpoints[checkpoints.length - 1];
    const [lx, ly] = toCanvas(latest.x, latest.y, size);
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label for current
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";
    ctx.fillText("current", lx - 10, ly - 6);
  }, [computeAverage, swaWindow]);

  const reset = useCallback(() => {
    // Start from a point away from center
    checkpointsRef.current = [{
      x: 1.8 + (Math.random() - 0.5) * 0.5,
      y: -1.2 + (Math.random() - 0.5) * 0.5,
      step: 0,
    }];
    stepCountRef.current = 0;
    frameCountRef.current = 0;
    setIsPlaying(false);
    setDisplayInfo({ step: 0, currentDist: 0, avgDist: 0, numCheckpoints: 1 });

    const canvas = canvasRef.current;
    if (canvas) draw(canvas);
  }, [draw]);

  // Initialize on mount
  useEffect(() => {
    reset();
  }, [reset]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      frameCountRef.current++;

      // Add a new checkpoint every ~6 frames for visible pace
      if (frameCountRef.current % 6 === 0) {
        const prev = checkpointsRef.current[checkpointsRef.current.length - 1];
        stepCountRef.current++;
        const [nx, ny] = generateTrajectoryStep(prev.x, prev.y, stepCountRef.current);
        checkpointsRef.current.push({ x: nx, y: ny, step: stepCountRef.current });

        // Keep max 200 checkpoints to avoid clutter
        if (checkpointsRef.current.length > 200) {
          checkpointsRef.current = checkpointsRef.current.slice(-200);
        }

        // Update display info periodically
        const latest = checkpointsRef.current[checkpointsRef.current.length - 1];
        const currentDist = Math.sqrt(loss(latest.x, latest.y));
        const [avgX, avgY] = computeAverage(
          checkpointsRef.current, modeRef.current, emaDecayRef.current, swaWindow
        );
        const avgDist = Math.sqrt(loss(avgX, avgY));

        setDisplayInfo({
          step: stepCountRef.current,
          currentDist,
          avgDist,
          numCheckpoints: Math.min(
            checkpointsRef.current.length,
            modeRef.current === "swa" ? swaWindow : checkpointsRef.current.length
          ),
        });
      }

      const canvas = canvasRef.current;
      if (canvas) draw(canvas);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, draw, computeAverage, swaWindow]);

  // Redraw when mode or decay changes (while paused)
  useEffect(() => {
    if (!isPlaying && canvasRef.current) {
      draw(canvasRef.current);

      // Update display info
      const checkpoints = checkpointsRef.current;
      if (checkpoints.length > 0) {
        const latest = checkpoints[checkpoints.length - 1];
        const currentDist = Math.sqrt(loss(latest.x, latest.y));
        const [avgX, avgY] = computeAverage(checkpoints, mode, emaDecay, swaWindow);
        const avgDist = Math.sqrt(loss(avgX, avgY));
        setDisplayInfo((prev) => ({
          ...prev,
          currentDist,
          avgDist,
          numCheckpoints: Math.min(
            checkpoints.length,
            mode === "swa" ? swaWindow : checkpoints.length
          ),
        }));
      }
    }
  }, [mode, emaDecay, isPlaying, draw, computeAverage, swaWindow]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) draw(canvasRef.current);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <div>
      <p className="text-sm text-[var(--muted)] mb-4">
        Watch SGD checkpoints scatter around the loss valley. Their{" "}
        <strong>average</strong> (gold dot) lands closer to the optimum.
        Toggle between EMA and SWA to compare averaging strategies.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-[var(--accent)] text-[var(--background)] hover:opacity-90 transition-opacity"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={reset}
          className="px-4 py-1.5 rounded-md text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
        >
          Reset
        </button>

        {/* EMA / SWA toggle */}
        <div className="flex items-center gap-1 ml-auto rounded-md border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => setMode("swa")}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              mode === "swa"
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            SWA
          </button>
          <button
            onClick={() => setMode("ema")}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              mode === "ema"
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            EMA
          </button>
        </div>
      </div>

      {/* Mode-specific control */}
      {mode === "ema" && (
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium whitespace-nowrap">
            EMA decay:
          </label>
          <input
            type="range"
            min={950}
            max={999}
            value={Math.round(emaDecay * 1000)}
            onChange={(e) => setEmaDecay(parseInt(e.target.value) / 1000)}
            className="flex-1"
          />
          <span className="font-mono font-bold text-sm w-14 text-right">
            {emaDecay.toFixed(3)}
          </span>
        </div>
      )}
      {mode === "swa" && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-[var(--muted)]">
            Averaging last{" "}
            <span className="font-mono font-bold">
              {displayInfo.numCheckpoints}
            </span>{" "}
            of {swaWindow} checkpoints equally
          </span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative w-full" style={{ maxWidth: CANVAS_SIZE }}>
        <canvas
          ref={canvasRef}
          className="w-full rounded-lg"
          style={{ aspectRatio: "1 / 1" }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Step</div>
          <div className="font-mono font-bold">{displayInfo.step}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Current dist</div>
          <div className="font-mono font-bold" style={{ color: "#fff" }}>
            {displayInfo.currentDist.toFixed(3)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">
            {mode === "swa" ? "SWA" : "EMA"} avg dist
          </div>
          <div className="font-mono font-bold" style={{ color: AVERAGE_COLOR }}>
            {displayInfo.avgDist.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHECKPOINT_COLOR }} />
          Checkpoints
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: AVERAGE_COLOR }} />
          Average
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-0.5" style={{ backgroundColor: OPTIMUM_COLOR }} />
          Optimum
        </span>
      </div>
    </div>
  );
}
