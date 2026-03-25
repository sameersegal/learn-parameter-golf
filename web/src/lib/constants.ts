import { TechniqueCategory } from "./types";

export const CATEGORY_META: Record<
  TechniqueCategory,
  { label: string; color: string; slug: string }
> = {
  quantization: { label: "Quantization", color: "#6366f1", slug: "quantization" },
  architecture_modification: { label: "Architecture", color: "#ec4899", slug: "architecture_modification" },
  optimizer_technique: { label: "Optimizer", color: "#f59e0b", slug: "optimizer_technique" },
  weight_averaging: { label: "Weight Averaging", color: "#10b981", slug: "weight_averaging" },
  compression: { label: "Compression", color: "#8b5cf6", slug: "compression" },
  evaluation_technique: { label: "Evaluation", color: "#06b6d4", slug: "evaluation_technique" },
  test_time_training: { label: "Test-Time Training", color: "#ef4444", slug: "test_time_training" },
  initialization: { label: "Initialization", color: "#84cc16", slug: "initialization" },
  sequence_length: { label: "Sequence Length", color: "#f97316", slug: "sequence_length" },
  lr_schedule: { label: "LR Schedule", color: "#14b8a6", slug: "lr_schedule" },
  regularization: { label: "Regularization", color: "#a855f7", slug: "regularization" },
  other: { label: "Other", color: "#6b7280", slug: "other" },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as TechniqueCategory[];

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/techniques", label: "Techniques" },
  { href: "/learn", label: "Learn" },
  { href: "/emerging", label: "Emerging" },
  { href: "/prs", label: "PRs" },
];
