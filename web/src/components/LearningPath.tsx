import Link from "next/link";
import { DEEP_DIVES } from "@/content/deep-dives/registry";

export default function LearningPath() {
  const available = DEEP_DIVES.filter((dd) => dd.sections.length > 0);
  const comingSoonCount = DEEP_DIVES.length - available.length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Deep Dives</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {available.map((dd) => (
          <Link
            key={dd.slug}
            href={`/learn/${dd.slug}`}
            className="block bg-[var(--card)] rounded-lg border border-[var(--border)] p-4 no-underline hover:border-[var(--accent)] transition-colors"
          >
            <div className="text-xs text-[var(--muted)] mb-1">
              {dd.category.replace(/_/g, " ")}
            </div>
            <div className="font-medium text-[var(--foreground)]">
              {dd.title}
            </div>
            <div className="text-sm text-[var(--muted)] mt-1">
              {dd.subtitle}
            </div>
            <div className="text-xs text-green-400 mt-2">
              {dd.sections.length} sections
            </div>
          </Link>
        ))}
      </div>
      {comingSoonCount > 0 && (
        <p className="text-sm text-[var(--muted)] mt-3">
          {comingSoonCount} more coming soon.{" "}
          <Link href="/learn" className="text-[var(--accent)] no-underline">
            See all &rarr;
          </Link>
        </p>
      )}
    </div>
  );
}
