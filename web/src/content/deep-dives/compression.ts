import { DeepDive } from "@/lib/types";

export const compression: DeepDive = {
  slug: "compression",
  title: "Compression",
  subtitle: "zstd, pruning, and artifact size optimization",
  category: "compression",
  order: 5,
  sections: [
    {
      type: "text",
      title: "The Last Mile: Squeezing Bytes After Quantization",
      content: `Parameter Golf has a hard 16 MB artifact size limit. Quantization gets you most of the way there -- shrinking weights from float32 to int5 or int6 cuts storage by 5-6x. But that last mile matters. The difference between 15.9 MB and 14.1 MB is room for more parameters, and more parameters means lower BPB.

This is where compression comes in. After you quantize your weights to low-precision integers, you run a general-purpose compression algorithm over the byte stream. The results are surprisingly effective: quantized weights compress well because they have concentrated value distributions with heavy redundancy.

**501 submissions use zstd. 411 use zlib. 248 use lzma.** These are not exotic algorithms. They are standard compression libraries available in every programming language. But the choice between them -- and the settings you use -- can mean the difference between fitting an extra million parameters or not.`,
    },
    {
      type: "text",
      title: "Why Quantized Weights Compress Well",
      content: `You might wonder: if weights are already quantized to 5 or 6 bits, is there much redundancy left to compress? The answer is yes, and the reason comes down to weight distributions.

Neural network weights are not uniformly distributed across their quantization levels. They follow a roughly bell-shaped distribution centered near zero. Most weights cluster in a narrow range around zero, with fewer and fewer weights at the extremes.

### What This Means for Compression

Compression algorithms exploit patterns and repetitions. When most values cluster near zero, certain byte patterns appear far more often than others. An entropy coder (the core of zstd, zlib, and lzma) assigns shorter codes to frequent patterns and longer codes to rare ones.

Consider int8 quantization with 256 possible values. If the distribution were perfectly uniform, each byte would carry 8 bits of information and would be incompressible. But if 80% of weights fall in the range [-30, 30] out of [-128, 127], only ~60 of the 256 levels get heavy use. The effective entropy might be 6 bits per weight instead of 8, meaning a compression algorithm can shrink the data by about 25%.

### The Compression Pipeline

The typical Parameter Golf submission follows this pipeline:

- Train the model in float32 or float16
- Quantize weights to int5, int6, or int8 (often with GPTQ or STE QAT)
- Serialize the quantized weights as a byte stream
- Apply a compression algorithm (zstd, zlib, or lzma)
- Package as the final artifact

At evaluation time, the reverse happens: decompress, then run inference on the quantized weights directly.`,
    },
    {
      type: "text",
      title: "Comparing Compression Algorithms",
      content: `Three algorithms dominate Parameter Golf submissions. Each makes a different trade-off between compression ratio and decompression speed.

### zstd (Zstandard)

**501 submissions** use zstd, making it the most popular choice. Developed by Yann Collet at Facebook, zstd combines LZ77 matching with a fast finite-state entropy coder.

- **Compression level 22** (maximum) is used by at least 331 submissions (\`zstd-22\`)
- Typical compression ratio on quantized weights: 1.2x to 1.5x
- Decompression speed: very fast (~1 GB/s), which matters for evaluation time limits
- Library: \`zstandard\` in Python, built into many frameworks

### zlib

**411 submissions** use zlib, the classic DEFLATE-based compressor. It is older and generally slightly less effective than zstd at maximum settings, but universally available.

- Typical compression ratio: 1.15x to 1.4x
- Decompression speed: fast but slower than zstd
- Advantage: zero dependencies -- available in Python's standard library

### lzma

**248 submissions** use lzma, which typically achieves the best compression ratios of the three at the cost of slower compression and decompression.

- Typical compression ratio: 1.3x to 1.6x
- Decompression speed: significantly slower than zstd or zlib
- Library: \`lzma\` in Python's standard library

### Head-to-Head Comparison

| Algorithm | Submissions | Typical Ratio | Decompress Speed | Dependencies |
|-----------|-------------|---------------|-------------------|--------------|
| zstd-22 | 501 | 1.2-1.5x | Very fast | External lib |
| zlib | 411 | 1.15-1.4x | Fast | Standard lib |
| lzma | 248 | 1.3-1.6x | Slow | Standard lib |
| brotli | 11 | 1.2-1.5x | Fast | External lib |

The popularity of zstd reflects its sweet spot: near-lzma compression ratios with near-zlib decompression speed. For Parameter Golf, decompression speed matters because the evaluation pipeline has time limits.`,
    },
    {
      type: "code",
      title: "Compression in Practice",
      language: "python",
      content: `import zstandard
import zlib
import lzma
import struct
import torch

def compress_model_zstd(state_dict: dict, level: int = 22) -> bytes:
    """Compress a quantized model's state dict with zstd."""
    # Serialize weights to bytes
    buffer = bytearray()
    for name, tensor in state_dict.items():
        # Store tensor metadata
        name_bytes = name.encode('utf-8')
        buffer.extend(struct.pack('I', len(name_bytes)))
        buffer.extend(name_bytes)
        buffer.extend(struct.pack('I', tensor.ndim))
        for dim in tensor.shape:
            buffer.extend(struct.pack('I', dim))
        # Store raw weight bytes
        weight_bytes = tensor.numpy().tobytes()
        buffer.extend(struct.pack('Q', len(weight_bytes)))
        buffer.extend(weight_bytes)

    # Compress with zstd at maximum level
    compressor = zstandard.ZstdCompressor(level=level)
    compressed = compressor.compress(bytes(buffer))

    ratio = len(buffer) / len(compressed)
    print(f"Raw: {len(buffer):,} bytes")
    print(f"Compressed: {len(compressed):,} bytes")
    print(f"Ratio: {ratio:.2f}x")

    return compressed

# Example: 10M params at int8 = ~10 MB raw
# After zstd-22: typically ~7-8 MB
# Combined with int6 quantization: 10M * 0.75 bytes = 7.5 MB raw
# After zstd-22: typically ~5-6 MB -- well under 16 MB`,
    },
    {
      type: "text",
      title: "Advanced Compression Strategies",
      content: `Beyond choosing the right algorithm, several strategies can squeeze extra bytes from your artifact.

### Weight Ordering

Compression algorithms find patterns in sequential bytes. If you serialize weights row by row, adjacent bytes represent adjacent weights in the same row. This is good -- weights in the same row tend to have similar magnitudes. But you can sometimes do better by reordering weights to maximize local similarity.

Some submissions sort weight rows by their L2 norm before compression. Similar rows end up adjacent, creating longer runs of similar byte patterns. The decompressor does not need to know the ordering -- the model just stores a permutation index to undo the sort at load time.

### Dictionary Compression

zstd supports dictionary-based compression, where you pre-train a compression dictionary on representative data. For Parameter Golf, you could train a dictionary on the weight distributions of similar models. The dictionary helps the compressor model the data distribution more accurately.

In practice, the gains from dictionary compression are modest (1-3%) because the models are already large enough for the compressor to learn good statistics on the fly.

### Pruning for Compressibility

**Magnitude pruning** (used by 52 submissions) sets small weights to exactly zero. This does two things: it reduces the number of effective parameters (potentially hurting accuracy) and it dramatically improves compressibility (zeros compress extremely well).

The art is finding the pruning threshold that gives back more bytes than the accuracy it costs. A model with 5% of weights pruned to zero might compress 10% better while losing only 0.001 BPB -- a favorable trade.

### Interactions with Quantization

Lower-bit quantization generally compresses better because:

- Fewer unique values means more repetition
- Narrower value ranges mean shorter codes
- Zero-heavy distributions from pruning amplify the effect

This is why the compression pipeline is always quantize-then-compress, never the reverse. Compressing float32 weights directly is far less effective than compressing their quantized versions.`,
    },
    {
      type: "text",
      title: "Practical Impact: How Much Space Does Compression Save?",
      content: `The practical question is: how many extra parameters can you fit thanks to compression?

Consider a typical setup:

- **10M parameters in int6** (6 bits each): 10M x 0.75 bytes = 7.5 MB raw
- **After zstd-22**: ~5.5 MB (1.36x ratio)
- **Savings**: 2 MB, enough for ~2.7M more int6 parameters

Those extra 2.7M parameters translate directly into a wider or deeper model, which typically improves BPB by 0.01-0.03 depending on the architecture. That is a meaningful gain for zero accuracy cost -- compression is lossless.

### When Compression Matters Most

Compression matters most when you are close to the 16 MB limit and want to maximize parameters. If your model is already well under budget, the effort of optimizing compression settings yields diminishing returns.

The top submissions tend to be tightly packed. They use every byte of the 16 MB budget, which means compression is not optional -- it is a core part of the submission strategy. Choosing zstd-22 over default zlib might free up 500 KB, which is another 667K int6 parameters. At the margins, this matters.

### The Bottom Line

Compression in Parameter Golf is unglamorous but essential. The algorithm choice (zstd-22 for most), the quantization format (int5 or int6), and optional pruning form a pipeline that determines how much model you can fit in 16 MB. Every submission in the top 50 uses some form of compression. It is table stakes.`,
    },
  ],
};
