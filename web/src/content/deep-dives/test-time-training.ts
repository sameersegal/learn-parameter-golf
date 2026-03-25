import { DeepDive } from "@/lib/types";

export const testTimeTraining: DeepDive = {
  slug: "test-time-training",
  title: "Test-Time Training",
  subtitle: "Adapting models at inference time with LoRA, score-first TTT, and per-document fine-tuning",
  category: "test_time_training",
  order: 6,
  sections: [
    {
      type: "text",
      title: "What is Test-Time Training?",
      content: `Test-Time Training (TTT) is a technique where you **continue training the model during evaluation**, adapting it to each test document before (or while) scoring it. In Parameter Golf, this means your 16MB artifact isn't the final model — it's a *starting point* that gets specialized per-document at inference time.

### Why TTT Works

Language models are trained on a broad distribution of text. Any specific document has its own local patterns — vocabulary, style, topic-specific terminology. TTT lets the model quickly adapt to these patterns, reducing prediction error on that document.

### The Legal Protocol: Score-First TTT

Parameter Golf has a critical rule: **you must score tokens before training on them**. This prevents "cheating" by training on the test data and then scoring it. The legal protocol is:

1. **Score** a chunk of tokens using the current model weights
2. **Record** the losses (these count toward your BPB)
3. **Train** on those same tokens to update the model
4. **Move** to the next chunk and repeat

This is sometimes called "online learning" — you learn from the data stream as you go, but you always predict before you see the answer.`,
    },
    {
      type: "animation",
      title: "Interactive: Test-Time Training",
      animationId: "ttt-demo",
      content:
        "Watch the score-first TTT loop in action. Each chunk is scored first (blue), then trained on (yellow). Toggle between Full TTT and LoRA TTT to compare. Adjust the epoch count to see how more training per chunk reduces loss further.",
    },
    {
      type: "code",
      title: "Score-First TTT Implementation",
      language: "python",
      content: `import torch
import torch.nn.functional as F

def score_first_ttt(model, tokens, chunk_size=32768, epochs=30,
                    lr=0.002, momentum=0.9, frozen_blocks=2):
    """Score-first test-time training loop.

    Legal protocol: score each chunk BEFORE training on it.
    Uses SGD with momentum (shown to outperform AdamW for TTT).

    Args:
        model: Pre-trained language model
        tokens: Full document token IDs
        chunk_size: Tokens per adaptation chunk
        epochs: Training epochs per chunk
        lr: Base learning rate
        momentum: SGD momentum
        frozen_blocks: Number of early transformer blocks to freeze
    """
    device = next(model.parameters()).device

    # Freeze early layers to prevent catastrophic forgetting
    for i, block in enumerate(model.blocks):
        if i < frozen_blocks:
            for p in block.parameters():
                p.requires_grad = False

    # Per-layer LR multipliers (MLP outputs adapt faster)
    param_groups = []
    for name, param in model.named_parameters():
        if not param.requires_grad:
            continue
        if "mlp.proj" in name or "mlp.output" in name:
            param_groups.append({"params": [param], "lr": lr * 3.0})
        elif "mlp.fc" in name or "input_proj" in name:
            param_groups.append({"params": [param], "lr": lr * 0.5})
        else:
            param_groups.append({"params": [param], "lr": lr})

    optimizer = torch.optim.SGD(param_groups, momentum=momentum)
    total_loss = 0.0
    total_tokens = 0

    for start in range(0, len(tokens) - 1, chunk_size):
        end = min(start + chunk_size, len(tokens))
        chunk = tokens[start:end].unsqueeze(0).to(device)

        # STEP 1: Score (no gradients — this is the official eval)
        model.eval()
        with torch.no_grad():
            logits = model(chunk)
            loss = F.cross_entropy(
                logits[0, :-1], chunk[0, 1:], reduction="sum"
            )
            total_loss += loss.item()
            total_tokens += chunk.numel() - 1

        # STEP 2: Train on the chunk we just scored
        model.train()
        for epoch in range(epochs):
            # Cosine decay within the chunk's training epochs
            progress = epoch / max(epochs - 1, 1)
            cos_lr = 0.5 * (1 + torch.cos(torch.tensor(progress * 3.14159)))
            for pg in optimizer.param_groups:
                pg["lr"] = pg["lr"] * cos_lr.item()

            logits = model(chunk)
            train_loss = F.cross_entropy(logits[0, :-1], chunk[0, 1:])
            train_loss.backward()
            optimizer.step()
            optimizer.zero_grad()

    return total_loss / total_tokens  # nats per token`,
    },
    {
      type: "text",
      title: "LoRA TTT: Lightweight Adaptation",
      content: `Instead of fine-tuning the full model, **LoRA TTT** adds small low-rank adapter matrices and only trains those. This is faster, uses less memory, and is less prone to catastrophic forgetting.

### How LoRA Works

For a weight matrix W of shape (d_out, d_in), LoRA adds:

\`\`\`
W' = W + A @ B
\`\`\`

where A is (d_out, r) and B is (r, d_in), with rank r << min(d_out, d_in). Only A and B are trained; W stays frozen.

### Common Parameter Choices in Parameter Golf

| Parameter | Typical Value | Notes |
| --- | --- | --- |
| Rank (r) | 4-8 | r=8 most common, r=4 for minimal overhead |
| Adapted layers | Q, V projections | Sometimes also LM head |
| Chunk size | 256 tokens | Per-document chunks |
| Epochs per chunk | 3-5 | Short adaptation windows |
| Learning rate | 0.01 | Higher than full TTT |
| Reset strategy | Per-document | Fresh LoRA weights for each document |
| Parameter overhead | ~50K-100K | Tiny vs. model's millions |

### Per-Document Reset

A critical design choice: **reset the LoRA weights for each new document**. Without reset, adaptations from one document bleed into the next, hurting performance. Each document gets a fresh set of LoRA parameters initialized to zero (so W' = W initially).

### LoRA vs. Full TTT

| Aspect | Full TTT | LoRA TTT |
| --- | --- | --- |
| Parameters trained | ~20M (81% of model) | ~50-100K (<0.5%) |
| Epochs needed | 30 | 3-5 |
| Forgetting risk | High (needs frozen blocks) | Low (base model frozen) |
| Best BPB achieved | 1.1175 | 1.116 |
| Compute cost | High | Low |

The performance is remarkably similar. LoRA TTT achieves within 0.002 BPB of full TTT at a fraction of the compute cost.`,
    },
    {
      type: "code",
      title: "LoRA TTT Implementation",
      language: "python",
      content: `import torch
import torch.nn as nn
import torch.nn.functional as F

class LoRAAdapter(nn.Module):
    """Low-rank adapter for test-time training."""

    def __init__(self, in_features, out_features, rank=8):
        super().__init__()
        self.A = nn.Parameter(torch.zeros(out_features, rank))
        self.B = nn.Parameter(torch.zeros(rank, in_features))
        # Initialize A with small random values, B with zeros
        # so the adapter starts as identity (no change)
        nn.init.kaiming_uniform_(self.A, a=5**0.5)
        nn.init.zeros_(self.B)

    def forward(self, x):
        return x + (x @ self.B.T) @ self.A.T

    def reset(self):
        """Reset adapter to zero (identity) for new document."""
        nn.init.kaiming_uniform_(self.A, a=5**0.5)
        nn.init.zeros_(self.B)


def lora_ttt(model, tokens, rank=8, lr=0.01, chunk_size=256,
             epochs_per_chunk=3, min_doc_len=512):
    """LoRA-based test-time training with per-document reset.

    Adds LoRA adapters to Q and V projections, trains them on
    each document, then resets for the next document.
    """
    device = next(model.parameters()).device

    # Attach LoRA adapters to Q and V projections
    adapters = []
    for block in model.blocks:
        for name in ["q_proj", "v_proj"]:
            proj = getattr(block.attn, name)
            adapter = LoRAAdapter(
                proj.in_features, proj.out_features, rank
            ).to(device)
            adapters.append(adapter)
            # Hook the adapter into the forward pass
            original_forward = proj.forward
            proj.forward = lambda x, a=adapter, f=original_forward: a(f(x))

    adapter_params = [p for a in adapters for p in a.parameters()]
    optimizer = torch.optim.Adam(adapter_params, lr=lr)

    total_loss = 0.0
    total_tokens = 0

    # Process document by document
    for doc_tokens in split_into_documents(tokens):
        if len(doc_tokens) < min_doc_len:
            continue

        # Reset all adapters for this document
        for adapter in adapters:
            adapter.reset()
        optimizer = torch.optim.Adam(adapter_params, lr=lr)

        # Score-first protocol within the document
        for start in range(0, len(doc_tokens) - 1, chunk_size):
            end = min(start + chunk_size, len(doc_tokens))
            chunk = doc_tokens[start:end].unsqueeze(0).to(device)

            # Score first
            model.eval()
            with torch.no_grad():
                logits = model(chunk)
                loss = F.cross_entropy(
                    logits[0, :-1], chunk[0, 1:], reduction="sum"
                )
                total_loss += loss.item()
                total_tokens += chunk.numel() - 1

            # Then train the adapters
            model.train()
            for _ in range(epochs_per_chunk):
                logits = model(chunk)
                train_loss = F.cross_entropy(
                    logits[0, :-1], chunk[0, 1:]
                )
                train_loss.backward()
                optimizer.step()
                optimizer.zero_grad()

    return total_loss / total_tokens`,
    },
    {
      type: "text",
      title: "Key Design Decisions",
      content: `### SGD vs. AdamW for TTT

A surprising finding from Parameter Golf: **SGD with momentum outperforms AdamW** for test-time training. Several top submissions (PRs #526, #537) document this explicitly.

Why? AdamW's adaptive learning rates need time to calibrate running statistics. With only 30 steps of training per chunk, AdamW's moment estimates are noisy. SGD with momentum (0.9) converges more reliably in this few-shot regime.

### Per-Layer Learning Rate Multipliers

Not all layers should adapt at the same rate. The consensus from top submissions:

- **MLP output projections**: 3x base LR (these high-level features benefit most from adaptation)
- **Input projections**: 0.5x base LR (low-level features should change slowly)
- **Everything else**: 1x base LR

### Freezing Early Blocks

The first 2 transformer blocks are typically frozen during TTT. These layers learn basic token representations that are document-agnostic. Fine-tuning them risks catastrophic forgetting — the model loses its general language ability for a tiny per-document gain.

### Epoch Count: The Scaling Curve

| Epochs | Relative BPB Improvement | Compute Cost |
| --- | --- | --- |
| 3 | Baseline | 1x |
| 10 | +3-4% better | 3.3x |
| 30 | +10-11% better | 10x |
| 50+ | Diminishing returns | 16x+ |

PR #509 documented going from 10 to 30 epochs and seeing a 10.8% BPB improvement (1.2531 to 1.1175). This is the strongest evidence for TTT epoch scaling in the competition.

### Intra-Chunk Cosine Decay

Several top submissions use **cosine learning rate decay within each chunk's training loop**. The LR starts at the base value and decays to ~0 over the chunk's epochs. This prevents overfitting to early tokens in the chunk.`,
    },
    {
      type: "text",
      title: "When NOT to Use TTT",
      content: `A counterintuitive finding: **the two highest-scoring confirmed submissions don't use TTT at all**.

- PR #505: **1.1181 BPB** — SwiGLU activation, int6 QAT, no TTT
- PR #535: **1.1204 BPB** — LeakyReLU², full GPTQ quantization, no TTT

### Why No-TTT Can Win

1. **Artifact budget**: TTT doesn't add parameters, but a model designed for TTT may allocate capacity differently (e.g., fewer layers but more adaptable) vs. one that just needs to be good at inference

2. **Training efficiency**: Time spent implementing TTT infrastructure is time not spent on architecture search, better quantization, or training longer

3. **Evaluation overhead**: TTT multiplies eval compute by 10-30x. In a competition with time constraints, this matters

4. **Robustness**: TTT can hurt on short documents or documents that differ significantly from training distribution

### The Bottom Line

TTT is a powerful tool that provides ~10% BPB improvement when done right (30 epochs, SGD, frozen early blocks, cosine decay). But it's not a prerequisite for winning. The best approach depends on your artifact's architecture — if your quantization and architecture are already pushing the frontier, TTT may not justify its complexity.

**Recommended approach**: Get your base model as good as possible first. Add TTT last, and measure whether it actually helps your specific setup.`,
    },
  ],
};
