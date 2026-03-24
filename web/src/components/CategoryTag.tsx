import { TechniqueCategory } from "@/lib/types";
import { CATEGORY_META } from "@/lib/constants";

export default function CategoryTag({
  category,
}: {
  category: TechniqueCategory;
}) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  return (
    <span
      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: meta.color + "22",
        color: meta.color,
        border: `1px solid ${meta.color}44`,
      }}
    >
      {meta.label}
    </span>
  );
}
