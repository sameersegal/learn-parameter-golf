import { DeepDive } from "@/lib/types";

export const learningRateSchedules: DeepDive = {
  slug: "learning-rate-schedules",
  title: "Learning Rate Schedules",
  subtitle: "Warmdown, cosine, and schedule optimization",
  category: "lr_schedule",
  order: 7,
  sections: [
    {
      type: "text",
      title: "The Most Important Hyperparameter You Will Tune",
      content: `If you could only tune one thing in your Parameter Golf submission, make it the learning rate schedule. 411 submissions use **warmdown** -- a specific schedule pattern where the learning rate decays to zero over the final phase of training. The best neural submission using warmdown (PR #945, 0.027 BPB) sits near the very top of the leaderboard.

Cosine decay, the traditional default in deep learning, appears in only 70 submissions. The community has spoken: warmdown wins.

But what is warmdown, exactly? Why does it beat cosine decay for this competition? And why do the specific numbers -- 3,500 warmdown steps -- appear over and over again? The answers reveal how learning rate schedules interact with weight averaging, quantization, and the fixed compute budget of Parameter Golf.`,
    },
    {
      type: "text",
      title: "Learning Rate Schedules: The Basics",
      content: `The **learning rate** controls how big each gradient descent step is. Too high and the model overshoots good solutions. Too low and it converges too slowly. The **schedule** is how the learning rate changes over the course of training.

### Why Not Use a Constant Learning Rate?

A constant learning rate faces a fundamental dilemma. Set it high enough to make fast early progress and you will oscillate wildly near the end, unable to settle into a sharp minimum. Set it low enough for fine convergence and you waste most of training making tiny, slow updates.

The solution is to start high and end low. The only question is how to get from one to the other.

### The Three Phases of Training

Most effective schedules have three phases:

- **Warmup**: Start from a very small learning rate and ramp up over the first few hundred steps. This prevents the randomly initialized model from making huge, destructive updates before the gradients become meaningful.

- **Stable phase**: Hold the learning rate at its peak value. This is where the model does most of its learning -- large, confident steps that explore the loss landscape broadly.

- **Decay phase**: Reduce the learning rate toward zero. This lets the model settle precisely into a good minimum instead of bouncing around it.

The warmdown schedule that dominates Parameter Golf focuses almost entirely on optimizing the decay phase.`,
    },
    {
      type: "text",
      title: "Warmdown: The Parameter Golf Default",
      content: `**Warmdown** is a schedule where the learning rate holds steady at its peak value for most of training, then decays linearly (or with a cosine curve) to zero over the final N steps. In Parameter Golf, the magic number is **3,500 warmdown steps**.

### Why 3,500 Steps?

This number is not arbitrary. Parameter Golf training runs have a fixed compute budget. The total number of training steps varies by configuration, but most competitive submissions train for roughly 5,000-7,000 steps. A warmdown of 3,500 steps means the learning rate starts decaying roughly halfway through training (or in the final 50-70% of steps).

This ratio -- spending the first half of training at full learning rate and the second half decaying -- has been empirically validated across hundreds of submissions. It gives the model enough time at high learning rate to find a good basin, then enough decay time to settle precisely into the basin's center.

### How Warmdown Differs from Cosine Decay

Cosine decay starts reducing the learning rate immediately from step 1. It follows a smooth cosine curve from the peak to zero over the entire training run. This means the model never has a period of sustained high learning rate.

Warmdown, by contrast, keeps the learning rate at its peak for thousands of steps before decaying. The flat-then-drop shape gives the model a longer exploration phase followed by a focused refinement phase.

| Schedule | Exploration Phase | Refinement Phase | Peak LR Duration |
|----------|------------------|------------------|-----------------|
| Cosine decay | Shrinks from step 1 | Gradual, entire run | Instant |
| Warmdown 3500 | Full LR for ~3000+ steps | Sharp, final 3500 steps | ~50% of training |

### The Interaction with Weight Averaging

This is where warmdown becomes especially powerful. Recall from the weight averaging deep dive that SWA and EMA average checkpoints from the training trajectory. If the learning rate is still high, consecutive checkpoints are far apart in weight space, and their average may not land in a good spot. But during warmdown, the learning rate drops and consecutive checkpoints converge toward the same region. Averaging these similar-but-slightly-different checkpoints produces an excellent consensus model.

Warmdown makes weight averaging more effective, and weight averaging makes warmdown more forgiving. They are complementary techniques, which is why 8 of the top 10 neural submissions use both.`,
    },
    {
      type: "animation",
      title: "Interactive: Comparing LR Schedules",
      animationId: "lr-schedule-comparison",
      content:
        "Toggle between cosine decay and warmdown schedules to see how the learning rate changes over training steps. Adjust the warmdown start point and observe how it affects the schedule shape.",
    },
    {
      type: "text",
      title: "Beyond Warmdown: Other Schedules in Practice",
      content: `While warmdown dominates, other schedules appear in the data and have specific use cases.

### Cosine Decay (70 submissions)

Best result: PR #880 at 0.100 BPB. Cosine decay works well when combined with adaptive learning rate techniques. Some submissions use **adaptive cosine decay** where the decay rate adjusts based on training progress or gradient statistics.

The cosine shape has a mathematical elegance: it decays slowly at first (when the model still benefits from exploration) and quickly at the end (for final convergence). But the lack of a sustained peak phase puts it at a disadvantage versus warmdown for short training runs.

### Warmup-Stable-Decay (WSD)

A few submissions use the **WSD** pattern explicitly: linear warmup over ~50 steps, stable peak for 75% of training, then cosine or linear decay for the final 25%. This is essentially warmdown with a named structure. PR #850 achieves 0.321 BPB with WSD using 75% stable fraction.

### Per-Parameter Learning Rates

Some submissions assign different base learning rates to different parameter groups:

- **Matrix parameters** (weight matrices): typically 0.025
- **Scalar parameters** (biases, norms): typically 0.025
- **Tied embedding parameters**: typically 0.035

This recognizes that different parameter types have different gradient scales and benefit from different update magnitudes. The Muon optimizer (used by 84.6% of submissions specifying an optimizer) handles this automatically through its per-parameter scaling, which is one reason it pairs so well with simple warmdown schedules.

### Dynamic Schedules

A small number of submissions use **wallclock-aware** schedules that adjust based on elapsed time rather than step count. PR #799 (1.200 BPB) uses a dynamic wallclock cosine warmdown with a 600-second maximum. This approach adapts to hardware speed variations but adds complexity and is not widely adopted.`,
    },
    {
      type: "code",
      title: "Implementing Warmdown",
      language: "python",
      content: `import torch

def get_warmdown_lr(
    step: int,
    total_steps: int,
    warmdown_steps: int = 3500,
    warmup_steps: int = 20,
    peak_lr: float = 0.001,
) -> float:
    """Compute learning rate with warmup + flat + warmdown schedule.

    This is the most common LR schedule in Parameter Golf:
    - Linear warmup for the first warmup_steps
    - Flat at peak_lr until warmdown begins
    - Linear decay to 0 over the final warmdown_steps
    """
    if step < warmup_steps:
        # Linear warmup
        return peak_lr * (step / warmup_steps)

    warmdown_start = total_steps - warmdown_steps
    if step >= warmdown_start:
        # Linear warmdown to zero
        progress = (step - warmdown_start) / warmdown_steps
        return peak_lr * (1.0 - progress)

    # Flat at peak
    return peak_lr


# Example: 6000 total steps, 3500 warmdown
# Steps 0-19: warmup from 0 to 0.001
# Steps 20-2499: flat at 0.001
# Steps 2500-5999: linear decay from 0.001 to 0

# Usage with PyTorch optimizer:
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
scheduler = torch.optim.lr_scheduler.LambdaLR(
    optimizer,
    lr_lambda=lambda step: get_warmdown_lr(step, 6000) / 0.001
)`,
    },
    {
      type: "text",
      title: "Tuning Your Schedule: Practical Advice",
      content: `Based on the evidence from 1,162 Parameter Golf submissions, here is a practical guide to learning rate scheduling.

### Start Here

Use warmdown with 3,500 steps. Set warmup to 20 steps. Use whatever peak learning rate your optimizer recommends (for Muon, this is typically set by the optimizer's internal scaling). This configuration appears in hundreds of top submissions and is the community's default for good reason.

### When to Change the Warmdown Length

If your total training steps are significantly less than 7,000, reduce the warmdown proportionally. A good rule of thumb: warmdown should cover 50-60% of total steps. Training for 4,000 steps? Try warmdown of 2,000-2,400.

If your total training steps are much more than 7,000, you have more flexibility. The flat phase can be longer without hurting final convergence.

### When to Use Cosine Decay Instead

Cosine decay can outperform warmdown in two scenarios:

- **Very short training runs** (under 2,000 steps) where there is not enough time for a meaningful flat phase
- **When not using weight averaging**, since warmdown's advantage comes partly from its synergy with SWA/EMA

### What Not to Optimize

Do not spend time on exotic schedule shapes. The difference between linear warmdown and cosine warmdown is tiny. The difference between 3,500 and 3,600 warmdown steps is noise. Focus your tuning budget on architecture, quantization method, and weight averaging parameters -- those have larger BPB impacts per hour of experimentation.

The learning rate schedule is critical to get right, but the right answer is already known. Use warmdown. Set it to 3,500 steps. Move on to harder problems.`,
    },
  ],
};
