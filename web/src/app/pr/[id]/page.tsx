import { notFound } from "next/navigation";
import Link from "next/link";
import { submissions, getSubmission } from "@/lib/data";
import CategoryTag from "@/components/CategoryTag";
import { TechniqueCategory } from "@/lib/types";

export function generateStaticParams() {
  return submissions.map((s) => ({ id: String(s.pr_number) }));
}

export default async function PRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prNumber = parseInt(id, 10);
  const sub = getSubmission(prNumber);
  if (!sub) notFound();

  // Find prev/next
  const idx = submissions.findIndex((s) => s.pr_number === prNumber);
  const prev = idx > 0 ? submissions[idx - 1] : null;
  const next = idx < submissions.length - 1 ? submissions[idx + 1] : null;

  // Group techniques by category
  const grouped: Record<string, typeof sub.training_techniques> = {};
  for (const tech of sub.training_techniques) {
    const cat = tech.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(tech);
  }

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-4">
          {prev && (
            <Link
              href={`/pr/${prev.pr_number}`}
              className="text-sm text-[var(--muted)] hover:text-white no-underline"
            >
              &larr; PR #{prev.pr_number}
            </Link>
          )}
        </div>
        <div className="flex gap-4">
          {next && (
            <Link
              href={`/pr/${next.pr_number}`}
              className="text-sm text-[var(--muted)] hover:text-white no-underline"
            >
              PR #{next.pr_number} &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">PR #{sub.pr_number}</h1>
          {sub.is_record && (
            <span className="bg-[var(--accent)] text-black text-xs font-bold px-2 py-1 rounded">
              RECORD
            </span>
          )}
          <span className="text-xs bg-[var(--border)] px-2 py-1 rounded text-[var(--muted)]">
            {sub.status}
          </span>
        </div>
        <p className="text-[var(--muted)]">{sub.title}</p>
        <div className="flex gap-4 mt-2 text-sm text-[var(--muted)]">
          <span>by {sub.author}</span>
          <a
            href={`https://github.com/openai/parameter-golf/pull/${sub.pr_number}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">val_bpb</div>
          <div className="text-xl font-mono font-bold">
            {sub.val_bpb?.toFixed(4) ?? "N/A"}
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">Architecture</div>
          <div className="text-lg font-medium">{sub.architecture ?? "—"}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">Optimizer</div>
          <div className="text-lg font-medium">{sub.optimizer ?? "—"}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">Artifact Size</div>
          <div className="text-lg font-medium">
            {sub.artifact_size ?? "—"}
          </div>
        </div>
      </div>

      {/* Training Techniques */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Training Techniques</h2>
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, techs]) => (
            <div
              key={category}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4"
            >
              <CategoryTag category={category as TechniqueCategory} />
              <div className="mt-3 space-y-3">
                {techs.map((tech, i) => {
                  const d = tech.data as Record<string, unknown>;
                  const name = String(d.method ?? d.component ?? category);
                  const desc = d.description ? String(d.description) : null;
                  return (
                  <div key={i} className="text-sm">
                    <div className="font-medium">{name}</div>
                    {desc && (
                      <div className="text-[var(--muted)] mt-1">{desc}</div>
                    )}
                    {Object.entries(d)
                      .filter(
                        ([k]) =>
                          !["method", "component", "description"].includes(k)
                      )
                      .map(([k, v]) => (
                        <div key={k} className="text-xs text-[var(--muted)] mt-1">
                          <span className="font-mono">{k}</span>:{" "}
                          <span className="font-mono">
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Novel Contributions */}
      {sub.novel_contributions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Novel Contributions</h2>
          <ul className="space-y-2">
            {sub.novel_contributions.map((c, i) => (
              <li
                key={i}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-sm"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
