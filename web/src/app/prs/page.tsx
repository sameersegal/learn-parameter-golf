import { submissions } from "@/lib/data";
import Leaderboard from "@/components/Leaderboard";

export default function PRsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">All Submissions</h1>
      <p className="text-[var(--muted)] mb-6">
        {submissions.length} submissions with val_bpb &le; 1.9. Click any row
        to see full details.
      </p>
      <Leaderboard submissions={submissions} />
    </div>
  );
}
