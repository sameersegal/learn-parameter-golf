"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CATEGORY_META, ALL_CATEGORIES } from "@/lib/constants";
import { techniqueIndex } from "@/lib/data";

export default function TechFreqChart() {
  const data = ALL_CATEGORIES.map((cat) => {
    const cards = techniqueIndex.categories[cat] || [];
    const total = cards.reduce((sum, c) => sum + c.count, 0);
    return {
      name: CATEGORY_META[cat].label,
      count: total,
      fill: CATEGORY_META[cat].color,
    };
  })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-medium text-[var(--muted)] mb-4">
        Technique Category Frequency
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 5, left: 100 }}
        >
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            stroke="#334155"
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            stroke="#334155"
            width={95}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0",
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <rect key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
