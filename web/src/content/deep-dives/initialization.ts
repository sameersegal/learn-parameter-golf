import { DeepDive } from "@/lib/types";

export const initialization: DeepDive = {
  slug: "initialization",
  title: "Initialization",
  subtitle: "OrthoInit and weight initialization strategies",
  category: "initialization",
  order: 8,
  sections: [
    {
      type: "text",
      title: "The First Thing Your Model Learns Depends on Where It Starts",
      content: `Before a neural network sees a single training example, its weights already have values. Those initial values are not learned -- they are set by the **initialization strategy**. And this choice matters more than you might think.

In Parameter Golf, **171 submissions use OrthoInit** (orthogonal initialization). Another 18 use spectral initialization. 15 use resid mix. The rest use whatever the framework default is, usually Kaiming or Xavier initialization.

Why would the starting point matter so much when the optimizer is going to update every weight thousands of times? Because training is short. Parameter Golf models train for 5,000-7,000 steps -- a fraction of the hundreds of thousands of steps used for production models. Bad initialization wastes precious steps recovering from a poor starting position. Good initialization puts the model in a region where early gradient updates are immediately productive.`,
    },
    {
      type: "text",
      title: "The Problem with Random Initialization",
      content: `The standard approach is to initialize weights from a random distribution. The scale of the distribution matters -- too large and activations explode, too small and they vanish. **Kaiming initialization** (He et al., 2015) and **Xavier initialization** (Glorot & Bengio, 2010) solve this scaling problem by choosing the variance based on layer width.

But scaling is only half the battle. Even with correct scale, random matrices have a specific problem: their singular values are not uniform. A random matrix tends to amplify some directions in the input space and suppress others. Over many layers, this directional bias compounds. Some features get exponentially amplified while others vanish.

### What Goes Wrong

Imagine passing a signal through 11 random matrices (one per Transformer layer). Even with perfect scaling, the output depends heavily on which random directions each matrix happens to amplify. Some input features survive all 11 layers. Others get crushed to zero by layer 3.

This creates two problems for training:

- **Gradient imbalance**: Features that survive the forward pass dominate the loss. Features that get crushed contribute tiny gradients and update slowly. The model effectively has fewer usable features than its width suggests.

- **Wasted early steps**: The optimizer spends its first few hundred steps just fixing the directional biases that random initialization created. In a 6,000-step training run, that is a significant fraction of the compute budget.`,
    },
    {
      type: "text",
      title: "OrthoInit: Equal Treatment for All Directions",
      content: `**Orthogonal initialization** solves the directional bias problem by construction. An orthogonal matrix preserves lengths and angles -- it rotates the input without stretching or compressing any direction. Every singular value is exactly 1.

Pass a signal through an orthogonal matrix and every feature comes out the other side with the same magnitude it went in with. Stack 11 orthogonal matrices and the signal still preserves all features equally. No amplification, no suppression.

### How It Works

For a weight matrix of size (n, m) where n >= m:

- Generate a random matrix from a standard normal distribution
- Compute its QR decomposition (or SVD)
- Take the Q matrix (or U matrix), which is orthogonal
- Scale it appropriately for the layer width

The result is a matrix where all singular values equal the scaling factor. Every direction in the input space gets equal treatment.

### Why 171 Submissions Use It

The benefit is most pronounced in exactly the regime Parameter Golf operates in: small models with limited training time. When you have 512-dimensional representations and only 6,000 training steps, you cannot afford to waste capacity on directions that random initialization accidentally suppressed.

The empirical evidence is clear. Among the top 50 neural submissions, the majority use OrthoInit. The technique costs nothing at inference time -- it only affects how weights are set before training begins. It is purely upside.`,
    },
    {
      type: "code",
      title: "Implementing OrthoInit for a Transformer",
      language: "python",
      content: `import torch
import torch.nn as nn

def orthogonal_init(module: nn.Module, scale: float = 1.0):
    """Apply orthogonal initialization to all linear layers.

    For Parameter Golf Transformers, this replaces the default
    Kaiming init and gives more uniform signal propagation
    across the model's depth.
    """
    for name, param in module.named_parameters():
        if param.ndim >= 2:
            # Orthogonal init for weight matrices
            nn.init.orthogonal_(param, gain=scale)
        elif 'bias' in name:
            # Zero init for biases
            nn.init.zeros_(param)


def orthogonal_init_scaled(module: nn.Module, num_layers: int = 11):
    """OrthoInit with per-layer scaling to prevent signal growth.

    In a residual network, each layer ADDS to the residual stream.
    Without scaling, the residual grows as sqrt(num_layers).
    Scaling output projections by 1/sqrt(num_layers) keeps the
    residual magnitude stable.
    """
    for name, param in module.named_parameters():
        if param.ndim >= 2:
            if 'out_proj' in name or 'o_proj' in name:
                # Scale down output projections
                nn.init.orthogonal_(param, gain=1.0 / (num_layers ** 0.5))
            else:
                nn.init.orthogonal_(param, gain=1.0)
        elif 'bias' in name:
            nn.init.zeros_(param)


# Usage:
model = TransformerLM(num_layers=11, d_model=512)
orthogonal_init_scaled(model, num_layers=11)`,
    },
    {
      type: "text",
      title: "Other Initialization Strategies",
      content: `Beyond OrthoInit, several other initialization strategies appear in Parameter Golf submissions.

### Spectral Initialization (18 submissions)

Spectral init goes a step further than orthogonal init by controlling not just the singular values of individual matrices, but the spectral properties of the entire network. The idea is to initialize the full forward pass (all layers composed together) to have well-conditioned singular values.

In practice, this means initializing each layer's weight matrix and then adjusting it based on the computed spectral norm of the layer stack so far. It is more computationally expensive to set up than OrthoInit but can provide better signal propagation in very deep networks.

### Resid Mix (15 submissions)

**Resid mix** initialization sets the residual connection scaling factors to specific values at initialization time. In a Transformer with residual connections, the output of each layer is:

\`output = input + scale * layer(input)\`

Resid mix initializes \`scale\` to small values (often near zero) so that the model starts as nearly an identity function. This is related to the **fixup** and **ReZero** initialization strategies from the research literature.

The intuition: a model that starts as the identity function has perfect gradient flow from the start. Every layer can be trained independently at first, then gradually learns to contribute to the residual stream.

### Overtone Init (6 submissions)

**Overtone init** initializes embedding layers using patterns inspired by harmonic overtones. The idea is to give the model a structured starting point for its token representations rather than purely random embeddings.

This is a more speculative technique with fewer submissions and less clear evidence of consistent benefit.

### What the Framework Defaults Do

If you do not specify an initialization strategy, PyTorch uses Kaiming uniform initialization for linear layers. This sets the scale correctly but does not control directional properties. For Parameter Golf's short training runs, this is measurably worse than OrthoInit.`,
    },
    {
      type: "text",
      title: "Practical Recommendations",
      content: `### Use OrthoInit

For any Parameter Golf submission, replace the default initialization with orthogonal initialization. It takes 5 lines of code, costs nothing at inference time, and is used by the majority of top submissions.

### Scale Output Projections

In residual Transformer architectures, scale the output projections of attention and MLP blocks by a factor related to the number of layers. Common choices:

- Scale by \`1 / sqrt(num_layers)\` -- the most common approach
- Scale by \`1 / num_layers\` -- more aggressive, used by some depth-recurrent models
- Use learned scaling factors (LN Scale) initialized to small values

This prevents the residual stream from growing uncontrollably, which matters more for the 11-layer models common in Parameter Golf than for the 2-3 layer models where initialization is less critical.

### Do Not Over-Optimize

Initialization interacts with every other training choice: learning rate, optimizer, architecture, normalization. Changing initialization often requires re-tuning the learning rate. Given how well-tuned the warmdown + Muon + OrthoInit combination is across hundreds of submissions, the safest approach is to copy that exact recipe rather than experimenting with exotic initialization schemes.

The best initialization gets out of the way. It sets up clean gradient flow and uniform feature propagation, then lets the optimizer do its job. OrthoInit does exactly this.`,
    },
  ],
};
