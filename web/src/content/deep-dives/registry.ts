import { DeepDive } from "@/lib/types";
import { quantizationFundamentals } from "./quantization-fundamentals";

export const DEEP_DIVES: DeepDive[] = [
  quantizationFundamentals,
  {
    slug: "architecture-tricks",
    title: "Architecture Tricks",
    subtitle: "U-Net skips, BigramHash, SmearGate, and more",
    category: "architecture_modification",
    sections: [],
    order: 2,
  },
  {
    slug: "optimizers",
    title: "Optimizers",
    subtitle: "Muon, Adam, and optimizer selection strategies",
    category: "optimizer_technique",
    sections: [],
    order: 3,
  },
  {
    slug: "weight-averaging",
    title: "Weight Averaging",
    subtitle: "SWA, EMA, and ensemble-like approaches",
    category: "weight_averaging",
    sections: [],
    order: 4,
  },
  {
    slug: "compression",
    title: "Compression",
    subtitle: "zstd, pruning, and artifact size optimization",
    category: "compression",
    sections: [],
    order: 5,
  },
  {
    slug: "test-time-training",
    title: "Test-Time Training",
    subtitle: "LoRA TTT and per-document adaptation",
    category: "test_time_training",
    sections: [],
    order: 6,
  },
  {
    slug: "learning-rate-schedules",
    title: "Learning Rate Schedules",
    subtitle: "Warmdown, cosine, and schedule optimization",
    category: "lr_schedule",
    sections: [],
    order: 7,
  },
  {
    slug: "initialization",
    title: "Initialization",
    subtitle: "OrthoInit and weight initialization strategies",
    category: "initialization",
    sections: [],
    order: 8,
  },
  {
    slug: "regularization",
    title: "Regularization",
    subtitle: "Weight decay, pruning, and overfitting prevention",
    category: "regularization",
    sections: [],
    order: 9,
  },
  {
    slug: "evaluation-strategies",
    title: "Evaluation Strategies",
    subtitle: "Sliding window eval and scoring techniques",
    category: "evaluation_technique",
    sections: [],
    order: 10,
  },
];

export function getDeepDive(slug: string): DeepDive | undefined {
  return DEEP_DIVES.find((dd) => dd.slug === slug);
}
