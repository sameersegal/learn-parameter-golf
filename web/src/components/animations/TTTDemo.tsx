"use client";

import { useState, useEffect, useCallback } from "react";

const NUM_CHUNKS = 8;

interface ChunkState {
  scored: boolean;
  trained: boolean;
  trainEpochs: number;
  loss: number;
  adaptedLoss: number;
}

function initialLoss(chunkIdx: number): number {
  // Simulate decreasing loss as model sees more data
  return 1.35 - chunkIdx * 0.015 + (Math.sin(chunkIdx * 2.1) * 0.02);
}

function adaptedLoss(baseLoss: number, epochs: number, method: string): number {
  // Simulate how TTT reduces loss per chunk
  const rate = method === "lora" ? 0.012 : 0.018;
  const improvement = rate * Math.sqrt(epochs);
  return Math.max(baseLoss - improvement, baseLoss * 0.88);
}

export default function TTTDemo() {
  const [method, setMethod] = useState<"full" | "lora">("full");
  const [maxEpochs, setMaxEpochs] = useState(10);
  const [chunks, setChunks] = useState<ChunkState[]>([]);
  const [activeChunk, setActiveChunk] = useState(-1);
  const [phase, setPhase] = useState<"idle" | "scoring" | "training">("idle");
  const [playing, setPlaying] = useState(false);
  const [trainProgress, setTrainProgress] = useState(0);

  // Initialize chunks
  useEffect(() => {
    setChunks(
      Array.from({ length: NUM_CHUNKS }, (_, i) => ({
        scored: false,
        trained: false,
        trainEpochs: 0,
        loss: initialLoss(i),
        adaptedLoss: initialLoss(i),
      }))
    );
    setActiveChunk(-1);
    setPhase("idle");
    setTrainProgress(0);
  }, [method, maxEpochs]);

  const step = useCallback(() => {
    setChunks((prev) => {
      const next = [...prev.map((c) => ({ ...c }))];

      if (phase === "idle") {
        // Start scoring the next chunk
        const nextIdx = prev.findIndex((c) => !c.scored);
        if (nextIdx === -1) {
          setPlaying(false);
          return prev;
        }
        setActiveChunk(nextIdx);
        setPhase("scoring");
        next[nextIdx].scored = true;
        return next;
      }

      if (phase === "scoring") {
        // Move to training phase
        setPhase("training");
        setTrainProgress(0);
        return prev;
      }

      if (phase === "training") {
        const idx = activeChunk;
        if (idx === -1) return prev;

        const newEpochs = next[idx].trainEpochs + Math.ceil(maxEpochs / 5);
        if (newEpochs >= maxEpochs) {
          next[idx].trainEpochs = maxEpochs;
          next[idx].trained = true;
          next[idx].adaptedLoss = adaptedLoss(next[idx].loss, maxEpochs, method);
          setPhase("idle");
          setTrainProgress(1);
          // Update subsequent chunk losses (model improved)
          for (let j = idx + 1; j < next.length; j++) {
            const improvement = method === "full" ? 0.008 : 0.005;
            next[j].loss = Math.max(
              next[j].loss - improvement * (idx + 1),
              0.92
            );
          }
        } else {
          next[idx].trainEpochs = newEpochs;
          next[idx].adaptedLoss = adaptedLoss(next[idx].loss, newEpochs, method);
          setTrainProgress(newEpochs / maxEpochs);
        }
        return next;
      }

      return prev;
    });
  }, [phase, activeChunk, maxEpochs, method]);

  useEffect(() => {
    if (!playing) return;
    const speed = phase === "training" ? 200 : 500;
    const id = setInterval(step, speed);
    return () => clearInterval(id);
  }, [playing, step, phase]);

  const avgOriginalLoss =
    chunks.filter((c) => c.scored).reduce((s, c) => s + c.loss, 0) /
      Math.max(chunks.filter((c) => c.scored).length, 1);
  const avgAdaptedLoss =
    chunks.filter((c) => c.trained).reduce((s, c) => s + c.adaptedLoss, 0) /
      Math.max(chunks.filter((c) => c.trained).length, 1);
  const improvement =
    chunks.some((c) => c.trained)
      ? (((avgOriginalLoss - avgAdaptedLoss) / avgOriginalLoss) * 100).toFixed(1)
      : "—";

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Method:</label>
          <button
            onClick={() => setMethod("full")}
            className={`px-3 py-1 rounded text-xs ${
              method === "full"
                ? "bg-[var(--accent)] text-black"
                : "bg-[var(--border)] text-[var(--muted)]"
            }`}
          >
            Full TTT
          </button>
          <button
            onClick={() => setMethod("lora")}
            className={`px-3 py-1 rounded text-xs ${
              method === "lora"
                ? "bg-[var(--accent)] text-black"
                : "bg-[var(--border)] text-[var(--muted)]"
            }`}
          >
            LoRA TTT
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Epochs:</label>
          <input
            type="range"
            min={3}
            max={30}
            value={maxEpochs}
            onChange={(e) => setMaxEpochs(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="font-mono text-sm w-6">{maxEpochs}</span>
        </div>
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
          <div className="text-xs text-[var(--muted)]">Params trained</div>
          <div className="font-mono font-bold text-sm">
            {method === "full" ? "~20M (81%)" : "~50K (0.4%)"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Pre-TTT BPB</div>
          <div className="font-mono font-bold">{avgOriginalLoss.toFixed(4)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Post-TTT BPB</div>
          <div className="font-mono font-bold">
            {chunks.some((c) => c.trained) ? avgAdaptedLoss.toFixed(4) : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--muted)]">Improvement</div>
          <div className="font-mono font-bold text-green-400">{improvement}%</div>
        </div>
      </div>

      {/* Chunks visualization */}
      <div className="space-y-2 mb-4">
        {chunks.map((chunk, i) => {
          const isActive = i === activeChunk;
          const barWidth =
            chunk.trained
              ? ((chunk.loss - chunk.adaptedLoss) / chunk.loss) * 100
              : chunk.trainEpochs > 0
                ? ((chunk.loss - chunk.adaptedLoss) / chunk.loss) * 100
                : 0;

          return (
            <div key={i} className="flex items-center gap-2">
              {/* Chunk label */}
              <div className="text-xs font-mono w-14 text-right text-[var(--muted)]">
                Chunk {i + 1}
              </div>

              {/* Status indicator */}
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 transition-all duration-300"
                style={{
                  backgroundColor: chunk.trained
                    ? "#10b981"
                    : isActive && phase === "training"
                      ? "#facc15"
                      : isActive && phase === "scoring"
                        ? "#60a5fa"
                        : chunk.scored
                          ? "#334155"
                          : "#1e293b",
                  boxShadow: isActive ? "0 0 8px rgba(250,204,21,0.5)" : "none",
                }}
              />

              {/* Loss bar */}
              <div className="flex-1 h-6 bg-[#0d1117] rounded overflow-hidden relative">
                {/* Original loss */}
                <div
                  className="absolute h-full bg-red-900/50 transition-all duration-300"
                  style={{ width: `${(chunk.loss / 1.4) * 100}%` }}
                />
                {/* Improvement */}
                {barWidth > 0 && (
                  <div
                    className="absolute h-full bg-green-500/40 transition-all duration-300"
                    style={{
                      left: `${((chunk.loss - (chunk.loss - chunk.adaptedLoss)) / 1.4) * 100}%`,
                      width: `${(barWidth / 100) * (chunk.loss / 1.4) * 100}%`,
                    }}
                  />
                )}
                {/* Training progress bar */}
                {isActive && phase === "training" && (
                  <div
                    className="absolute bottom-0 h-1 bg-[var(--accent)] transition-all"
                    style={{ width: `${trainProgress * 100}%` }}
                  />
                )}
                {/* Loss labels */}
                <div className="absolute inset-0 flex items-center px-2 text-xs font-mono">
                  <span className="text-red-300">{chunk.loss.toFixed(4)}</span>
                  {chunk.trainEpochs > 0 && (
                    <span className="ml-2 text-green-300">
                      → {chunk.adaptedLoss.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>

              {/* Phase label */}
              <div className="w-16 text-xs text-[var(--muted)]">
                {isActive && phase === "scoring"
                  ? "Scoring"
                  : isActive && phase === "training"
                    ? `Train ${chunk.trainEpochs}/${maxEpochs}`
                    : chunk.trained
                      ? "Done"
                      : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#60a5fa" }} />
          Scoring
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#facc15" }} />
          Training
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#10b981" }} />
          Complete
        </div>
      </div>
    </div>
  );
}
