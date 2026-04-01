"use client";

import dynamic from "next/dynamic";
import Placeholder from "./Placeholder";

const animationRegistry: Record<
  string,
  React.ComponentType
> = {
  "quantization-demo": dynamic(
    () => import("./animations/QuantizationDemo"),
    { ssr: false, loading: () => <Placeholder label="Loading animation..." /> }
  ),
  "context-gradient-demo": dynamic(
    () => import("./animations/ContextGradientDemo"),
    { ssr: false, loading: () => <Placeholder label="Loading animation..." /> }
  ),
  "sliding-window-demo": dynamic(
    () => import("./animations/SlidingWindowDemo"),
    { ssr: false, loading: () => <Placeholder label="Loading animation..." /> }
  ),
  "ttt-demo": dynamic(
    () => import("./animations/TTTDemo"),
    { ssr: false, loading: () => <Placeholder label="Loading animation..." /> }
  ),
  "muon-vs-adam-demo": dynamic(
    () => import("./animations/MuonVsAdamDemo"),
    { ssr: false, loading: () => <Placeholder label="Loading animation..." /> }
  ),
  "newton-schulz-demo": dynamic(
    () => import("./animations/NewtonSchulzDemo"),
    { ssr: false, loading: () => <Placeholder label="Loading animation..." /> }
  ),
  "weight-averaging-demo": dynamic(
    () => import("./animations/WeightAveragingDemo"),
    { ssr: false, loading: () => <Placeholder label="Loading animation..." /> }
  ),
};

export default function AnimationContainer({
  animationId,
}: {
  animationId: string;
}) {
  const Component = animationRegistry[animationId];

  if (!Component) {
    return <Placeholder label={`Animation "${animationId}" coming soon`} />;
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 overflow-hidden">
      <Component />
    </div>
  );
}
