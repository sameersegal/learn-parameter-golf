import { DeepDive } from "@/lib/types";
import { quantizationFundamentals } from "./quantization-fundamentals";
import { architectureTricks } from "./architecture-tricks";
import { optimizers } from "./optimizers";
import { weightAveraging } from "./weight-averaging";
import { compression } from "./compression";
import { testTimeTraining } from "./test-time-training";
import { learningRateSchedules } from "./learning-rate-schedules";
import { initialization } from "./initialization";
import { regularization } from "./regularization";
import { evaluationStrategies } from "./evaluation-strategies";

export const DEEP_DIVES: DeepDive[] = [
  quantizationFundamentals,
  architectureTricks,
  optimizers,
  weightAveraging,
  compression,
  testTimeTraining,
  learningRateSchedules,
  initialization,
  regularization,
  evaluationStrategies,
];

export function getDeepDive(slug: string): DeepDive | undefined {
  return DEEP_DIVES.find((dd) => dd.slug === slug);
}
