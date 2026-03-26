"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Submission } from "@/lib/types";

export default function RecordChart({
  submissions,
}: {
  submissions: Submission[];
}) {
  // Sort by PR number (chronological)
  const sorted = [...submissions]
    .filter((s) => s.val_bpb != null && s.val_bpb > 0)
    .sort((a, b) => a.pr_number - b.pr_number);

  // Build record step line from is_record submissions only
  const records = sorted
    .filter((s) => s.is_record)
    .sort((a, b) => a.pr_number - b.pr_number);

  // Build chart data: all submissions get a bpb point,
  // record line steps down at each is_record submission
  let currentRecord: number | null = null;
  const data: {
    pr: number;
    bpb: number;
    record: number | null;
    author: string;
    isRecord: boolean;
  }[] = [];

  // Pre-index record BPB by PR number for quick lookup
  const recordByPr = new Map<number, number>();
  for (const r of records) {
    recordByPr.set(r.pr_number, r.val_bpb!);
  }

  for (const s of sorted) {
    if (recordByPr.has(s.pr_number)) {
      currentRecord = recordByPr.get(s.pr_number)!;
    }
    data.push({
      pr: s.pr_number,
      bpb: s.val_bpb!,
      record: currentRecord,
      author: s.author,
      isRecord: s.is_record,
    });
  }

  return (
    <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-medium text-[var(--muted)] mb-4">
        Record Progression
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="pr"
            type="number"
            name="PR#"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            stroke="#334155"
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            stroke="#334155"
          />
          <ReferenceLine
            y={1.9}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: "Baseline 1.9", fill: "#ef4444", fontSize: 11, position: "insideTopRight" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0",
            }}
            formatter={(value, name) => [
              typeof value === "number" ? value.toFixed(4) : String(value),
              name === "record" ? "Record BPB" : "Submission BPB",
            ]}
            labelFormatter={(label) => `PR #${label}`}
          />
          <Line
            dataKey="bpb"
            stroke="#60a5fa"
            dot={false}
            opacity={0.3}
            strokeWidth={1}
            name="bpb"
          />
          <Line
            dataKey="record"
            stroke="#facc15"
            dot={false}
            strokeWidth={2}
            name="record"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)] mt-2">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-[#facc15]" />
          Record BPB (is_record)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-[#60a5fa] opacity-40" />
          All submissions
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-[#ef4444]" style={{ borderTop: "1px dashed #ef4444" }} />
          Baseline (1.9)
        </div>
      </div>
    </div>
  );
}
