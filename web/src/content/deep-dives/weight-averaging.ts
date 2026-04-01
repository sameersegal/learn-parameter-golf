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
      title: "The Best Technique Nobody Thinks About",
      content: `Here is a strange fact about Parameter Golf. Among the 1,162 parsed submissions, **623 use some form of weight averaging**. Of the top 10 neural-model submissions, 8 out of 10 use it. The best neural entry (PR #1056, 0.018 BPB) uses it. The second-best (PR #1114, 0.024 BPB) uses it. The third-best (PR #945, 0.027 BPB) uses it.

And yet weight averaging requires zero extra parameters. It adds no model capacity. It costs negligible training time. You can implement the most popular variant in 20 lines of Python.

So what is going on? Why does averaging a model's weights over time produce a better model than the final weights alone? The answer lives in the geometry of the loss landscape -- and once you see it, you will never train a model without weight averaging again.`,
    },
    {
      type: "text",
      title: "The Loss Landscape Intuition",
      content: `Picture a wide, shallow valley in mountainous terrain. You are hiking through fog. Each step you take is guided by the slope under your feet, but you cannot see the valley as a whole. Mini-batch noise -- the randomness from seeing different slices of data each step -- blows you around like wind gusts. You zig left, zag right, stumble forward, drift back.

After a long hike, you have been wandering inside the valley for thousands of steps. You never quite reach the center. But here is the key insight: if you dropped a pin at every step and averaged all those pin locations, that average would land very close to the valley's center.

**That is weight averaging.** Instead of using the model from your final training step, you average together many checkpoints from the training trajectory. The averaged model sits closer to the center of the loss basin than any individual checkpoint.

### Why the Center Matters

Two reasons, both critical for Parameter Golf.

**First, the center generalizes better.** A model at the center of a wide basin is robust to small perturbations. Shift the weights a little in any direction and the loss barely changes. A model perched on the edge of the basin is fragile -- any nudge sends it uphill.

**Second, quantization is a nudge.** After training, Parameter Golf submissions crush weights from float32 down to int5 or int6. That rounding introduces noise that perturbs every weight. A model at the center of a flat basin absorbs this noise gracefully. A model at the edge does not. Weight averaging makes your model quantization-friendly, which is arguably even more valuable than the raw BPB improvement.`,
    },
    {
      type: "text",
      title: "The Math Behind the Intuition",
      content: `There is a precise reason this works. For convex functions, **Jensen's inequality** guarantees that the loss at the average of several points is less than or equal to the average of the losses at those points. In other words, the center is at least as good as the typical point.

Neural network losses are not convex globally. But near the end of training, the model has settled into a basin that is approximately convex locally. The conditions for Jensen's inequality roughly hold. Averaging late-training checkpoints produces a point with lower loss than the typical individual checkpoint.

This is not just theory. The original SWA paper (Izmailov et al., 2018) showed empirically that SWA solutions sit at flatter minima than SGD solutions, and that this flatness correlates directly with better generalization on held-out data.

### Two Approaches to Averaging

Parameter Golf competitors have converged on two dominant methods:

| Method | Technique Entries | Key Idea |
|--------|------------------|----------|
| **EMA** | 353 | Running exponential average updated every step |
| **SWA** | 313 | Equal-weight average of checkpoints from the final phase |

Many top submissions use both. Among all 1,162 submissions, 181 use EMA and SWA together. Let's understand each one.`,
    },
    {
      type: "animation",
      title: "Interactive: Weight Averaging in the Loss Landscape",
      animationId: "weight-averaging-demo",
      content:
        "Visualize how SGD checkpoints scatter around a loss valley, and how their average lands closer to the center. Toggle between EMA (which weights recent checkpoints more heavily) and SWA (which weights late checkpoints equally) to see the difference in where the average lands.",
    },
    {
      type: "text",
      title: "EMA: The Workhorse",
      content: `**Exponential Moving Average** maintains a shadow copy of the model's weights throughout training. After each gradient step, the shadow gets nudged toward the current weights:

\`shadow = decay * shadow + (1 - decay) * current_weights\`

The \`decay\` parameter controls how much history to keep. A higher decay means longer memory and a smoother average. At the end of training, you throw away the raw model and use the shadow model for evaluation and export.

### The Decay Sweet Spot

Of the 335 EMA entries that report a decay value, **292 use exactly 0.997**. That is 87% convergence on a single number. This is not a coincidence.

A decay of 0.997 gives an effective averaging window of roughly \`1 / (1 - 0.997) = 333\` steps. For a typical Parameter Golf run of 10,000 to 20,000 steps, that means the EMA primarily reflects the last 2-3% of training, with exponentially fading contributions from earlier steps.

Why 0.997 specifically?

- **Too low (0.95):** The window is only ~20 steps. The shadow barely differs from the raw model. Not enough smoothing.
- **Too high (0.9999):** The window is ~10,000 steps. The shadow carries stale weight from early training, when the model was still far from convergence. You are averaging good weights with bad ones.
- **0.997:** The sweet spot. 333 steps of effective memory -- enough to smooth out SGD noise, recent enough that all contributing weights come from the same loss basin.

| Decay | Entries | Effective Window |
|-------|---------|-----------------|
| **0.997** | **292** | ~333 steps |
| 0.995 | 10 | ~200 steps |
| 0.999 | 9 | ~1,000 steps |
| 0.9985 | 8 | ~667 steps |
| 0.998 | 3 | ~500 steps |

### Delayed EMA Start

Some competitors delay EMA until late in training. PR #1015 starts EMA at step 9,094 of a ~10,000 step run, averaging only the final ~10% of checkpoints. This is a hybrid between EMA and SWA. The logic is sound: it avoids contaminating the shadow with early, unconverged weights entirely.`,
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
            ema.update(model)  # update shadow weights
        ema.apply(model)  # copy EMA weights to model for eval
    """

    def __init__(self, model: torch.nn.Module, decay: float = 0.997):
        self.decay = decay
        self.shadow = deepcopy(model.state_dict())

    @torch.no_grad()
    def update(self, model: torch.nn.Module):
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
      title: "SWA: Equal-Weight Averaging",
      content: `**Stochastic Weight Averaging** takes a different approach. Instead of a running exponential average, SWA saves checkpoints at regular intervals during the final phase of training and averages them with equal weight.

\`final_model = (checkpoint_1 + checkpoint_2 + ... + checkpoint_N) / N\`

The recipe is straightforward. Train normally for most of the run. In the final phase, save a checkpoint every K steps. Average all saved checkpoints. Use the average for evaluation.

### The Interval: Every 50 Steps

Among submissions that report their SWA interval, the consensus is overwhelming. **108 out of 131 reported values are 50 steps.** This means during the averaging phase, a checkpoint is captured roughly every 50 optimizer steps.

Why 50? It is frequent enough to capture diversity (different mini-batch noise at each checkpoint) but infrequent enough that consecutive checkpoints are meaningfully different. Saving every single step would give you hundreds of nearly identical checkpoints, which averages to roughly the same result as EMA with high decay.

### Tight SWA: Narrowing the Window

A variant called **Tight SWA** narrows the averaging window to just the very end of training -- the last 5-10% instead of the last 20-30%. This appears in 14 technique entries, and it shows up at the top of the leaderboard. PR #924 (0.028 BPB) and PR #925 (0.028 BPB) both use "EMA + Tight SWA."

The logic: by the final few percent of a well-tuned training run, every checkpoint is excellent. Averaging them captures diversity from mini-batch noise without risking inclusion of under-trained checkpoints from earlier.

### SWA vs. EMA: When to Choose

| | EMA | SWA |
|-|-----|-----|
| **Memory** | 1x extra model copy | N checkpoint copies (or running sum) |
| **When it averages** | Every step | Every K steps in final phase |
| **Weighting** | Exponential (recent = more) | Equal weight |
| **Implementation** | Simpler | Slightly more code |
| **Technique entries** | 353 | 313 |

In practice, the best submissions use both. EMA smooths out step-to-step noise throughout training. SWA captures broader diversity across the final phase. They operate on different timescales and complement each other.`,
    },
    {
      type: "code",
      title: "SWA Implementation",
      language: "python",
      content: `import torch

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
      title: "The Meta: Combining EMA and SWA",
      content: `181 submissions use both EMA and SWA. This is not redundant. The two techniques operate on different timescales and capture different kinds of diversity.

### How the Best Submissions Stack Them

A typical top-tier workflow looks like this:

- **EMA (decay=0.997)** runs from the start. Every step, the shadow model is updated. This smooths out high-frequency noise -- the step-to-step jitter from mini-batch randomness.
- **SWA (every 50 steps)** captures checkpoints during the final 10-20% of training. Crucially, these are snapshots of **the EMA model**, not the raw model.
- The final model is the SWA average of EMA snapshots. A double-smoothed result.

Think of it like photography. EMA is a short-exposure shot -- it blurs out the tiny vibrations. SWA is a long-exposure composite -- it captures the scene from multiple angles and blends them. Stacking both gives you a sharper final image than either alone.

### Why Double-Smoothing Helps

EMA with decay 0.997 has an effective window of ~333 steps. That is great for smoothing within a narrow region, but it still reflects a single point in time. SWA captures checkpoints spread over thousands of steps, providing geometric diversity that EMA alone cannot.

- **EMA** smooths out the wiggles within a single lap of the loss landscape
- **SWA** averages across multiple laps, capturing the shape of the basin itself

### The Leaderboard Evidence

Among the top neural-model submissions that use weight averaging:

| PR | BPB | Weight Averaging | Optimizer |
|----|-----|-----------------|-----------|
| #1056 | 0.018 | SWA + EMA | Muon |
| #1114 | 0.024 | EMA | Muon |
| #945 | 0.027 | EMA + SWA | AdamW |
| #924 | 0.028 | EMA + Tight SWA | Muon |
| #925 | 0.028 | EMA + Tight SWA | Muon |
| #933 | 0.080 | EMA + SWA | Muon |
| #986 | 0.083 | EMA + Tight SWA | Parallel Muon |
| #961 | 0.088 | EMA + SWA | Parallel Muon |

Notice the pattern. The very best neural entry uses both SWA and EMA. Most of the top tier combines them as well. The only top-10 neural entry using EMA alone is PR #1114 -- and it is already the second-best neural result.

There is no single "best" method. What matters is that you use at least one.`,
    },
    {
      type: "text",
      title: "Weight Averaging Meets Quantization",
      content: `This is where weight averaging becomes not just useful but essential for Parameter Golf. After training, submissions quantize weights from float32 to int5 or int6 to fit the 16MB artifact limit. Quantization rounds every weight to a coarser grid. That rounding is noise.

### Why Averaged Weights Quantize Better

Remember the valley analogy. A model at the center of a wide basin can tolerate more perturbation before the loss increases. Weight averaging pushes the model toward that center.

When you quantize a model at the center of a flat basin, the rounding nudges weights slightly, but the loss barely changes. When you quantize a model at the edge of a sharp basin, the same rounding can push the model uphill significantly.

The practical consequence: averaged models lose less to quantization.

Consider two identical architectures trained with the same recipe, one using weight averaging and one without. The averaged model does not just start at a lower BPB. It also **degrades less** when you quantize. The gap between "with WA" and "without WA" actually widens after quantization.

This makes weight averaging even more valuable than the raw training BPB improvement suggests. In a competition where every submission gets quantized, robustness to quantization noise is a first-class concern.

### The QAT Connection

573 submissions use both weight averaging and quantization -- that is 92% of the weight-averaging submissions. Several combine EMA with **Quantization-Aware Training (QAT)**, which simulates quantization noise during training so the model learns to be robust to it.

PR #1002 explicitly uses EMA with \`decay=0.997\` alongside QAT with activation reset. The EMA provides a stable smoothed target while QAT adapts the model to quantization boundaries. PR #921 (0.094 BPB) pairs EMA with QAT as well. The two techniques reinforce each other: EMA finds the center of the basin, QAT flattens the basin around it.`,
    },
    {
      type: "text",
      title: "Practical Playbook",
      content: `Based on the 749 weight averaging technique entries across 623 submissions, here is a concrete playbook ranked by effort and impact.

### Step 1: Add EMA (5 minutes of work)

Add EMA with \`decay=0.997\`. This is the single highest return-on-effort technique in Parameter Golf. 292 submissions use this exact value. The implementation is ~20 lines. The overhead is negligible -- one extra copy of the model in memory, one multiply-add per parameter per step.

Always use the EMA model for evaluation and export. Never evaluate the raw training model.

### Step 2: Add SWA (10 minutes of work)

During the final 10-20% of training, capture a snapshot of the EMA model every 50 steps. Average all snapshots at the end. This gives you diversity on top of the smoothing that EMA already provides.

If your training is well-tuned and you use warmdown (a learning rate that decays to zero over the final portion), try **Tight SWA** -- narrow the window to the last 5-10%. When your LR schedule has already brought the model close to convergence, all checkpoints in this window are excellent and tightly clustered.

### Common Pitfalls

- **Starting EMA too early with high decay.** If training begins far from the optimum, a 0.997 decay EMA carries ghost weight from bad early checkpoints for hundreds of steps. Either use a lower initial decay or delay EMA start until the model has warmed up.

- **SWA during aggressive LR decay.** The original SWA paper recommends a cyclical or constant LR during the SWA phase. In Parameter Golf, most submissions use warmdown (monotonically decaying LR), which means later SWA checkpoints are less diverse. This still works well -- the reduced diversity is offset by all checkpoints being near-optimal.

- **Forgetting non-trainable buffers.** If your model uses batch normalization, the running mean and variance statistics need special handling after averaging. Either recompute them on a calibration batch, or use layer norm instead (which has no running statistics). Most Parameter Golf submissions use layer norm, so this is rarely an issue in practice.

### The One-Liner

If you change nothing else about your submission, add \`EMA(model, decay=0.997)\` and update it every step. It is the closest thing to a free lunch in this competition.`,
    },
    {
      type: "text",
      title: "Synthesis: Averaging Is Implicit Ensembling",
      content: `Here is the mental model to take away from this article.

Every training step produces a slightly different model. These models are like members of an ensemble -- they agree on the broad strokes but disagree on the noise. Traditional ensembling would run all of them at inference time and average the predictions. That costs N times the compute.

**Weight averaging gets you most of the ensemble benefit for free.** Instead of averaging predictions (which requires running N models), you average weights (which produces a single model). For the roughly-convex loss basins where training converges, averaging weights before the forward pass is nearly equivalent to averaging predictions after it. You get the smoothing, the variance reduction, and the noise cancellation of an ensemble -- packed into a single model with zero extra inference cost.

That is why 623 out of 1,162 submissions use it. That is why 8 of the top 10 neural entries use it. That is why the two that skip it (PR #883 and PR #913) are the exception, not the rule.

The technique was invented decades ago. The theory is well-understood. The implementation is trivial. And in a competition where every 0.01 BPB matters, it remains one of the most reliable ways to move the needle.

Add EMA. Add SWA. Average your weights. Then move on to the hard problems.`,
    },
  ],
};
