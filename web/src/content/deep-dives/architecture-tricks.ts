import { DeepDive } from "@/lib/types";

export const architectureTricks: DeepDive = {
  slug: "architecture-tricks",
  title: "Architecture Tricks",
  subtitle: "U-Net skips, BigramHash, SmearGate, and more",
  category: "architecture_modification",
  order: 2,
  sections: [
    {
      type: "text",
      title: "When the Transformer Is Not Enough",
      content: `Every serious Parameter Golf submission starts with the same backbone: a Transformer. 899 of the 1,162 parsed entries use a vanilla Transformer. But the top scorers do not stop there. They bolt on extra components -- skip connections that echo U-Net, hash-based bigram features, gating mechanisms -- that squeeze more performance from the same parameter budget.

The numbers are striking. **BigramHash** appears in 583 submissions. **SmearGate** shows up in 396. **U-Net skip connections** appear in 275. And the best neural submission (PR #1056, 0.018 BPB) uses all three.

These are not separate architectures. They are modifications layered onto a standard Transformer, each addressing a different weakness. Understanding what each one does -- and why they help -- reveals how far you can push a small model when every byte counts.`,
    },
    {
      type: "text",
      title: "BigramHash: Free Features from Character Pairs",
      content: `Here is a question worth asking: what is the cheapest way to give a language model extra information about the input?

The answer, used by over half of all Parameter Golf submissions, is **BigramHash**. The idea is simple. Take each pair of adjacent characters in the input. Hash that pair into a fixed-size embedding table. Add the result to the token embedding before it enters the Transformer.

### Why This Works

A Transformer processes tokens one at a time through self-attention. To understand the relationship between adjacent characters, it needs at least one attention layer. But bigram statistics -- which character tends to follow which -- are extremely predictable. The letter "q" is almost always followed by "u". The space before "the" is vastly more common than the space before "xyl".

BigramHash gives the model this local context for free, before the first attention layer even fires. The Transformer can then spend its limited capacity on harder, longer-range patterns instead of wasting attention heads on obvious bigram predictions.

### The Hash Trick

Why hash instead of using a full lookup table? A naive bigram table for byte-level tokens would need 256 x 256 = 65,536 entries. At 512 dimensions each, that is 128 MB of embeddings alone -- wildly over budget.

Hashing maps those 65,536 possible bigrams down to a much smaller table (typically 8,192 or 16,384 entries). Collisions happen, but they are rare enough to be harmless. The hash approach costs a tiny fraction of the parameters while capturing most of the bigram signal.

### Impact on Scores

The top 5 neural submissions all use BigramHash. Among submissions with val_bpb scores, those using BigramHash average significantly better than those without. It is essentially a free lunch -- a few thousand extra parameters for a meaningful BPB improvement.`,
    },
    {
      type: "text",
      title: "SmearGate: Mixing Adjacent Token Information",
      content: `**SmearGate** appears in 396 submissions, including the best neural entry (PR #1056, 0.018 BPB). Where BigramHash adds static bigram features, SmearGate provides a learned mechanism for blending information between adjacent positions.

### The Core Idea

At each position in the sequence, SmearGate computes a gate value between 0 and 1. This gate controls how much of the previous token's representation gets "smeared" into the current position:

\`output[t] = gate[t] * input[t-1] + (1 - gate[t]) * input[t]\`

When the gate is 0, the position keeps its own representation untouched. When the gate is 1, it completely adopts its neighbor's representation. In practice, the gate learns intermediate values that blend the two.

### Why Not Just Use Attention?

Attention can already mix information across positions. But attention is expensive -- it scales quadratically with sequence length -- and it operates at a coarse level. SmearGate is a cheap, local operation that handles the most common case: information flow between adjacent tokens.

Think of it like this. Attention is a conference call where everyone can talk to everyone. SmearGate is whispering to the person next to you. Both are useful, but whispering is faster and cheaper.

### Where It Lives in the Architecture

SmearGate is typically applied right after the token embedding, before the first Transformer block. This means the Transformer layers receive inputs that already contain some local context. Combined with BigramHash, the Transformer starts with surprisingly rich representations before a single attention operation.`,
    },
    {
      type: "animation",
      title: "Interactive: SmearGate in Action",
      animationId: "smeargate-demo",
      content:
        "Adjust the gate value to see how SmearGate blends adjacent token representations. Notice how different gate values affect information flow between positions.",
    },
    {
      type: "text",
      title: "U-Net Skip Connections: Borrowing from Image Segmentation",
      content: `The U-Net architecture was invented for biomedical image segmentation in 2015. It has an encoder that progressively compresses the input and a decoder that expands it back, with **skip connections** that pipe information directly from encoder layers to matching decoder layers.

275 Parameter Golf submissions borrow this idea. Instead of a straight stack of Transformer layers (layer 1 feeds layer 2 feeds layer 3 and so on), they create skip connections that link early layers directly to late layers.

### How It Works in a Transformer

Imagine an 11-layer Transformer. In a standard architecture, layer 1's output feeds only into layer 2. With U-Net skips, the architecture might look like this:

| Layer | Receives Input From |
|-------|-------------------|
| Layer 1 | Token embeddings |
| Layer 2 | Layer 1 |
| Layer 3 | Layer 2 |
| Layer 4 | Layer 3 |
| Layer 5 | Layer 4 |
| Layer 6 | Layer 5 |
| Layer 7 | Layer 6 + Layer 5 (skip) |
| Layer 8 | Layer 7 + Layer 4 (skip) |
| Layer 9 | Layer 8 + Layer 3 (skip) |
| Layer 10 | Layer 9 + Layer 2 (skip) |
| Layer 11 | Layer 10 + Layer 1 (skip) |

The skip connections are typically concatenated or added to the regular input, sometimes with a learned scaling factor.

### Why This Helps Small Models

Large Transformers can afford to be wasteful. If a useful feature from layer 2 gets diluted by layers 3 through 10, the model has enough parameters to re-derive it. Small models cannot. Skip connections give late layers direct access to early features without re-computation.

This is especially valuable for language modeling because different linguistic features live at different depths. Character-level patterns (spelling, common subwords) emerge in early layers. Syntactic patterns (grammar, phrase structure) emerge in middle layers. Semantic patterns (meaning, topic) emerge in late layers. Skip connections let the final prediction layer draw on all three levels simultaneously.

### The Best U-Net Submission

PR #826 (0.295 BPB) describes itself as an "11-layer Transformer-like model with 512d, GQA 8/4, MLP 3.0x, BigramHash, SmearGate, XSA, Partial RoPE, LN Scale, U-Net skips, VE128." This kitchen-sink approach -- combining U-Net skips with every other trick on this page -- illustrates how these modifications are meant to be layered, not used in isolation.`,
    },
    {
      type: "text",
      title: "Depth Recurrence: More Layers Without More Parameters",
      content: `116 submissions use **depth recurrence** -- running the same set of Transformer layers multiple times in sequence. Instead of 11 unique layers, you might have 5 unique layers that execute twice each, giving you 10 effective layers with only 5 layers' worth of parameters.

### The Trade-off

This is a direct trade of compute for parameters. Each recurrent pass through the shared layers costs the same FLOPs as a unique layer would. But the weights are shared, so you stay under the 16 MB artifact limit more easily.

The risk is that shared layers might not specialize. In a standard Transformer, layer 3 can learn completely different features from layer 7. When they share weights, both passes must use the same feature detectors. The model loses some representational diversity.

### When It Works

Depth recurrence works best when:

- You are severely parameter-constrained (which you always are in Parameter Golf)
- The task benefits more from depth than from width
- You combine recurrence with conditioning signals that differentiate the passes

Some submissions use **FiLM conditioning** -- feeding a pass index into each layer so the shared weights can behave differently on the first pass versus the second. This partially restores the specialization that weight sharing removes.

### Compared to Simply Making the Model Wider

An alternative to depth recurrence is reducing layers and increasing hidden dimension. Both approaches use the same number of parameters. The empirical evidence from Parameter Golf leans toward depth recurrence being slightly better for language modeling, though the gap is small and depends on other architectural choices.`,
    },
    {
      type: "text",
      title: "Other Architecture Modifications",
      content: `Beyond the big four, several other modifications appear frequently across submissions.

### Grouped Query Attention (GQA)

**GQA** appears in 209 submissions. Standard multi-head attention gives each head its own key, query, and value projections. GQA groups heads together, sharing key-value projections across multiple query heads. A common configuration is 8 query heads with 4 key-value heads (GQA 8/4).

The benefit is parameter savings. Key-value projections account for a significant fraction of attention parameters. Sharing them across head groups reduces this cost while retaining most of the expressiveness.

### Partial RoPE (Rotary Position Embeddings)

270 submissions use **Partial RoPE**, where rotary position embeddings are applied to only a fraction of the head dimensions rather than all of them. Typically, RoPE is applied to the first half of each head's dimensions while the second half uses no positional encoding.

The intuition is that some attention heads benefit from position awareness (to handle local patterns) while others work better as position-independent feature detectors. Partial RoPE lets both modes coexist within the same head.

### XSA (Extended Self-Attention)

392 submissions use **XSA**, a variant of self-attention that extends the attention mechanism with additional learned projections or gating. The specific implementation varies across submissions, but the common thread is enhancing the standard attention computation at minimal parameter cost.

### LN Scale (LayerNorm Scaling)

226 submissions use **LN Scale**, a technique that adds a learned per-layer scaling factor to LayerNorm outputs. This gives the model fine-grained control over information flow between layers. Layers that should have a stronger influence on the residual stream can amplify their output, while layers that should have a weaker influence can dampen it.

This costs exactly one scalar parameter per layer -- essentially free -- but gives the optimizer an extra lever to balance the contribution of each layer during training.`,
    },
    {
      type: "code",
      title: "Implementing BigramHash and SmearGate",
      language: "python",
      content: `import torch
import torch.nn as nn

class BigramHash(nn.Module):
    """Hash-based bigram features added to token embeddings."""

    def __init__(self, table_size: int = 8192, embed_dim: int = 512):
        super().__init__()
        self.table = nn.Embedding(table_size, embed_dim)
        self.table_size = table_size

    def forward(self, token_ids: torch.Tensor) -> torch.Tensor:
        # Compute bigram hashes: hash(token[t-1], token[t])
        # Shift tokens to create pairs
        prev_tokens = torch.cat([
            torch.zeros_like(token_ids[:, :1]),  # pad start
            token_ids[:, :-1]
        ], dim=1)

        # Simple hash: (prev * 257 + current) mod table_size
        bigram_hashes = (prev_tokens * 257 + token_ids) % self.table_size

        return self.table(bigram_hashes)


class SmearGate(nn.Module):
    """Learned gate that blends adjacent token representations."""

    def __init__(self, embed_dim: int = 512):
        super().__init__()
        self.gate_proj = nn.Linear(embed_dim, embed_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch, seq_len, embed_dim)
        gate = torch.sigmoid(self.gate_proj(x))

        # Shift x to get previous position
        prev_x = torch.cat([
            torch.zeros_like(x[:, :1]),  # pad start with zeros
            x[:, :-1]
        ], dim=1)

        # Blend current position with previous
        return gate * prev_x + (1 - gate) * x


# Usage in a model's forward pass:
# embeddings = token_embed(input_ids) + bigram_hash(input_ids)
# embeddings = smear_gate(embeddings)
# output = transformer_layers(embeddings)`,
    },
    {
      type: "text",
      title: "Stacking Tricks: The Winning Recipe",
      content: `The most important lesson from Parameter Golf architecture modifications is that they are **additive**. The best submissions do not pick one trick -- they use all of them.

PR #1056 (0.018 BPB, best neural) uses: BigramHash, SmearGate, U-Net skip connections, GQA, Partial RoPE, XSA, and LN Scale. PR #826 (0.295 BPB) uses the same stack. PR #944 (0.017 BPB) uses BigramHash plus the standard suite.

### Why They Compose Well

Each modification targets a different bottleneck:

| Modification | What It Addresses | Parameter Cost |
|-------------|-------------------|----------------|
| BigramHash | Local character context | ~4K embeddings |
| SmearGate | Adjacent token blending | One linear layer |
| U-Net skips | Feature reuse across depth | Zero (just wiring) |
| Depth recurrence | More depth per parameter | Zero (shared weights) |
| GQA | Attention parameter efficiency | Negative (saves params) |
| Partial RoPE | Positional flexibility | Zero (applies RoPE to subset) |
| LN Scale | Layer contribution control | One scalar per layer |

None of these modifications conflict with each other. BigramHash and SmearGate both enhance the input before attention. U-Net skips and depth recurrence both change how layers connect. GQA and Partial RoPE both modify the attention mechanism itself. They operate on different parts of the architecture, which is why stacking them produces compounding gains.

### The Practical Takeaway

If you are building a Parameter Golf submission, start with the standard Transformer baseline and add modifications one at a time. BigramHash is the single highest-impact addition based on submission counts and average BPB. SmearGate is the second. U-Net skips have a higher implementation cost but provide meaningful gains for models with 8 or more layers.

The architecture tricks in this article are not exotic research ideas. They are battle-tested by hundreds of submissions and used by every top competitor. The question is not whether to use them, but how to combine them for your specific parameter budget.`,
    },
  ],
};
