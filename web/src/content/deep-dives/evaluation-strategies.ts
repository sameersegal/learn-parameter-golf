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

The core challenge: language models are trained on fixed-length sequences (typically 1024 or 2048 tokens), but evaluation documents are much longer. How you slide your context window across the document determines which tokens get good context and which don't.

### The Naive Approach: No Overlap (stride = seq_len)

The simplest evaluation: chop the document into non-overlapping chunks of \`seq_len\` tokens, score every token in each chunk, and average the results. This doesn't mean tokens have "no context" — autoregressive models always condition on prior tokens *within* the window. But the amount of context varies dramatically across the window:

\`\`\`
Window: [token_0, token_1, token_2, ..., token_1023]
         ↑                                    ↑
         0 prior tokens                       1023 prior tokens
         (guessing blind)                     (best prediction)
\`\`\`

Token 0 in each chunk has zero context — it's essentially guessing. Token 512 has 512 tokens of context. Token 1023 has 1023 tokens — a great prediction. But since all 1024 tokens get scored and averaged together, the poorly-contextualized early tokens drag the average BPB up.

### The Insight: Only Score Well-Contextualized Tokens

Overlapping windows fix this by letting you **choose which predictions count**. With stride=64, you advance the window by 64 tokens each step and only score the last 64 tokens — the ones that had ~960 tokens of prior context:

\`\`\`
Window: [960 context tokens (not scored)] [64 tokens (scored)]
                                           ↑
                                           Every scored token has ~960 tokens of context
\`\`\`

The model is the same. The predictions for well-contextualized tokens are the same. You're just **throwing away the scores from tokens that lacked sufficient context** and only counting predictions where the model had nearly a full window of prior text. This is strictly better than non-overlapping evaluation.`,
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
      content: `Across Parameter Golf submissions, **stride=64 is the dominant choice** — used by 333 out of ~430 entries that specify a stride (~77%). The next most common are stride=256 (26 entries) and stride=32 (25 entries). Here's why stride=64 dominates:

### The Trade-off

| Stride | Overlap | Compute Cost | Quality |
| --- | --- | --- | --- |
| seq_len (1024) | 0% | 1x (baseline) | Worst — scores tokens with 0 to 1023 context |
| 256 | 75% | ~4x | Good |
| 64 | 94% | ~16x | Excellent — near-optimal context |
| 32 | 97% | ~32x | Marginal gain over 64 |
| 1 | 99.9% | ~1024x | Theoretically optimal, impractical |

**stride=64** hits the sweet spot: 94% overlap ensures nearly every scored token sees a full 1024-token context, while keeping compute at ~16x (manageable within competition time limits).

### The One Exception

PR #511 used **stride=32** with a 2048-token context window. The longer context justified the finer stride — with 2048 tokens of context, stride=32 gives 98.4% overlap. But this is rare; most submissions use the standard 1024 context.

### Key Insight

Stride doesn't change your model — it changes **which predictions you count**. With no overlap (stride=seq_len), you're forced to score tokens that had very little context — predictions the model was never going to get right. With stride=64, you only score tokens where the model had ~960 tokens of context, throwing away the bad-context scores.

A smaller stride always gives equal or better BPB, bounded by compute budget. Think of it as paying compute at eval time to extract maximum measured performance from your trained weights — the model makes the same predictions either way, you're just choosing to only measure the ones where it had enough information to do well.`,
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

2. **Match eval context to training context** — if you train on 1024 tokens, evaluate on 1024. Mismatches hurt. Many top submissions now use 2048-token context for both.

3. **Consider N-gram mixing** — it's free (zero artifact cost) and provides a small but consistent improvement. Start with 93/7 neural/bigram split and temperature=0.93.

4. **Don't over-optimize stride** — going from stride=64 to stride=32 doubles your eval compute for diminishing returns (~0.001-0.002 BPB).

5. **N-gram backoff is the current frontier** — the top submissions (sub-0.3 BPB) all use entropy-adaptive N-gram backoff caches, blending neural and N-gram predictions. This goes far beyond simple bigram mixing.

### Sensitivity Notes

- **Temperature**: Values between 0.9 and 0.95 work well. Below 0.85, the model becomes overconfident and miss-predicts rare tokens catastrophically. Above 1.0, entropy increases and BPB worsens.
- **N-gram mix ratio**: The 93/7 neural/bigram split is a starting point. Top submissions use entropy-adaptive mixing where the ratio varies per token based on the model's confidence.
- **Stride**: The gap between stride=64 and stride=32 is typically <0.002 BPB. The gap between stride=64 and stride=256 is ~0.01-0.02 BPB — more significant.

### Interactions with Other Techniques

- **Test-time training**: The score-first TTT protocol uses the same sliding window. Stride determines how many tokens are scored per step before the model adapts.
- **N-gram backoff caches**: The biggest recent evolution in evaluation. Order-9 to order-12 N-gram caches built incrementally from scored tokens blend with neural predictions using entropy-adaptive interpolation. This is behind the jump from ~1.1 BPB to sub-0.3 BPB in top submissions.
- **Compression**: N-gram caches are computed at eval time from the data itself — they add zero bytes to the artifact.

### The Meta-Insight

The competition has evolved dramatically. Early top submissions (PR #505 at 1.118 BPB, PR #535 at 1.120 BPB) used simple stride=64 sliding window without N-gram tricks. Current top submissions (PR #843 at 0.283 BPB, PR #809 at 0.295 BPB) combine stride=64 with N-gram backoff and TTT. The lesson: **stride=64 remains the foundation**, but the ceiling for evaluation strategy has risen enormously with N-gram techniques. Getting the floor right (stride=64) is necessary but no longer sufficient for competitive scores.`,
    },
  ],
};
