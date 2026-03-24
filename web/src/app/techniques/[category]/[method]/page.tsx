import { notFound } from "next/navigation";
import Link from "next/link";
import { techniqueIndex, getSubmission } from "@/lib/data";
import { CATEGORY_META } from "@/lib/constants";
import CategoryTag from "@/components/CategoryTag";
import { TechniqueCategory, TechniqueCard } from "@/lib/types";

export function generateStaticParams() {
  const params: { category: string; method: string }[] = [];
  for (const [cat, cards] of Object.entries(techniqueIndex.categories)) {
    for (const card of cards) {
      params.push({ category: cat, method: card.slug });
    }
  }
  return params;
}

export default async function TechniqueDetailPage({
  params,
}: {
  params: Promise<{ category: string; method: string }>;
}) {
  const { category, method } = await params;

  const cards = techniqueIndex.categories[category as TechniqueCategory];
  if (!cards) notFound();
  const card: TechniqueCard | undefined = cards.find(
    (c) => c.slug === method
  );
  if (!card) notFound();

  const meta = CATEGORY_META[category as TechniqueCategory];

  return (
    <div>
      <Link
        href={`/techniques?category=${category}`}
        className="text-sm text-[var(--muted)] hover:text-white no-underline mb-4 inline-block"
      >
        &larr; Back to {meta?.label ?? category}
      </Link>

      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">{card.method}</h1>
        <CategoryTag category={category as TechniqueCategory} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">Used in</div>
          <div className="text-xl font-bold">{card.count} PRs</div>
        </div>
        {card.bestBpb && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
            <div className="text-xs text-[var(--muted)]">Best BPB</div>
            <div className="text-xl font-mono font-bold">
              {card.bestBpb.toFixed(4)}
            </div>
          </div>
        )}
        {card.avgBpb && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
            <div className="text-xs text-[var(--muted)]">Avg BPB</div>
            <div className="text-xl font-mono font-bold">
              {card.avgBpb.toFixed(4)}
            </div>
          </div>
        )}
        {card.deepDiveSlug && (
          <Link
            href={`/learn/${card.deepDiveSlug}`}
            className="bg-[var(--accent)] text-black border border-[var(--accent)] rounded-lg p-3 no-underline hover:opacity-90 transition-opacity"
          >
            <div className="text-xs">Learn more</div>
            <div className="text-lg font-bold">Deep Dive &rarr;</div>
          </Link>
        )}
      </div>

      {/* PRs using this technique */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-3">Submissions</h2>
        <div className="space-y-2">
          {card.prNumbers.map((pr) => {
            const sub = getSubmission(pr);
            return (
              <Link
                key={pr}
                href={`/pr/${pr}`}
                className="block bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 no-underline hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">PR #{pr}</span>
                    {sub && (
                      <span className="text-sm text-[var(--muted)] ml-2">
                        by {sub.author}
                      </span>
                    )}
                    {sub?.is_record && (
                      <span className="ml-2 text-[var(--accent)] text-xs font-bold">
                        RECORD
                      </span>
                    )}
                  </div>
                  {sub?.val_bpb && (
                    <span className="font-mono text-sm">
                      {sub.val_bpb.toFixed(4)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Hyperparameter table */}
      {card.hyperparameters.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">Hyperparameters Across PRs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  {Object.keys(card.hyperparameters[0]).map((key) => (
                    <th key={key} className="text-left p-2 font-mono text-xs">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.hyperparameters.map((hp, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--border)]"
                  >
                    {Object.values(hp).map((v, j) => (
                      <td key={j} className="p-2 font-mono text-xs">
                        {typeof v === "object" && v !== null
                          ? JSON.stringify(v)
                          : String(v ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
