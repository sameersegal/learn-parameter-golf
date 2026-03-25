import submissionsData from "@/data/submissions.json";
import techniqueIndexData from "@/data/technique-index.json";
import { Submission, TechniqueIndex } from "./types";

export const submissions: Submission[] = submissionsData as Submission[];
export const techniqueIndex: TechniqueIndex =
  techniqueIndexData as unknown as TechniqueIndex;

export function getSubmission(prNumber: number): Submission | undefined {
  return submissions.find((s) => s.pr_number === prNumber);
}

export function getRecords(): Submission[] {
  return submissions.filter((s) => s.is_record);
}

export function getBestBpb(): number | null {
  const valid = submissions.filter((s) => s.val_bpb != null);
  if (valid.length === 0) return null;
  return Math.min(...valid.map((s) => s.val_bpb!));
}

export function getUniqueAuthors(): number {
  return new Set(submissions.map((s) => s.author)).size;
}

export function getTechniqueCount(): number {
  let count = 0;
  for (const cards of Object.values(techniqueIndex.categories)) {
    count += cards.length;
  }
  return count;
}
