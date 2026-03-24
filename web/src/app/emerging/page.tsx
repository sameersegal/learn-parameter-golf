import Link from "next/link";
import { techniqueIndex } from "@/lib/data";
import CategoryTag from "@/components/CategoryTag";
import { TechniqueCategory } from "@/lib/types";

export default function EmergingPage() {
  const emerging = techniqueIndex.emerging;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Emerging Techniques</h1>
      <p className="text-[var(--muted)] mb-6">
        Methods not yet mapped to a deep dive concept. These are new or uncommon
        techniques worth watching.
      </p>

      <div className="text-sm text-[var(--muted)] mb-4">
        {emerging.length} unmapped methods
      </div>

      <div className="space-y-2">
        {emerging.map((card) => (
          <Link
            key={`${card.category}-${card.slug}`}
            href={`/techniques/${card.category}/${card.slug}`}
            className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 no-underline hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <CategoryTag category={card.category as TechniqueCategory} />
              <span className="font-medium text-[var(--foreground)]">
                {card.method}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
              <span>{card.count} PRs</span>
              {card.bestBpb && (
                <span className="font-mono">{card.bestBpb.toFixed(4)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
