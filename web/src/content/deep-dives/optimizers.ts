import { DeepDive } from "@/lib/types";

export const optimizers: DeepDive = {
  slug: "optimizers",
  title: "The Muon Optimizer",
  subtitle: "Why Parameter Golf's best players abandoned Adam",
  category: "optimizer_technique",
  order: 3,
  sections: [
    {
      type: "text",
      title: "84.6% of Submissions Use Muon. Why?",
      content: `Among the 736 Parameter Golf submissions that specify an optimizer, **623 use a Muon-family optimizer** — that's 84.6%. Adam and AdamW, the industry defaults for the past decade, account for just 12.5%.

This isn't a niche preference. It's a landslide. The best neural-model submission (PR #1056, 0.018 BPB) uses Muon. So do PR #1114 (0.024 BPB), PR #924 (0.028 BPB), and PR #925 (0.028 BPB). The only competitive AdamW entries — PR #945 (0.027 BPB) and PR #883 (0.031 BPB) — are outliers.

What do these competitors know that the rest of the ML world doesn't? To answer that, we need to understand what Adam actually does — and what it quietly gets wrong.`,
    },
    {
      type: "text",
      title: "Adam: A Quick Refresher (and Its Hidden Assumption)",
      content: `Adam maintains two moving averages for each parameter: the mean gradient (first moment) and the mean squared gradient (second moment). It divides the gradient by the square root of the second moment, giving each parameter its own adaptive learning rate.

This works brilliantly when parameters are independent scalars — biases, layer norms, scalar gates. But in a neural network, most parameters live in **weight matrices**. And here's the thing Adam gets wrong:

**Adam treats every element of a weight matrix as an independent number.** It doesn't know — or care — that weight \\(W_{ij}\\) lives in row \\(i\\) and column \\(j\\) of a matrix that performs a linear transformation. It applies the same element-wise rescaling to a 512×512 matrix as it would to 262,144 unrelated scalars.

### Why This Matters

A weight matrix \\(W\\) maps input vectors to output vectors via \\(y = Wx\\). The "quality" of this mapping depends on the matrix's **spectral structure** — its singular values. A matrix with balanced singular values uses all its dimensions effectively. A matrix where one singular value dominates wastes most of its capacity on a single direction.

Adam's per-element scaling can distort this spectral structure. When it scales down a gradient element because that particular weight has been jittery, it doesn't consider that this might squash an important direction of the overall matrix transformation.

Think of it this way: Adam is like a photo editor that adjusts each pixel's brightness independently. It might produce a sharp image — or it might introduce bizarre artifacts because it doesn't understand the spatial relationships between pixels. Muon, by contrast, adjusts the entire image with awareness of its structure.`,
    },
    {
      type: "text",
      title: "Enter Muon: Optimization on the Matrix Manifold",
      content: `Muon (Matrix Updates via Orthogonalization for Neural networks) takes a fundamentally different approach. Instead of treating weight matrices as bags of numbers, it treats them as **matrices** — objects with rows, columns, and spectral structure.

The core algorithm is surprisingly simple:

1. Compute the gradient \\(G\\) for a weight matrix \\(W\\) (same as any optimizer)
2. Apply momentum to get the combined gradient direction \\(M\\)
3. **Orthogonalize** \\(M\\) — replace it with the closest orthogonal matrix
4. Use this orthogonalized direction as the update

Step 3 is the key insight. The orthogonalized update has all singular values equal to 1. This means the update pushes equally in all directions of the matrix's column and row spaces. No direction gets a disproportionately large or small update.

### What "Orthogonalize" Means Intuitively

Every matrix can be decomposed via SVD: \\(M = U \\Sigma V^T\\), where \\(\\Sigma\\) is a diagonal matrix of singular values. The singular values tell you how much the matrix "stretches" each direction.

Orthogonalization replaces \\(\\Sigma\\) with the identity matrix: \\(M_{\\text{orth}} = U V^T\\). The result keeps the same rotation/reflection structure (the "directions" encoded in \\(U\\) and \\(V\\)) but makes every direction equally weighted.

This ensures that the optimizer update doesn't favor some directions over others. Each dimension of the weight matrix receives the same magnitude of update, adjusted only by direction — not by the accident of which components happen to have larger gradients.

### The Net Effect

Where Adam might update one singular value by 0.001 and another by 0.1 (a 100x imbalance), Muon updates all singular values by the same amount. This leads to:

- **Better conditioning**: Weight matrices maintain balanced spectral structure throughout training
- **Faster convergence**: No wasted capacity on over-updated or under-updated dimensions
- **More efficient parameter usage**: Critical for Parameter Golf's size constraints, where every parameter must pull its weight`,
    },
    {
      type: "animation",
      title: "Interactive: Adam vs. Muon Weight Updates",
      animationId: "muon-vs-adam-demo",
      content:
        "Compare how Adam and Muon update a weight matrix's singular values. Adam's per-element scaling creates uneven updates across dimensions, while Muon's orthogonalization produces uniform spectral updates. Click \"Step\" to advance the optimizer one iteration.",
    },
    {
      type: "text",
      title: "Newton-Schulz Iterations: The Secret Sauce",
      content: `Orthogonalizing a matrix the "obvious" way requires computing an SVD — an \\(O(n^3)\\) operation that's painfully slow on GPU. Muon avoids this entirely by using **Newton-Schulz iterations**, an iterative method that converges to the orthogonalized matrix using only matrix multiplications — exactly the operation GPUs are built for.

### The Algorithm

Starting from a matrix \\(X_0 = G\\) (the gradient, normalized so its largest singular value is < 1), the iteration is:

$$X_{k+1} = \\frac{1}{2} X_k (3I - X_k^T X_k)$$

Each iteration roughly doubles the number of correct digits. After just 5 iterations, the result is accurate to ~32 bits of precision — more than enough for training.

### Why It Works

The iteration is solving for \\(X\\) such that \\(X^T X = I\\) (the definition of an orthogonal matrix). Each step pushes the singular values of \\(X\\) closer to 1:

- Singular values > 1 get pushed down
- Singular values < 1 get pushed up
- Singular values at exactly 1 stay put

It's like a "spectral equalizer" — each iteration smooths out the differences between singular values, until they're all equal to 1.`,
    },
    {
      type: "animation",
      title: "Interactive: Newton-Schulz Convergence",
      animationId: "newton-schulz-demo",
      content:
        "Step through Newton-Schulz iterations on a matrix with uneven singular values. Watch how each iteration pushes all singular values toward 1, converging to a perfectly orthogonal matrix in just 5 steps.",
    },
    {
      type: "code",
      title: "The Core Muon Step in PyTorch",
      language: "python",
      content: `import torch

def newton_schulz_orthogonalize(G: torch.Tensor, steps: int = 5) -> torch.Tensor:
    """Orthogonalize a gradient matrix using Newton-Schulz iterations.

    This is the heart of the Muon optimizer. It replaces the gradient's
    singular values with 1s while preserving the singular vectors.
    """
    # Normalize so spectral norm < 1 (required for convergence)
    a, b, c = (3.4445, -4.7750, 2.0315)  # optimized coefficients
    X = G / (G.norm() + 1e-7)

    # Transpose if needed so rows >= cols (faster)
    if X.shape[0] > X.shape[1]:
        X = X.T
        transpose = True
    else:
        transpose = False

    for _ in range(steps):
        A = X @ X.T
        # Horner-form polynomial: more numerically stable
        X = a * X + b * (A @ X) + c * (A @ (A @ X))

    return X.T if transpose else X


def muon_step(W: torch.Tensor, grad: torch.Tensor,
              momentum_buffer: torch.Tensor,
              lr: float = 0.02, momentum: float = 0.95) -> torch.Tensor:
    """One step of the Muon optimizer for a weight matrix."""
    # 1. Apply momentum
    momentum_buffer.mul_(momentum).add_(grad)

    # 2. Orthogonalize the momentum buffer
    update = newton_schulz_orthogonalize(momentum_buffer)

    # 3. Update weights
    W.data.add_(update, alpha=-lr)

    return W`,
    },
    {
      type: "text",
      title: "Parallel Muon and NorMuon: Variants in the Wild",
      content: `Not all parameters are matrices, and not all matrices benefit equally from spectral orthogonalization. This has led to two popular variants in Parameter Golf:

### Parallel Muon (82 submissions)

The most common setup: use Muon for the main weight matrices (attention projections, MLP layers) but fall back to Adam for everything else:

- **Embedding layers**: These are lookup tables, not linear transformations. Orthogonalization doesn't make conceptual sense here — you're not transforming vectors, you're indexing into a codebook.
- **Biases**: 1D vectors, not matrices. Can't be orthogonalized.
- **Layer norm parameters**: Scale and shift parameters that are applied element-wise.

This "parallel" approach gets the best of both worlds: spectral-aware updates where they matter, and proven Adam behavior for the rest.

### NorMuon (13 submissions)

A normalized variant that applies additional normalization on top of the orthogonalized update. While less common, it appears in some competitive entries and may offer benefits when combined with specific learning rate schedules.

### Which to Use?

The data is clear: pure Muon and Parallel Muon both dominate the leaderboard. Among the top 10 neural-model submissions, all use some form of Muon. The choice between Muon and Parallel Muon is mostly about implementation convenience — the performance difference is negligible.`,
    },
    {
      type: "text",
      title: "Muon in Practice: The Winning Recipe",
      content: `Muon doesn't operate in isolation. The Parameter Golf meta has converged on a specific recipe that pairs Muon with complementary techniques:

### The Standard Stack

| Component | Technique | Usage |
|-----------|-----------|-------|
| **Optimizer** | Muon (+ Adam for embeddings) | 84.6% of entries |
| **LR Schedule** | Warmdown | 401 submissions |
| **Weight Averaging** | EMA | 353 submissions |
| **Weight Averaging** | SWA | 313 submissions |
| **Initialization** | OrthoInit | 167 submissions |
| **Quantization** | int6 or int5 | Most top entries |

### Why This Combination Works

- **Muon + Warmdown**: Warmdown gradually reduces the learning rate to zero over the final portion of training. This pairs naturally with Muon's uniform-magnitude updates — as the learning rate drops, all dimensions shrink equally, producing a smooth convergence.
- **Muon + EMA/SWA**: Exponential Moving Average and Stochastic Weight Averaging smooth out the training trajectory. Because Muon's updates maintain spectral balance, the averaged weights also maintain good spectral properties.
- **Muon + OrthoInit**: Orthogonal initialization gives weight matrices balanced singular values from the start. Muon then maintains this balance throughout training. Without OrthoInit, Muon has to spend early training steps fixing the spectral imbalance from random initialization.

### Case Studies

**PR #1056 (0.018 BPB)** — The best neural-model entry. Uses the full stack: Muon optimizer, int6 quantization, EMA + SWA weight averaging, zstd compression, BigramHash embeddings, XSA attention, plus an n-gram cache for the final edge.

**PR #924 (0.028 BPB)** — Muon with EMA and "Tight SWA" (a narrower averaging window), GPTQ-lite quantization, and score-first test-time training. Demonstrates how Muon integrates cleanly with TTT approaches.

**PR #945 (0.027 BPB)** — The notable AdamW counterpoint. Achieves competitive results with AdamW by pairing it with a frozen n-gram oracle and learned gating. Shows that optimizer choice matters less when most of your BPB comes from a non-neural component.`,
    },
    {
      type: "text",
      title: "When NOT to Use Muon",
      content: `The absolute top of the Parameter Golf leaderboard tells a humbling story for neural optimizers:

| Rank | PR | BPB | Method | Optimizer |
|------|-----|------|--------|-----------|
| 1 | #959 | ~0.000 | N-gram + log-bias | SGD |
| 2 | #1076 | 0.011 | Packed causal n-gram + Dirichlet | None |
| 3 | #943 | 0.017 | Packed causal memory + Dirichlet | None |
| 4 | #944 | 0.017 | Packed causal memory + Dirichlet | None |
| 5 | #1056 | 0.018 | Neural + n-gram cache | Muon |

The four best submissions don't use Muon — or any neural optimizer at all. They're pure statistical methods: n-gram tables with Dirichlet backoff, packed causal memory, and clever compression. These approaches store frequency counts, not learned weights, so the question of optimizer choice is irrelevant.

**The lesson**: Muon is the best optimizer for training neural weight matrices. But "train a better neural network" isn't always the best strategy. When your 16MB budget can store enough n-gram statistics to outperform any neural model, the optimizer doesn't matter.

Muon dominates within the neural-model paradigm. The question of whether to use that paradigm at all is a different — and arguably more important — decision.`,
    },
    {
      type: "text",
      title: "Synthesis: Adam Optimizes Numbers, Muon Optimizes Matrices",
      content: `The shift from Adam to Muon in Parameter Golf reflects a deeper insight about how neural networks work:

**Weight matrices are not bags of independent numbers.** They're linear transformations with spectral structure — singular values and singular vectors that determine how they map inputs to outputs. An optimizer that respects this structure can extract more capacity from fewer parameters.

In a competition with a 16MB size limit, "more capacity per parameter" directly translates to better BPB scores. This is why Muon dominates: not because it finds lower-loss minima in theory, but because it uses each parameter more efficiently in practice.

### Key Takeaways

1. **Adam's element-wise scaling ignores matrix structure.** This is fine for large models where you have parameters to spare. It's wasteful when every byte counts.

2. **Muon's orthogonalized updates maintain spectral balance.** All directions get equal-magnitude updates, preventing the capacity waste that comes from over- or under-trained dimensions.

3. **Newton-Schulz iterations make this practical.** Five matrix multiplications — operations GPUs are optimized for — replace an expensive SVD decomposition.

4. **The recipe matters as much as the optimizer.** Muon works best with warmdown scheduling, EMA/SWA averaging, and orthogonal initialization. These techniques reinforce each other's strengths.

5. **Know when it doesn't apply.** Statistical methods (n-grams, Dirichlet models) don't have weight matrices to optimize. The best approach depends on whether your bottleneck is model quality or storage format.

As the broader ML community pushes toward smaller, more efficient models — through distillation, pruning, and quantization — the insight that "matrices deserve matrix-aware optimization" is likely to matter far beyond Parameter Golf.`,
    },
  ],
};
