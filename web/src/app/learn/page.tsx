import Link from "next/link";
import { DEEP_DIVES } from "@/content/deep-dives/registry";
import { CATEGORY_META } from "@/lib/constants";
import { TechniqueCategory } from "@/lib/types";

export default function LearnPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Learn</h1>
      <p className="text-[var(--muted)] mb-6">
        Deep dive into the techniques that power top Parameter Golf submissions.
        Start from fundamentals and work your way up.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEEP_DIVES.map((dd) => {
          const available = dd.sections.length > 0;
          const meta = CATEGORY_META[dd.category as TechniqueCategory];
          return (
            <Link
              key={dd.slug}
              href={available ? `/learn/${dd.slug}` : "#"}
              className={`block bg-[var(--card)] border border-[var(--border)] rounded-lg p-5 no-underline transition-colors ${
                available
                  ? "hover:border-[var(--accent)]"
                  : "opacity-50 cursor-default"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: meta?.color ?? "#6b7280" }}
                />
                <span className="text-xs text-[var(--muted)]">
                  {dd.order}. {meta?.label ?? dd.category}
                </span>
              </div>
              <div className="text-lg font-medium text-[var(--foreground)]">
                {dd.title}
              </div>
              <div className="text-sm text-[var(--muted)] mt-1">
                {dd.subtitle}
              </div>
              {!available && (
                <div className="text-xs text-[var(--accent)] mt-3 font-medium">
                  Coming Soon
                </div>
              )}
              {available && (
                <div className="text-xs text-green-400 mt-3 font-medium">
                  {dd.sections.length} sections
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
