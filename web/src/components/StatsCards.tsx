import { submissions, getRecords, getBestBpb, getUniqueAuthors } from "@/lib/data";

export default function StatsCards() {
  const records = getRecords();
  const bestBpb = getBestBpb();
  const uniqueAuthors = getUniqueAuthors();

  const stats = [
    { label: "Total PRs", value: submissions.length },
    { label: "Records", value: records.length },
    { label: "Best BPB", value: bestBpb?.toFixed(4) ?? "N/A" },
    { label: "Authors", value: uniqueAuthors },
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
