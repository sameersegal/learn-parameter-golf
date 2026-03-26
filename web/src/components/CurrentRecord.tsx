import Link from "next/link";
import { submissions } from "@/lib/data";
import { TechniqueCategory } from "@/lib/types";
import { CATEGORY_META } from "@/lib/constants";

export default function CurrentRecord() {
  const record = submissions
    .filter((s) => s.is_record && s.val_bpb != null && s.val_bpb > 0)
    .sort((a, b) => a.val_bpb! - b.val_bpb!)
    .at(0);

  if (!record) return null;

  // Group techniques by category
  const grouped = new Map<
    TechniqueCategory,
    string[]
  >();

  for (const t of record.training_techniques) {
    const d = t.data as Record<string, unknown>;
    const name = String(d.method ?? d.component ?? t.category);
    if (!grouped.has(t.category)) {
      grouped.set(t.category, []);
    }
    grouped.get(t.category)!.push(name);
  }

  return (
    <div className="mb-8">
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 sm:p-5 relative overflow-hidden"
        style={{ borderLeft: "3px solid var(--accent)" }}
      >
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="bg-[var(--accent)] text-black text-xs font-bold px-2 py-1 rounded">
              CURRENT RECORD
            </span>
            <Link
              href={`/pr/${record.pr_number}`}
              className="text-lg font-bold hover:text-[var(--accent)] no-underline"
            >
              PR #{record.pr_number}
            </Link>
            <span className="text-sm text-[var(--muted)]">
              by {record.author}
            </span>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs text-[var(--muted)]">val_bpb</div>
            <div className="text-2xl font-mono font-bold text-[var(--accent)]">
              {record.val_bpb!.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm">
          {record.architecture && (
            <div>
              <span className="text-[var(--muted)]">Architecture: </span>
              <span className="font-medium">{record.architecture}</span>
            </div>
          )}
          {record.optimizer && (
            <div>
              <span className="text-[var(--muted)]">Optimizer: </span>
              <span className="font-medium">{record.optimizer}</span>
            </div>
          )}
          {record.artifact_size && (
            <div>
              <span className="text-[var(--muted)]">Size: </span>
              <span className="font-medium">{record.artifact_size}</span>
            </div>
          )}
        </div>

        {/* Techniques grouped by category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...grouped.entries()].map(([category, names]) => {
            const meta = CATEGORY_META[category] || CATEGORY_META.other;
            return (
              <div
                key={category}
                className="flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm"
                style={{ backgroundColor: meta.color + "10" }}
              >
                <span
                  className="shrink-0 inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5"
                  style={{
                    backgroundColor: meta.color + "22",
                    color: meta.color,
                    border: `1px solid ${meta.color}44`,
                  }}
                >
                  {meta.label}
                </span>
                <span className="text-[var(--muted)] text-xs leading-relaxed pt-0.5">
                  {names.join(", ")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Link */}
        <div className="mt-4">
          <Link
            href={`/pr/${record.pr_number}`}
            className="text-sm text-[var(--accent)] hover:underline no-underline"
          >
            View PR details &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
