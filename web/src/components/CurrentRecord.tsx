import Link from "next/link";
import { submissions } from "@/lib/data";
import CategoryTag from "@/components/CategoryTag";
import { TechniqueCategory } from "@/lib/types";

export default function CurrentRecord() {
  const record = submissions
    .filter((s) => s.is_record && s.val_bpb != null && s.val_bpb > 0)
    .sort((a, b) => a.val_bpb! - b.val_bpb!)
    .at(0);

  if (!record) return null;

  // Extract unique categories and technique names
  const techniques = record.training_techniques.map((t) => {
    const d = t.data as Record<string, unknown>;
    return {
      category: t.category,
      name: String(d.method ?? d.component ?? t.category),
    };
  });

  const uniqueCategories = [
    ...new Set(techniques.map((t) => t.category)),
  ] as TechniqueCategory[];

  return (
    <div className="mb-8">
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5 relative overflow-hidden"
        style={{ borderLeft: "3px solid var(--accent)" }}
      >
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
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
          <div className="text-right">
            <div className="text-xs text-[var(--muted)]">val_bpb</div>
            <div className="text-2xl font-mono font-bold text-[var(--accent)]">
              {record.val_bpb!.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
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

        {/* Technique category pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {uniqueCategories.map((cat) => (
            <CategoryTag key={cat} category={cat} />
          ))}
        </div>

        {/* Technique names */}
        <div className="text-sm text-[var(--muted)]">
          {techniques.map((t, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1.5 opacity-40">&middot;</span>}
              {t.name}
            </span>
          ))}
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
