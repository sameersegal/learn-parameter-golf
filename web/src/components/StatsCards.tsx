import { submissions, getBestBpb, getTechniqueCount } from "@/lib/data";
import { DEEP_DIVES } from "@/content/deep-dives/registry";

export default function StatsCards() {
  const bestBpb = getBestBpb();
  const techniqueCount = getTechniqueCount();
  const deepDiveCount = DEEP_DIVES.filter((dd) => dd.sections.length > 0).length;

  const stats = [
    { label: "PRs Processed", value: submissions.length },
    { label: "Best BPB Score", value: bestBpb?.toFixed(4) ?? "N/A" },
    { label: "Techniques", value: techniqueCount },
    { label: "Deep Dives", value: deepDiveCount },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]"
        >
          <div className="text-sm text-[var(--muted)]">{stat.label}</div>
          <div className="text-2xl font-bold mt-1">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
