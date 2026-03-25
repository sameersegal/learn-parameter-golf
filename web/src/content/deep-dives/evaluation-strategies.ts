import { DeepDive } from "@/lib/types";

export const evaluationStrategies: DeepDive = {
  slug: "evaluation-strategies",
  title: "Evaluation Strategies",
  subtitle: "Sliding window eval, N-gram mixing, and scoring techniques",
  category: "evaluation_technique",
  order: 10,
  sections: [
    {
      type: "text",
      title: "Why Evaluation Strategy Matters",
      content: `In Parameter Golf, your score is **val_bpb** (validation bits-per-byte). How you *evaluate* the model — not just how you train it — directly affects this number. A smarter evaluation strategy can shave hundredths off your BPB without changing a single model weight.

The core challenge: language models are trained on fixed-length sequences, but evaluation documents are much longer. How you slide your context window across the document determines which tokens get good context and which don't.

### The Naive Approach

The simplest evaluation: chop the document into non-overlapping chunks of \`seq_len\` tokens and evaluate each independently. The first token of each chunk has zero context — it's essentially guessing. This wastes capacity and inflates BPB.

### The Insight

Overlapping windows let every token (except the very first) benefit from a full context of prior tokens. You only *score* the tokens in the non-overlapping "stride" portion, but the model *sees* the full window. This is strictly better than non-overlapping evaluation.`,
    },
    {
      type: "animation",
      title: "Interactive: Sliding Window Evaluation",
      animationId: "sliding-window-demo",
      content:
        "Drag the stride slider to see how the evaluation window moves across a document. Yellow tokens are scored; blue tokens provide context. Notice how a smaller stride means more overlap and more compute, but every scored token gets full context.",
    },
    {
      type: "code",
      title: "Sliding Window Evaluation",
      language: "python",
      content: `import torch
import torch.nn.functional as F

def sliding_window_eval(model, tokens, seq_len=1024, stride=64):
    """Evaluate with overlapping sliding windows.

    Args:
        model: Language model returning logits
        tokens: 1D tensor of token IDs for the full document
        seq_len: Context window size (model's training length)
        stride: How many new tokens to score per window step

    Returns:
        Average bits-per-byte (BPB) over the document
    """
    total_loss = 0.0
    total_tokens = 0
    device = next(model.parameters()).device

    for start in range(0, len(tokens) - 1, stride):
        end = min(start + seq_len, len(tokens))
        input_ids = tokens[start:end].unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(input_ids)

        # Only score the last 'stride' tokens (or all if first window)
        # These are the tokens that have full context behind them
        score_start = max(0, seq_len - stride) if start > 0 else 0
        score_logits = logits[0, score_start:-1]
        score_targets = input_ids[0, score_start + 1:]

        loss = F.cross_entropy(score_logits, score_targets, reduction='sum')
        total_loss += loss.item()
        total_tokens += score_targets.numel()

        if end >= len(tokens):
            break

    # Convert nats-per-token to bits-per-byte
    # Assumes ~3.5 characters per token, 1 byte per character
    nats_per_token = total_loss / total_tokens
    bits_per_token = nats_per_token / 0.6931  # ln(2)
    bpb = bits_per_token / 3.5  # approximate tokens-to-bytes ratio
    return bpb`,
    },
    {
      type: "text",
      title: "Stride Selection: Why 64 Dominates",
      content: `Across Parameter Golf submissions, **stride=64 is used by ~88% of competitive entries**. Here's why:

### The Trade-off

| Stride | Overlap | Compute Cost | Quality |
| --- | --- | --- | --- |
| seq_len (1024) | 0% | 1x (baseline) | Worst — many tokens lack context |
| 256 | 75% | ~4x | Good |
| 64 | 94% | ~16x | Excellent — near-optimal context |
| 32 | 97% | ~32x | Marginal gain over 64 |
| 1 | 99.9% | ~1024x | Theoretically optimal, impractical |

**stride=64** hits the sweet spot: 94% overlap ensures nearly every scored token sees a full 1024-token context, while keeping compute at ~16x (manageable within competition time limits).

### The One Exception

PR #511 used **stride=32** with a 2048-token context window. The longer context justified the finer stride — with 2048 tokens of context, stride=32 gives 98.4% overlap. But this is rare; most submissions use the standard 1024 context.

### Key Insight

Stride doesn't change your model — it changes how thoroughly you evaluate it. A smaller stride always gives equal or better BPB, bounded by compute budget. Think of it as paying compute at eval time to extract maximum performance from your trained weights.`,
    },
    {
      type: "text",
      title: "Advanced: N-gram Mixing",
      content: `PR #524 introduced a clever technique: **N-gram mixing**. Instead of relying solely on the neural model's predictions, it blends in predictions from a simple bigram model at evaluation time.

### How It Works

\`\`\`
final_probs = 0.93 * neural_probs + 0.07 * bigram_probs
\`\`\`

The bigram model is essentially a lookup table of character-pair frequencies. It costs zero artifact bytes (the frequencies can be computed from the evaluation data itself) and provides a regularizing effect on the neural model's predictions.

### Temperature Calibration

The same submission applies temperature scaling (T=0.93) to the neural model's logits before softmax. This sharpens the distribution slightly, reducing entropy on tokens the model is confident about.

\`\`\`python
calibrated_logits = logits / 0.93
neural_probs = softmax(calibrated_logits)
final_probs = 0.93 * neural_probs + 0.07 * bigram_probs
\`\`\`

### Why This Works

Neural models sometimes produce overconfident or underconfident predictions on individual tokens. The bigram component acts as a smoothing prior — it catches cases where the neural model assigns near-zero probability to a common bigram, preventing catastrophic log-loss spikes.

This is a **free improvement**: no extra parameters, no extra training, just a smarter scoring function.`,
    },
    {
      type: "text",
      title: "PPM: Prediction by Partial Matching",
      content: `PR #511 introduced **PPM (Prediction by Partial Matching)** — a classical compression algorithm used as an evaluation-time ensemble member alongside the neural model.

### The Idea

PPM builds a Markov model of character sequences at test time, using the evaluation data itself. It tracks how often each character follows a given context of length k. At prediction time, it blends predictions across multiple context lengths (k=16, 12, 8, 6) with confidence thresholds.

### Parameters Used

| Parameter | Value | Purpose |
| --- | --- | --- |
| K (max order) | 15 | Longest context to consider |
| k_values | [16, 12, 8, 6] | Context lengths to blend |
| min_confidence | [1.0, 1.0, 1.0, 0.95] | Per-level confidence thresholds |
| delay | 2048 | Tokens to observe before PPM kicks in |

### Key Detail: "Outside-Context-Only"

The PPM component only scores tokens that fall *outside* the neural model's context window. This avoids double-counting — the neural model handles tokens within its context, and PPM handles the long-range dependencies the neural model can't see.

### Trade-off

PPM adds compute at evaluation time and requires careful tuning of confidence thresholds. It works best with longer documents where the neural model's finite context window leaves many tokens poorly modeled. For the standard 1024-context setup, the gains are modest.`,
    },
    {
      type: "text",
      title: "Practical Recommendations",
      content: `### For Parameter Golf

1. **Always use sliding window with stride=64** — this is table stakes. Not using it leaves easy BPB on the table.

2. **Match eval context to training context** — if you train on 1024 tokens, evaluate on 1024. Mismatches hurt.

3. **Consider N-gram mixing** — it's free (zero artifact cost) and provides a small but consistent improvement. Start with 93/7 neural/bigram split and temperature=0.93.

4. **Don't over-optimize stride** — going from stride=64 to stride=32 doubles your eval compute for diminishing returns (~0.001-0.002 BPB).

5. **PPM is niche** — only worth exploring if you have very long documents and spare eval compute.

### The Meta-Insight

The top two scoring submissions (BPB 1.1175 and 1.1181) both use simple stride=64 sliding window evaluation. No N-gram mixing, no PPM, no exotic tricks. The lesson: **evaluation strategy has a floor and ceiling**. Get the floor right (stride=64), and spend your optimization budget on architecture, quantization, and training instead.`,
    },
  ],
};
