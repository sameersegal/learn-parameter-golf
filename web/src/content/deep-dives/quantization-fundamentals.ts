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
