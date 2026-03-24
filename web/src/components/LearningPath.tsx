import Link from "next/link";
import { DEEP_DIVES } from "@/content/deep-dives/registry";

export default function LearningPath() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Learning Path</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEEP_DIVES.map((dd) => {
          const available = dd.slug === "quantization-fundamentals";
          return (
            <Link
              key={dd.slug}
              href={available ? `/learn/${dd.slug}` : "#"}
              className={`block bg-[var(--card)] rounded-lg border border-[var(--border)] p-4 no-underline transition-colors ${
                available
                  ? "hover:border-[var(--accent)]"
                  : "opacity-50 cursor-default"
              }`}
            >
              <div className="text-xs text-[var(--muted)] mb-1">
                {dd.order}. {dd.category.replace("_", " ")}
              </div>
              <div className="font-medium text-[var(--foreground)]">
                {dd.title}
              </div>
              <div className="text-sm text-[var(--muted)] mt-1">
                {dd.subtitle}
              </div>
              {!available && (
                <div className="text-xs text-[var(--accent)] mt-2">
                  Coming Soon
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
