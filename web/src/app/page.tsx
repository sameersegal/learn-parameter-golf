import Link from "next/link";
import { submissions } from "@/lib/data";
import StatsCards from "@/components/StatsCards";
import Leaderboard from "@/components/Leaderboard";
import RecordChart from "@/components/RecordChart";
import TechFreqChart from "@/components/TechFreqChart";
import LearningPath from "@/components/LearningPath";
import CurrentRecord from "@/components/CurrentRecord";

export default function Home() {
  const top10 = [...submissions]
    .filter((s) => s.val_bpb != null)
    .sort((a, b) => a.val_bpb! - b.val_bpb!)
    .slice(0, 10);

  return (
    <div>
      {/* Hero */}
      <p className="text-lg text-[var(--muted)] mb-8">
        Learn how to fit a language model into 16MB. This site breaks down
        every technique used in OpenAI&apos;s{" "}
        <a
          href="https://github.com/openai/parameter-golf"
          target="_blank"
          rel="noopener noreferrer"
        >
          Parameter Golf
        </a>{" "}
        competition — from quantization and architecture tricks to test-time
        training — with interactive deep dives, real submission data, and code.
      </p>

      <StatsCards />

      <CurrentRecord />

      {/* Learning Path — the core value */}
      <div className="mb-10">
        <LearningPath />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RecordChart submissions={submissions} />
        <TechFreqChart />
      </div>

      {/* Top 10 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Top Submissions</h2>
          <Link
            href="/prs"
            className="text-sm text-[var(--muted)] hover:text-white no-underline"
          >
            View all {submissions.length} PRs &rarr;
          </Link>
        </div>
        <Leaderboard submissions={top10} />
      </div>
    </div>
  );
}
