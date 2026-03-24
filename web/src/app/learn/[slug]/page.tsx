import { notFound } from "next/navigation";
import Link from "next/link";
import { DEEP_DIVES, getDeepDive } from "@/content/deep-dives/registry";
import { CATEGORY_META } from "@/lib/constants";
import { TechniqueCategory } from "@/lib/types";
import ContentRenderer from "@/components/ContentRenderer";

export function generateStaticParams() {
  return DEEP_DIVES.filter((dd) => dd.sections.length > 0).map((dd) => ({
    slug: dd.slug,
  }));
}

export default async function DeepDivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dd = getDeepDive(slug);
  if (!dd || dd.sections.length === 0) notFound();

  const meta = CATEGORY_META[dd.category as TechniqueCategory];

  return (
    <div>
      <Link
        href="/learn"
        className="text-sm text-[var(--muted)] hover:text-white no-underline mb-4 inline-block"
      >
        &larr; Back to Learn
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: meta?.color ?? "#6b7280" }}
          />
          <span className="text-xs text-[var(--muted)]">
            {dd.order}. {meta?.label ?? dd.category}
          </span>
        </div>
        <h1 className="text-3xl font-bold">{dd.title}</h1>
        <p className="text-[var(--muted)] mt-1">{dd.subtitle}</p>
      </div>

      <ContentRenderer sections={dd.sections} />
    </div>
  );
}
