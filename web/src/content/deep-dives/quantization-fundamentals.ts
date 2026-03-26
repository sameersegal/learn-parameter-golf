import { DeepDive } from "@/lib/types";

export const quantizationFundamentals: DeepDive = {
  slug: "quantization-fundamentals",
  title: "Quantization Fundamentals",
  subtitle: "Reducing model size while preserving performance",
  category: "quantization",
  order: 1,
  sections: [
    {
      type: "text",
      title: "What is Quantization?",
      content: `Quantization is the process of mapping continuous or high-precision values to a smaller set of discrete values. In the context of neural networks, this means converting model weights from higher-precision formats (like float32 or float16) to lower-precision integer formats (like int8, int5, or even int4).

**Why does this matter for Parameter Golf?** The competition has a strict 16MB artifact size limit. A model with 10M parameters in float32 would take ~40MB — way over budget. Quantization lets you pack more model capacity into fewer bytes.

### The Precision-Size Trade-off

| Format | Bits | Bytes per param | 10M params |
|--------|------|----------------|------------|
| float32 | 32 | 4 | 40 MB |
| float16 | 16 | 2 | 20 MB |
| int8 | 8 | 1 | 10 MB |
| int5 | 5 | 0.625 | 6.25 MB |
| int4 | 4 | 0.5 | 5 MB |

Every bit you save per parameter lets you either fit more parameters or have headroom for compression metadata.`,
    },
    {
      type: "animation",
      title: "Interactive: Quantization in Action",
      animationId: "quantization-demo",
      content:
        "Drag the bit-width slider to see how quantization affects value representation. Notice how fewer bits means coarser granularity but smaller storage.",
    },
    {
      type: "code",
      title: "Implementing int8 Per-Row Quantization",
      language: "python",
      content: `import torch

def quantize_int8_per_row(weight: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
    """Quantize a weight matrix to int8 with per-row scaling.

    Per-row quantization computes a separate scale factor for each row,
    which preserves more precision than a single global scale.
    """
    # Find the max absolute value per row
    row_max = weight.abs().amax(dim=-1, keepdim=True)

    # Scale to [-127, 127] range
    scale = row_max / 127.0
    scale = scale.clamp(min=1e-8)  # avoid division by zero

    # Quantize
    quantized = (weight / scale).round().clamp(-128, 127).to(torch.int8)

    return quantized, scale.squeeze(-1)


def dequantize_int8_per_row(
    quantized: torch.Tensor, scale: torch.Tensor
) -> torch.Tensor:
    """Reconstruct float weights from quantized representation."""
    return quantized.float() * scale.unsqueeze(-1)


# Example usage
W = torch.randn(512, 512)  # Original weights
W_q, scales = quantize_int8_per_row(W)

# Storage: 512*512 bytes (int8) + 512*4 bytes (scales) = 264 KB
# vs original: 512*512*4 bytes (float32) = 1 MB — a 3.8x reduction

W_reconstructed = dequantize_int8_per_row(W_q, scales)
error = (W - W_reconstructed).abs().mean()
print(f"Mean absolute error: {error:.6f}")  # Typically ~0.003`,
    },
    {
      type: "text",
      title: "Quantization at Inference Time",
      content: `Here's a question that trips up almost everyone the first time: if we quantize weights to int4 or int8 for storage, do we just dequantize everything back to float16 before running inference? And if so, isn't quantization just a zip file for models — a file-size trick with no runtime benefit?

This is a great question. And the answer reveals why quantization is far more powerful than compression.

### The Naive Mental Model (and Why It's Wrong)

You might picture inference with a quantized model like this: load the int4 file from disk, expand all the weights back to float16 in GPU memory, then run the model normally. If that were true, quantization would only help with download size and disk space. Once the model is in VRAM, you'd be back to square one — same memory footprint, same speed.

**That is not how it works.** In practice, dequantization happens on-the-fly, one small tile at a time. The full-precision weights never exist all at once.

### How It Actually Works

Think of it like streaming a video. You don't download the entire movie to RAM before pressing play. You decode one frame at a time, watch it, then discard it. Quantized inference works the same way:

1. **Weights stay compressed in VRAM.** The GPU holds int4 or int8 tensors — that's the canonical representation.
2. **At compute time**, the GPU dequantizes a small block of weights (say, a 128-element tile) to float16 right before the matrix multiply.
3. The dequantized tile feeds into the GEMM (general matrix multiply), produces its output, and gets discarded.
4. The next tile streams in. Rinse, repeat.

The key insight: you never inflate the full weight matrix back to float16 in memory. A 70B-parameter model in int4 sits in ~35 GB of VRAM, not ~140 GB. The dequantization overhead is tiny — a few extra instructions per tile — because modern GPUs are absurdly fast at arithmetic compared to memory access.

### The Four Benefits (Ranked by Impact)

Quantization isn't just one trick. It delivers four distinct benefits, and the most important one surprises most people:

| Benefit | What Happens | Scale of Impact |
|---------|-------------|-----------------|
| **1. Memory bandwidth** | Less data moves from VRAM to compute cores per layer | **Biggest win for production LLM inference** |
| **2. Memory / VRAM** | Weights stored as int4/int8 — fit larger models on smaller GPUs | 2-4x more model per GPU |
| **3. Inference latency** | Fewer bytes to move = faster token generation | Near-linear speedup at low batch sizes |
| **4. Disk / file size** | Smaller downloads and storage | Critical for Parameter Golf's 16 MB limit |

Let's unpack the top one, because it's the least obvious.

### Memory Bandwidth: The Hidden Bottleneck

When an LLM generates text one token at a time (batch size 1), the GPU does surprisingly little math per byte of weight data it reads. For each token, the model must read *every* weight in *every* layer exactly once. The matrix multiplies themselves are tiny — just a matrix-vector product. The GPU finishes the arithmetic almost instantly, then sits idle, waiting for the next chunk of weights to arrive from VRAM.

This makes LLM decoding **memory-bandwidth-bound**, not compute-bound. The speed limit isn't how fast the GPU can multiply — it's how fast it can read weights from memory.

Now the punchline lands: if your weights are int4 instead of float16, you're moving **4x less data** through the memory bus per layer. The GPU's compute units were already underutilized, so spending a few cycles on dequantization costs almost nothing. The net result? Roughly **4x faster token generation**. Not from doing less math — from feeding the GPU faster.

> **Key Insight:** For autoregressive LLM inference, quantization is primarily a *bandwidth optimization*, not a compute optimization. You're not making the math cheaper — you're making the data smaller so it arrives sooner.

This is why quantization gives such dramatic real-world speedups even though it adds a dequantization step. The dequantize cost is noise compared to the bandwidth savings.

### When You Don't Even Need to Dequantize

On newer hardware, some precisions skip the dequantize step entirely and compute directly in low precision:

- **NVIDIA Hopper GPUs (H100)**: Native FP8 tensor cores run matrix multiplies directly in 8-bit floating point. No conversion needed.
- **INT8 tensor cores** (Ampere and later): Direct INT8 x INT8 multiplication with INT32 accumulation. The weights and activations stay in int8 throughout.
- **\`LLM.int8()\`** ([Dettmers et al., 2022](https://arxiv.org/abs/2208.07339)): A clever mixed-precision scheme that identifies outlier features (the ~0.1% of hidden dimensions with unusually large values) and keeps those in float16. Everything else computes in int8. This gets near-float16 accuracy with most of the int8 speed benefit.

These approaches eliminate the dequantize-multiply-discard cycle entirely. The quantized format isn't just how the model is stored — it's how the model *thinks*.

### What This Means for Parameter Golf

In the competition, the 16 MB artifact limit makes file size the primary concern. But here's what's important to internalize: the quantized representation *is* the model. It's not a compressed shuttle format that gets unpacked before use.

When PR #809 (0.295 BPB) exports its model with GPTQ int5, those int5 weights are the final artifact. The evaluation pipeline loads and runs them directly. When PR #620 (0.9443 BPB) uses int8 per-row quantization, the int8 values aren't an intermediate format — they're the weights the model uses to make predictions.

This distinction matters because it means submissions aren't fighting quantization error as an afterthought. Techniques like **STE QAT** (Straight-Through Estimator Quantization-Aware Training, used by 83 submissions) train the model *knowing* it will live in low precision. The training process learns weights that are robust to quantization from the start. And **GPTQ** carefully redistributes quantization error across columns using second-order information, minimizing the damage at export time.

The model was always meant to be quantized. The quantized weights aren't a lossy copy — they're the real thing.`,
    },
    {
      type: "text",
      title: "Quantization Techniques Used in Parameter Golf",
      content: `### int6 (Most Popular)

int6 is the most widely used format across Parameter Golf submissions (119 entries), followed closely by int8 (110 entries). int6 offers a strong balance: at 0.75 bytes per parameter, a 10M-param model fits in ~7.5 MB, leaving room for metadata and compression overhead within the 16MB budget.

**Key insight**: int6 has only 64 quantization levels compared to int8's 256. This sounds like a big drop, but in practice the quality difference is modest — most weight values cluster near zero, so the lower precision matters less than you'd expect.

### int8 Per-Row

Used by many strong submissions including PR #620 (0.9443 BPB). Each row of the weight matrix gets its own scale factor, preserving relative magnitudes within each output neuron's weight vector better than global quantization.

**Sensitivity note**: Moving from int8 to int6 typically costs ~0.01-0.02 BPB but saves 25% storage. Moving from int8 to int4 saves 50% but can cost 0.05+ BPB without careful calibration.

### Mixed Precision (int5/int6)

57 submissions use different bit-widths for different layer types:
- **int5** for MLP weights (less sensitive to precision)
- **int6** for attention weights (more sensitive)
- **float16** for tied embeddings and critical projections

This asymmetric approach recognizes that not all parameters contribute equally to model quality. The key tuning decision is *which* layers to assign lower precision — attention projections and embedding layers are typically more sensitive than MLP internals.

### GPTQ (Post-Training Quantization)

GPTQ is a one-shot weight quantization method that uses approximate second-order information (Hessian) to minimize quantization error. It processes weights column-by-column, updating remaining columns to compensate for quantization error in already-processed columns. Used by many top submissions including the current best (PR #809, 0.295 BPB) at int5.

**Sensitivity note**: GPTQ calibration quality depends heavily on the calibration dataset. Using validation-distribution text for calibration consistently outperforms random text.

### Percentile Clipping

PR #620 uses 99.99984th percentile clipping before quantization. This clips extreme outlier values that would otherwise waste dynamic range:

\`\`\`python
threshold = torch.quantile(weight.abs(), 0.9999984)
weight_clipped = weight.clamp(-threshold, threshold)
\`\`\`

This tiny sacrifice in outlier accuracy significantly improves quantization precision for the remaining 99.99% of values.

### Interactions with Other Techniques

Quantization doesn't exist in isolation:
- **Compression** (zstd, lzma): Applied on top of quantized weights to further reduce artifact size. Lower-bit quantization often compresses better because the value distribution is more concentrated.
- **Test-time training**: Quantized models can still be adapted at inference time via TTT or LoRA. The frozen base weights stay quantized while adaptation happens in full precision.
- **QAT (Quantization-Aware Training)**: Training with simulated quantization noise (STE QAT, used by 83 submissions) produces weights that are inherently more robust to quantization than post-training methods.`,
    },
  ],
};
