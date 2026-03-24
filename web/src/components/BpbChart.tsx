"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Submission } from "@/lib/types";

export default function BpbChart({
  submissions,
}: {
  submissions: Submission[];
}) {
  const data = submissions
    .filter((s) => s.val_bpb != null)
    .map((s) => ({
      pr: s.pr_number,
      bpb: s.val_bpb!,
      isRecord: s.is_record,
      author: s.author,
    }));

  const records = data.filter((d) => d.isRecord);
  const nonRecords = data.filter((d) => !d.isRecord);

  return (
    <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-medium text-[var(--muted)] mb-4">
        val_bpb by PR Number
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="pr"
            type="number"
            name="PR#"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            stroke="#334155"
          />
          <YAxis
            dataKey="bpb"
            type="number"
            name="val_bpb"
            domain={["auto", "auto"]}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            stroke="#334155"
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0",
            }}
            formatter={(value) => [
              typeof value === "number" ? value.toFixed(4) : String(value),
            ]}
            labelFormatter={(label) => `PR #${label}`}
          />
          <Scatter
            name="Submissions"
            data={nonRecords}
            fill="#60a5fa"
            opacity={0.7}
          />
          <Scatter
            name="Records"
            data={records}
            fill="#facc15"
            opacity={1}
            shape="star"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
