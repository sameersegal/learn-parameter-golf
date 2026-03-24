export type TechniqueCategory =
  | "quantization"
  | "architecture_modification"
  | "optimizer_technique"
  | "weight_averaging"
  | "compression"
  | "evaluation_technique"
  | "test_time_training"
  | "initialization"
  | "sequence_length"
  | "lr_schedule"
  | "regularization"
  | "other";

export interface TrainingTechnique {
  category: TechniqueCategory;
  data: Record<string, unknown>;
}

export interface Submission {
  pr_number: number;
  title: string;
  author: string;
  status: string;
  is_record: boolean;
  val_bpb: number | null;
  architecture: string | null;
  quantization: string | null;
  optimizer: string | null;
  training_techniques: TrainingTechnique[];
  compression: string | null;
  novel_contributions: string[];
  artifact_size: string | null;
}

export interface TechniqueCard {
  category: TechniqueCategory;
  method: string;
  slug: string;
  count: number;
  avgBpb: number | null;
  bestBpb: number | null;
  prNumbers: number[];
  deepDiveSlug: string | null;
  hyperparameters: Record<string, unknown>[];
}

export interface TechniqueIndex {
  categories: Record<TechniqueCategory, TechniqueCard[]>;
  emerging: TechniqueCard[];
}

export interface DeepDiveSection {
  type: "text" | "animation" | "code" | "computation";
  title: string;
  content?: string;
  language?: string;
  animationId?: string;
}

export interface DeepDive {
  slug: string;
  title: string;
  subtitle: string;
  category: TechniqueCategory;
  sections: DeepDiveSection[];
  order: number;
}
