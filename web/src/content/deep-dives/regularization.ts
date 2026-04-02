import { DeepDive } from "@/lib/types";

export const regularization: DeepDive = {
  slug: "regularization",
  title: "Regularization",
  subtitle: "Weight decay, pruning, and overfitting prevention",
  category: "regularization",
  order: 9,
  sections: [
    {
      type: "text",
      title: "Overfitting a 16 MB Model: Is It Even Possible?",
      content: `In traditional deep learning, regularization fights overfitting -- the model memorizing training data instead of learning general patterns. With billion-parameter models and limited data, overfitting is a constant threat.

Parameter Golf flips this on its head. Models are tiny (roughly 10-20M parameters after quantization). The training data is substantial. You might think overfitting is impossible here. You would be wrong.

**266 submissions use weight decay.** 52 use magnitude pruning. 46 use gradient clipping. 46 use logit softcapping. These are not wasted effort. Even small models overfit under the right conditions -- and the right conditions in Parameter Golf include short training runs, aggressive learning rates, and the pressure to squeeze every fraction of a BPB point from a limited architecture.

But regularization in Parameter Golf serves a second, less obvious purpose: **making the model more compressible.** Weight decay pushes weights toward zero. Pruning sets small weights to exactly zero. Both make the weight distribution narrower and more concentrated, which means better quantization and better compression. In a competition where every byte counts, regularization is as much about file size as it is about generalization.`,
    },
    {
      type: "text",
      title: "Weight Decay: The Universal Regularizer",
      content: `**Weight decay** adds a penalty proportional to the magnitude of the weights. At each optimization step, every weight gets multiplied by a factor slightly less than 1 (typically 0.98-0.999). This gently pulls all weights toward zero.

### How It Works

Without weight decay, the optimizer only cares about reducing the training loss. If making a weight very large reduces the loss by a tiny amount, the optimizer will happily inflate it. Over thousands of steps, some weights drift to unnecessarily large values.

Weight decay adds a cost to being large. The update rule becomes:

\`new_weight = (1 - decay_rate) * old_weight - learning_rate * gradient\`

The \`(1 - decay_rate)\` factor shrinks every weight at every step. Only weights where the gradient signal is strong enough to overcome this shrinkage survive at large magnitudes. This has a pruning-like effect: unimportant weights gradually decay toward zero while important weights maintain their values.

### The Dual Benefit in Parameter Golf

**Generalization**: Weight decay acts as an implicit prior that simpler models (smaller weights) are preferred. This fights overfitting by preventing the model from relying on large, fragile weight values that might not generalize.

**Compressibility**: Weights closer to zero have a narrower distribution. Narrower distributions quantize better (less dynamic range to cover with limited bits) and compress better (more repetition in the byte stream). A weight-decayed model at int6 might save 200-500 KB compared to the same architecture without decay.

### Typical Values

The most common weight decay settings in Parameter Golf:

| Decay Value | Context |
|-------------|---------|
| 0.0 | No weight decay (baseline) |
| 0.01-0.02 | Light decay, common default |
| 0.05-0.1 | Moderate decay, used with larger models |
| Scheduled | Some submissions increase decay during warmdown |

Several submissions use **scheduled weight decay** where the decay rate increases during the warmdown phase of training. This makes intuitive sense: as the learning rate drops and the model is settling into its final configuration, increasing weight decay pushes small weights closer to zero right before quantization.`,
    },
    {
      type: "text",
      title: "LN Scale: Regularization Through Layer Control",
      content: `**LayerNorm Scale** (LN Scale) appears in 189 submissions (combining "layerwise LN scale", "LN scale", and "LN Scale" variants). While primarily an architecture modification, it serves a strong regularization role.

### What It Does

LN Scale adds a single learned scalar per layer that multiplies the LayerNorm output before it re-enters the residual stream:

\`residual = residual + ln_scale[layer] * layer_output\`

When \`ln_scale\` is small, the layer's contribution is dampened. When it is large, the layer has more influence. The optimizer learns these scalars during training.

### The Regularization Effect

LN Scale gives the model an easy way to "turn off" layers that are not helping. Instead of driving all the weights in a bad layer to zero (which requires many gradient steps), the optimizer can simply shrink that layer's \`ln_scale\` value. This is a form of **implicit layer pruning**.

In practice, trained models show a characteristic pattern: a few layers have large LN Scale values (they are doing most of the work) while others have small values (contributing little). This natural sparsity in layer importance improves robustness and can hint at which layers could be safely removed or shared via depth recurrence.

### Why It Costs Almost Nothing

LN Scale adds exactly one parameter per layer. For an 11-layer Transformer, that is 11 extra parameters -- not even a rounding error in a model with millions of weights. The implementation is a single scalar multiplication. The benefit is disproportionately large relative to the cost.`,
    },
    {
      type: "text",
      title: "Magnitude Pruning: Trading Accuracy for Bytes",
      content: `**Magnitude pruning** (52 submissions) is the most aggressive regularization technique in Parameter Golf. It sets small weights to exactly zero after training, creating a sparse weight matrix.

### How It Works

After training completes (but before quantization and compression):

- Compute the absolute value of every weight
- Set all weights below a threshold to exactly zero
- Quantize and compress the resulting sparse model

The threshold is typically chosen as a percentile of the weight distribution. Setting the bottom 5% of weights to zero is a common starting point.

### Why Zero Is Special

General-purpose compressors like zstd and zlib are exceptionally good at encoding runs of identical values. A weight tensor with 5% zeros scattered throughout compresses meaningfully better than one with no exact zeros, because the compressor can represent the zero locations efficiently.

At int8 quantization, zero maps to a specific byte value (0x00). Long runs of 0x00 compress to almost nothing. Even scattered zeros increase the frequency of 0x00 in the byte stream, making the entropy coder more efficient.

### The Accuracy-Size Trade-off

Pruning always hurts accuracy. The question is how much. Empirically in Parameter Golf:

- **1-2% pruning**: Negligible BPB impact (~0.001), modest compression gain
- **5% pruning**: Small BPB impact (~0.003-0.005), noticeable compression gain
- **10% pruning**: Measurable BPB impact (~0.01), significant compression gain
- **20%+ pruning**: Substantial BPB impact, use only if severely over the size limit

The sweet spot depends on how tight your byte budget is. If you are 500 KB over the 16 MB limit, moderate pruning (5-10%) might be the cheapest way to get under budget without reducing model size or bit-width.

### Structured vs. Unstructured Pruning

Most Parameter Golf submissions use **unstructured pruning** -- setting individual weights to zero regardless of position. **Structured pruning** (removing entire rows, columns, or attention heads) produces better compression but worse accuracy for the same sparsity level.

Unstructured pruning is simpler and more forgiving. You can precisely control the trade-off by adjusting the percentile threshold.`,
    },
    {
      type: "text",
      title: "Gradient Clipping and Logit Softcapping",
      content: `Two more regularization techniques appear frequently, both addressing training stability rather than model size.

### Gradient Clipping (46 submissions)

**Gradient clipping** caps the magnitude of gradients during backpropagation. If the total gradient norm exceeds a threshold (commonly 1.0), all gradients are scaled down proportionally.

This prevents **gradient explosions** -- rare but catastrophic events where a single bad batch produces enormous gradients that destroy the model's learned weights. In a 6,000-step training run, one gradient explosion can waste hundreds of steps of recovery.

Gradient clipping is cheap insurance. It almost never activates during normal training (well-behaved gradients stay below the threshold), but it catches the rare spikes that would otherwise derail training.

### Logit Softcapping (46 submissions)

**Logit softcapping** (also called logit capping or temperature capping) limits the magnitude of the model's output logits before the softmax. Instead of letting logits grow unboundedly, it applies a soft saturation:

\`capped_logits = cap * tanh(logits / cap)\`

where \`cap\` is typically 30 or 50.

Without softcapping, the model can become overconfident -- assigning near-100% probability to its prediction. This sounds good, but overconfident predictions have two problems:

- **Fragile to quantization**: If the model relies on precise logit values to distinguish between very similar probabilities, quantization noise in the weights can flip predictions entirely.
- **Poor calibration**: The model's confidence should reflect its actual accuracy. Uncapped logits push probabilities toward 0 and 1, destroying calibration.

Softcapping is especially important for BPB evaluation. BPB measures the average log-probability assigned to each byte. A single byte where the model assigns near-zero probability (because it was overconfidently wrong) can spike the BPB dramatically. Softcapping prevents this by keeping logits in a manageable range.`,
    },
    {
      type: "text",
      title: "Other Regularization Techniques",
      content: `Several less common but noteworthy techniques appear in the data.

### Z-Loss (6 submissions)

**Z-loss** adds a penalty proportional to the log-partition function (the log of the sum of exponentials of logits). This penalizes the model for having large logit magnitudes, similar in spirit to logit softcapping but applied as a loss term rather than an activation function.

### Label Smoothing (5 submissions)

**Label smoothing** replaces the hard 0/1 targets in cross-entropy loss with soft targets like 0.05/0.95. This prevents the model from becoming overconfident and has a similar effect to logit softcapping, though it operates on the loss function rather than the model output.

### Dropout (5 submissions)

**Dropout** is notably rare -- only 5 submissions use it. This makes sense for Parameter Golf. Dropout randomly zeros activations during training, effectively training an ensemble of sub-networks. But with models this small, every parameter is precious. Dropout reduces the effective model capacity during training, which is counterproductive when capacity is already severely limited.

### SIGReg (3 submissions)

**SIGReg** (Singular Value Regularization) penalizes the model when singular values of weight matrices become too imbalanced. This encourages weight matrices to use their full capacity rather than collapsing onto a few dominant directions. It is conceptually related to orthogonal initialization -- both aim for uniform treatment of all directions.

### CROWN-Q Penalty (4 submissions)

**CROWN-Q** adds a penalty based on the quantization error that would be introduced if the current weights were quantized. This is a form of **quantization-aware regularization** -- training the model to keep weights in ranges that quantize well, even before the actual quantization step.`,
    },
    {
      type: "text",
      title: "Putting It Together: The Regularization Stack",
      content: `Unlike architecture tricks (where stacking everything works), regularization requires more care. Each technique constrains the model in a different way, and too many constraints can starve the model of capacity.

### The Default Stack

Based on submission patterns, the recommended starting point is:

- **Weight decay**: 0.01-0.02 (nearly universal, low risk)
- **Gradient clipping**: norm clipping at 1.0 (cheap insurance)
- **LN Scale**: one scalar per layer (architecture-regularization hybrid)

### Add If Needed

- **Logit softcapping**: cap at 30-50 (if you see overconfident predictions or BPB spikes)
- **Magnitude pruning**: 2-5% (if you need to reduce artifact size by a few hundred KB)

### Avoid Unless You Have a Specific Reason

- **Dropout**: Too costly for small models
- **Heavy pruning** (>10%): The accuracy loss usually exceeds the compression benefit
- **Multiple overlapping regularizers**: Weight decay + z-loss + label smoothing together can over-constrain the model

### The Key Insight

Regularization in Parameter Golf serves two masters: generalization and compressibility. Weight decay and pruning improve both. Gradient clipping and logit softcapping improve training stability. LN Scale improves both model quality and interpretability.

The best submissions treat regularization as part of the compression pipeline, not just a training technique. Every regularization choice should be evaluated not just by its effect on val_bpb, but by its effect on the final compressed artifact size. A technique that costs 0.002 BPB but saves 300 KB might be worth it if those 300 KB can be spent on additional parameters that improve BPB by 0.005.`,
    },
  ],
};
