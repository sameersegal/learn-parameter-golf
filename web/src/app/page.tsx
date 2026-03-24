import { submissions } from "@/lib/data";
import StatsCards from "@/components/StatsCards";
import Leaderboard from "@/components/Leaderboard";
import BpbChart from "@/components/BpbChart";
import TechFreqChart from "@/components/TechFreqChart";
import LearningPath from "@/components/LearningPath";

export default function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Parameter Golf Field Guide</h1>
      <p className="text-[var(--muted)] mb-6">
        Interactive explorer for{" "}
        <a
          href="https://github.com/openai/parameter-golf"
          target="_blank"
          rel="noopener noreferrer"
        >
          openai/parameter-golf
        </a>{" "}
        competition submissions and techniques.
      </p>

      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <BpbChart submissions={submissions} />
        <TechFreqChart />
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
        <Leaderboard submissions={submissions} />
      </div>

      <LearningPath />
    </div>
  );
}
