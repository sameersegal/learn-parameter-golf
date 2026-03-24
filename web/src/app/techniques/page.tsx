"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { techniqueIndex } from "@/lib/data";
import { CATEGORY_META, ALL_CATEGORIES } from "@/lib/constants";
import CategoryTag from "@/components/CategoryTag";
import { TechniqueCategory } from "@/lib/types";
import { Suspense } from "react";

function TechniquesContent() {
  const searchParams = useSearchParams();
  const filterCat = searchParams.get("category") as TechniqueCategory | null;

  const categories = filterCat
    ? { [filterCat]: techniqueIndex.categories[filterCat] || [] }
    : techniqueIndex.categories;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Techniques</h1>
      <p className="text-[var(--muted)] mb-6">
        Browse all training techniques used across Parameter Golf submissions.
      </p>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/techniques"
          className={`text-xs px-3 py-1 rounded-full no-underline border ${
            !filterCat
              ? "bg-white text-black border-white"
              : "border-[var(--border)] text-[var(--muted)] hover:text-white"
          }`}
        >
          All
        </Link>
        {ALL_CATEGORIES.map((cat) => {
          const count = (techniqueIndex.categories[cat] || []).length;
          if (count === 0) return null;
          return (
            <Link
              key={cat}
              href={`/techniques?category=${cat}`}
              className={`text-xs px-3 py-1 rounded-full no-underline border ${
                filterCat === cat
                  ? "bg-white text-black border-white"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-white"
              }`}
            >
              {CATEGORY_META[cat].label} ({count})
            </Link>
          );
        })}
      </div>

      {/* Technique cards grouped by category */}
      {Object.entries(categories).map(([cat, cards]) => {
        if (!cards || cards.length === 0) return null;
        const meta = CATEGORY_META[cat as TechniqueCategory];
        if (!meta) return null;
        return (
          <div key={cat} className="mb-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: meta.color }}
              />
              {meta.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cards.map((card) => (
                <Link
                  key={`${cat}-${card.slug}`}
                  href={`/techniques/${cat}/${card.slug}`}
                  className="block bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 no-underline hover:border-[var(--accent)] transition-colors"
                >
                  <div className="font-medium text-[var(--foreground)]">
                    {card.method}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-[var(--muted)]">
                    <span>{card.count} PRs</span>
                    {card.bestBpb && (
                      <span>Best: {card.bestBpb.toFixed(4)}</span>
                    )}
                    {card.avgBpb && (
                      <span>Avg: {card.avgBpb.toFixed(4)}</span>
                    )}
                  </div>
                  {card.deepDiveSlug && (
                    <div className="text-xs text-[var(--accent)] mt-2">
                      Deep dive available
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TechniquesPage() {
  return (
    <Suspense>
      <TechniquesContent />
    </Suspense>
  );
}
