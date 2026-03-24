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
      content: `### int8 Per-Row (Most Popular)

Used by the current record holder (PR #620). Each row of the weight matrix gets its own scale factor, striking a good balance between compression and precision.

**Key insight**: Per-row quantization preserves the relative magnitudes within each output neuron's weight vector better than global quantization.

### Mixed Precision (int5/int6)

Some submissions use different bit-widths for different layer types:
- **int5** for MLP weights (less sensitive to precision)
- **int6** for attention weights (more sensitive)
- **float16** for tied embeddings and critical projections

This asymmetric approach recognizes that not all parameters contribute equally to model quality.

### GPTQ (Post-Training Quantization)

GPTQ is a one-shot weight quantization method that uses approximate second-order information (Hessian) to minimize quantization error. It processes weights column-by-column, updating remaining columns to compensate for quantization error in already-processed columns.

### Percentile Clipping

The record submission uses 99.99984th percentile clipping before quantization. This clips extreme outlier values that would otherwise waste dynamic range:

\`\`\`python
threshold = torch.quantile(weight.abs(), 0.9999984)
weight_clipped = weight.clamp(-threshold, threshold)
\`\`\`

This tiny sacrifice in outlier accuracy significantly improves quantization precision for the remaining 99.99% of values.`,
    },
  ],
};
