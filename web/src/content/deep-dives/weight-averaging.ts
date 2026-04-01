import { DeepDive } from "@/lib/types";

export const weightAveraging: DeepDive = {
  slug: "weight-averaging",
  title: "Weight Averaging",
  subtitle: "SWA, EMA, and ensemble-like approaches that cost almost nothing",
  category: "weight_averaging",
  order: 4,
  sections: [
    {
      type: "text",
      title: "The Cheapest 0.12 BPB You'll Ever Get",
      content: `Of the 966 Parameter Golf submissions with a reported BPB score, **563 use some form of weight averaging**. Their average BPB is 1.114 — compared to 1.343 for submissions without it. That's a 0.23 BPB gap, and while it's confounded by skill level (better submitters tend to use more techniques), the pattern is unmistakable.

Every single top-10 neural submission uses weight averaging. It requires no extra parameters, no additional model capacity, and adds negligible training time. It's the closest thing to a free lunch in this competition.

### What is Weight Averaging?

The core idea is simple: instead of using the final checkpoint from training, **average together multiple checkpoints** from the training trajectory. The averaged model is often better than any individual checkpoint because averaging smooths out the noise in SGD's path through the loss landscape.

There are two dominant approaches in Parameter Golf:

| Method | Submissions | Key Idea |
|--------|------------|----------|
| EMA | 323 | Running exponential average of weights during training |
| SWA | 278 | Average checkpoints from the final phase of training |
| EMA + SWA | 51 | Both methods combined |
| Tight SWA | 30 | SWA over a narrower window |
| Polyak | 7 | Simple running average (EMA special case) |

Let's understand why these work, starting with the geometry of the loss landscape.`,
    },
    {
      type: "text",
      title: "The Loss Landscape Intuition",
      content: `SGD (and variants like Muon) don't walk a straight line to the optimum. They bounce around, driven by mini-batch noise. Near the end of training, the model oscillates around a good region of the loss landscape rather than sitting still at a single point.

### Why Averaging Helps

Imagine the loss landscape as a wide, flat valley. SGD bounces the model between the walls of this valley — each checkpoint is good, but slightly off-center in different directions. The average of these checkpoints lands closer to the **center of the valley**, which typically generalizes better.

This isn't just hand-waving. There's a precise geometric reason:

**For convex loss functions**, the average of multiple points is always at least as good as the average of their individual losses (Jensen's inequality). Real neural network losses aren't convex, but near the end of training, the local landscape is approximately convex — the model has settled into a basin.

**For flat minima**, weight averaging acts as an implicit regularizer. A model at the center of a wide basin is more robust to perturbations (like quantization noise or distribution shift in test data) than one perched on the edge.

### The Parameter Golf Angle

This matters especially here because of **quantization**. After training, weights get crushed from float32 down to int5 or int6. This introduces significant noise. A model at the center of a flat minimum tolerates this noise better than one at a sharp minimum — the loss barely changes when weights are perturbed slightly.`,
    },
    {
      type: "animation",
      title: "Interactive: Weight Averaging in the Loss Landscape",
      animationId: "weight-averaging-demo",
      content:
        "Visualize how SGD checkpoints scatter around a loss valley, and how their average lands closer to the center. Toggle between EMA (weighted recent checkpoints more) and SWA (equal-weight average of late checkpoints) to see the difference.",
    },
    {
      type: "text",
      title: "EMA: The Workhorse (323 Submissions)",
      content: `Exponential Moving Average maintains a shadow copy of the model's weights throughout training. After each gradient step, the shadow weights are updated:

$$\\theta_{\\text{EMA}} \\leftarrow \\alpha \\cdot \\theta_{\\text{EMA}} + (1 - \\alpha) \\cdot \\theta_{\\text{current}}$$

where \\(\\alpha\\) is the decay parameter. The final model uses \\(\\theta_{\\text{EMA}}\\) instead of \\(\\theta_{\\text{current}}\\).

### The Decay Parameter

The decay \\(\\alpha\\) controls how much history to keep. Higher values = longer memory, smoother average. Parameter Golf has overwhelmingly converged on a single value:

| Decay | Submissions |
|-------|------------|
| **0.997** | **292** |
| 0.999 | 10 |
| 0.995 | 10 |
| 0.998 | 9 |
| 0.9985 | 8 |

**0.997 is used by 85% of EMA submissions.** This isn't an accident — it corresponds to an effective averaging window of about \\(1/(1-0.997) \\approx 333\\) steps. For typical Parameter Golf training runs of 10,000-20,000 steps, this means the EMA primarily reflects the last ~2-3% of training, with exponentially decaying contributions from earlier steps.

### Why 0.997?

A decay of 0.997 strikes a balance:
- **Too low** (e.g., 0.95): The average barely differs from the current weights. You're averaging over only ~20 steps — not enough to smooth anything.
- **Too high** (e.g., 0.9999): The average is dominated by weights from much earlier in training, before the model has converged. You're averaging good weights with mediocre ones.
- **0.997**: The sweet spot. Roughly 333 steps of effective memory — enough to smooth out SGD noise, recent enough that all averaged weights are in the same basin.

### Implementation Detail: Start Step

Some submissions delay EMA until later in training. PR #1015 starts EMA at step 9,094 (of a ~10,000 step run), effectively averaging only the final ~10% of checkpoints. This is a hybrid between EMA and SWA — it avoids contaminating the average with early, unconverged weights.`,
    },
    {
      type: "code",
      title: "EMA Implementation",
      language: "python",
      content: `import torch
from copy import deepcopy

class EMA:
    """Exponential Moving Average of model weights.

    Usage:
        ema = EMA(model, decay=0.997)
        for batch in dataloader:
            loss = model(batch)
            loss.backward()
            optimizer.step()
            ema.update()  # update shadow weights
        ema.apply()  # copy EMA weights to model for eval
    """

    def __init__(self, model: torch.nn.Module, decay: float = 0.997):
        self.decay = decay
        self.shadow = deepcopy(model.state_dict())
        self.step_count = 0

    @torch.no_grad()
    def update(self, model: torch.nn.Module):
        self.step_count += 1
        for name, param in model.named_parameters():
            if param.requires_grad:
                self.shadow[name].mul_(self.decay).add_(
                    param.data, alpha=1 - self.decay
                )

    def apply(self, model: torch.nn.Module):
        """Copy EMA weights into the model (for evaluation/export)."""
        model.load_state_dict(self.shadow)`,
    },
    {
      type: "text",
      title: "SWA: Equal-Weight Averaging (278 Submissions)",
      content: `Stochastic Weight Averaging takes a different approach. Instead of maintaining a running average throughout training, SWA saves checkpoints at regular intervals during the final phase and averages them with equal weight.

$$\\theta_{\\text{SWA}} = \\frac{1}{N} \\sum_{i=1}^{N} \\theta_{t_i}$$

### How It Works in Practice

1. Train normally for most of the run
2. In the final phase, save a checkpoint every \\(K\\) steps
3. Average all saved checkpoints equally
4. Use the averaged model for evaluation

### SWA Interval

Among submissions that report their SWA interval, **every 50 steps** is the overwhelming consensus (21 of 21 reported values). This means during the averaging phase, a checkpoint is captured roughly every 50 optimizer steps.

### Tight SWA: A Popular Variant (30 Submissions)

"Tight SWA" narrows the averaging window to just the very end of training. Where standard SWA might average over the last 20-30% of training, Tight SWA averages over the last 5-10%. This is particularly popular among the top submissions — PR #924 (0.028 BPB) and PR #925 (0.028 BPB) both use "EMA + Tight SWA."

The logic: by the end of a well-tuned training run, all checkpoints in the final few percent are already excellent. Averaging them captures diversity (different mini-batch noise) without the risk of including under-trained checkpoints from earlier.

### SWA vs. EMA: When to Choose What

| | EMA | SWA |
|-|-----|-----|
| **Memory** | 1x extra model copy | N checkpoint copies (or running sum) |
| **When to average** | Every step | Every K steps in final phase |
| **Weighting** | Exponential (recent = more) | Equal weight |
| **Implementation** | Simpler | Slightly more complex |
| **Usage in PG** | 323 submissions | 278 submissions |

In practice, the best submissions use both: EMA for smoothing throughout training, plus SWA over the final phase for an additional boost.`,
    },
    {
      type: "code",
      title: "SWA Implementation",
      language: "python",
      content: `import torch
from copy import deepcopy

class SWA:
    """Stochastic Weight Averaging over training checkpoints.

    Usage:
        swa = SWA(model)
        for step, batch in enumerate(dataloader):
            loss = model(batch)
            loss.backward()
            optimizer.step()
            if step >= swa_start_step and step % 50 == 0:
                swa.capture(model)
        swa.apply(model)  # average and load
    """

    def __init__(self, model: torch.nn.Module):
        self.running_sum = {
            name: torch.zeros_like(param)
            for name, param in model.named_parameters()
            if param.requires_grad
        }
        self.n_captures = 0

    @torch.no_grad()
    def capture(self, model: torch.nn.Module):
        """Add current weights to the running sum."""
        self.n_captures += 1
        for name, param in model.named_parameters():
            if name in self.running_sum:
                self.running_sum[name].add_(param.data)

    def apply(self, model: torch.nn.Module):
        """Load the averaged weights into the model."""
        avg_state = {
            name: total / self.n_captures
            for name, total in self.running_sum.items()
        }
        state = model.state_dict()
        state.update(avg_state)
        model.load_state_dict(state)`,
    },
    {
      type: "text",
      title: "Combining EMA + SWA: The Meta",
      content: `51 submissions use both EMA and SWA together. This isn't redundant — the two techniques operate on different timescales and capture different aspects of the training trajectory.

### The Combined Recipe

A typical top-tier submission does this:

1. **EMA (decay=0.997)** runs from the start of training. Every step, the shadow model is updated. This smooths out high-frequency noise.

2. **SWA (every 50 steps)** captures checkpoints during the final 10-20% of training. These checkpoints are of the **EMA model**, not the raw model.

3. The final model is the SWA average of EMA snapshots — a double-smoothed result.

### Why This Works Better Than Either Alone

EMA with decay=0.997 has an effective window of ~333 steps. This is great for smoothing step-to-step noise, but it still reflects a single point in time. SWA captures checkpoints spread over thousands of steps, providing diversity that EMA alone can't.

Think of it this way:
- **EMA** smooths out the wiggles within a single lap of the loss landscape
- **SWA** averages across multiple laps, capturing the shape of the basin itself

### The Leaderboard Evidence

Among the top 15 neural submissions with weight averaging:

| PR | BPB | Method | Optimizer |
|----|------|--------|-----------|
| #1056 | 0.018 | SWA | Muon |
| #1114 | 0.024 | EMA | Muon |
| #945 | 0.027 | EMA | AdamW |
| #924 | 0.028 | EMA + Tight SWA | Muon |
| #925 | 0.028 | EMA + Tight SWA | Muon |
| #933 | 0.080 | EMA | Muon |
| #986 | 0.083 | EMA | Parallel Muon |
| #961 | 0.088 | EMA | Parallel Muon |

The very best (PR #1056) uses SWA alone. The next tier is split between EMA and EMA + Tight SWA. There's no single "best" method — what matters is that you use at least one.`,
    },
    {
      type: "text",
      title: "Weight Averaging Meets Quantization",
      content: `Weight averaging and quantization interact in a subtle but important way. Remember: after training, Parameter Golf submissions quantize weights from float32 to int5/int6/int8 to fit the 16MB artifact limit. This quantization introduces noise.

### Flat Minima and Quantization Robustness

A model at the center of a flat loss basin can tolerate more perturbation before the loss increases. Weight averaging pushes the model toward the center. This means:

- **Averaged weights quantize better.** The loss degradation from rounding float32 to int6 is smaller when the model sits at a flat minimum.
- **You can quantize more aggressively.** Some submissions that use weight averaging successfully quantize to int5 (5 bits), while submissions without averaging need int6 or int8 for the same loss.

### The Practical Consequence

Consider two identical models, one with weight averaging and one without:

| | Without WA | With WA |
|-|-----------|---------|
| float32 BPB | 1.10 | 1.08 |
| After int6 quantization | 1.15 | 1.10 |
| Quantization penalty | +0.05 | +0.02 |

The averaged model not only starts at a lower BPB — it also loses less from quantization. The gap widens after quantization, making weight averaging even more valuable than the raw training improvement suggests.

### QAT Interaction

Several submissions combine weight averaging with Quantization-Aware Training (QAT). The EMA model accumulates smoothed weights while QAT adapts the model to quantization noise. PR #1002 explicitly uses EMA with decay=0.997 alongside QAT activation reset — the EMA provides a stable target while QAT fine-tunes quantization boundaries.`,
    },
    {
      type: "text",
      title: "Practical Recommendations",
      content: `Based on the 749 weight averaging technique entries across 563 submissions, here's the practical playbook:

### Start Here

1. **Add EMA with decay=0.997.** This is the single most impactful and easiest technique. 292 submissions use exactly this value. The implementation is ~20 lines of code and negligible training overhead.

2. **Use the EMA model for evaluation and export.** Don't evaluate the raw training model — always evaluate the shadow model.

### Level Up

3. **Add SWA over the final 10-20% of training**, capturing every 50 steps. Average the EMA snapshots (not the raw model snapshots).

4. **Consider Tight SWA** if your training run is well-tuned. Narrowing the SWA window to the last 5-10% can help when your learning rate schedule (warmdown) has already brought the model close to convergence.

### Common Pitfalls

- **Starting EMA too early with high decay**: If training starts far from the optimum, a high decay EMA will carry "memory" of bad early weights for thousands of steps. Either use a lower decay early on, or delay EMA start.

- **SWA with a decaying learning rate**: The original SWA paper recommends a cyclical or constant learning rate during the SWA phase. In Parameter Golf, most submissions use warmdown (decaying LR), which means later SWA checkpoints are at lower learning rates and thus less diverse. This still works well — the reduced diversity is offset by all checkpoints being very close to the optimum.

- **Forgetting to average non-trainable buffers**: Batch norm running statistics, if present, need special handling. Either re-compute them after averaging, or use layer norm (which is stateless).

### The One-Liner Summary

If you do nothing else to your submission, add \`EMA(model, decay=0.997)\` and update it every step. It's the highest return-on-effort technique in Parameter Golf.`,
    },
  ],
};
