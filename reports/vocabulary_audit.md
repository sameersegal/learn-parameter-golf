# Vocabulary Audit Report

## Status Distribution

- **open**: 515

## is_record Analysis

- **159** PRs marked as record
- Sample PR numbers: [85, 88, 89, 92, 98, 106, 108, 114, 122, 123]

## Category Frequency

| Category | Count |
|----------|-------|
| architecture_modification | 1804 |
| quantization | 509 |
| optimizer_technique | 394 |
| other | 392 |
| evaluation_technique | 344 |
| compression | 338 |
| weight_averaging | 318 |
| regularization | 301 |
| lr_schedule | 291 |
| sequence_length | 233 |
| initialization | 168 |
| test_time_training | 159 |
| training_techniques **INVALID** | 2 |

## Invalid Categories

- PR #524: `training_techniques`
- PR #635: `training_techniques`

## Method Name Variants (Normalization Needed)

### BigramHash (231 uses, categories: architecture_modification)

- "BigramHash" (222)
- "TrigramHash" (9)

### weight tying (200 uses, categories: architecture_modification, regularization)

- "tied embeddings" (153)
- "weight tying" (42)
- "Tied embeddings" (3)
- "Tied Embeddings" (2)

### XSA (125 uses, categories: architecture_modification)

- "XSA" (118)
- "XSA4" (7)

### OrthoInit (109 uses, categories: architecture_modification, initialization)

- "OrthoInit" (92)
- "Orthogonal init" (7)
- "Orthogonal initialization" (4)
- "orthogonal init" (3)
- "Orthogonal" (3)

### AdamW (86 uses, categories: optimizer_technique)

- "AdamW" (71)
- "Adam" (15)

### mixed int5/int6 (73 uses, categories: quantization)

- "mixed int5/int6" (41)
- "mixed int6/int8" (20)
- "mixed int5/int6/int8" (5)
- "mixed int5/int6 QAT" (4)
- "mixed int8/int6" (3)

### U-Net skip connections (63 uses, categories: architecture_modification)

- "U-Net skip connections" (49)
- "U-Net skips" (12)
- "U-Net skip" (2)

### LoRA TTT (44 uses, categories: architecture_modification, test_time_training)

- "LoRA TTT" (43)
- "Per-document LoRA TTT" (1)

### LN Scale (24 uses, categories: architecture_modification, regularization)

- "LN Scale" (20)
- "LN scale" (4)

### GQA (22 uses, categories: architecture_modification)

- "GQA" (21)
- "Grouped Query Attention" (1)

### Muon + Adam (12 uses, categories: optimizer_technique)

- "Muon + Adam" (6)
- "Muon + AdamW" (6)

### LeakyReLU (12 uses, categories: architecture_modification)

- "LeakyReLU" (8)
- "LeakyReLU²" (4)

### overtone init (8 uses, categories: initialization)

- "overtone init" (5)
- "OvertoneInit" (3)

### LeakyReLU(0.5)² (7 uses, categories: architecture_modification)

- "LeakyReLU(0.5)²" (4)
- "LeakyReLU(0.5)^2" (3)

### ReLU² (3 uses, categories: architecture_modification)

- "relu²" (2)
- "ReLU²" (1)

## 'other' Category Analysis

- **Total 'other' entries**: 392
- **Reclassifiable**: 63
- **Unmatched**: 329

### Suggested Reclassifications

- PR #117: "QAT weight-snapping started at 70% of training." → **quantization**
- PR #123: "Custom SentencePiece BPE tokenizer with vocab size 4096 trained on FineWeb." → **other_suggested:tokenization**
- PR #130: "Muon-aware QAT with two modes: STE and Gaussian noise, activated late to preserv" → **quantization**
- PR #137: "Mixed quantization with int6 per-row on MLP and attention weights, fp16 passthro" → **quantization**
- PR #175: "Late QAT with STE threshold 0.15." → **quantization**
- PR #192: "Int6-in-int8 container storage with restricted-range zstd compression" → **compression**
- PR #196: "Quantization-aware training with delayed start." → **quantization**
- PR #200: "SP4096 SentencePiece BPE tokenizer with improved text compression over sp1024." → **other_suggested:tokenization**
- PR #200: "Per-row int6 quantization with fp16 embedding passthrough and zstd-22 artifact c" → **compression**
- PR #205: "2% magnitude pruning applied to the model." → **regularization**
- PR #247: "Post-training int8 zlib roundtrip evaluation of the serialized model artifact." → **compression**
- PR #286: "late QAT starting at 85% wallclock to avoid always-on STE instability while clos" → **quantization**
- PR #293: "Trained a custom BPE SentencePiece tokenizer on 2 million FineWeb documents usin" → **other_suggested:tokenization**
- PR #305: "10% magnitude pruning before quantisation to create zero runs that compress bett" → **regularization**
- PR #322: "3% magnitude pruning to improve compressibility." → **regularization**

## Cross-Category Overlaps

| Method | Categories | Uses |
|--------|-----------|------|
| zstd | compression, quantization | 207 |
| weight tying | architecture_modification, regularization | 200 |
| SWA | architecture_modification, weight_averaging | 165 |
| EMA | architecture_modification, weight_averaging | 140 |
| OrthoInit | architecture_modification, initialization | 109 |
| layerwise LN scale | architecture_modification, regularization | 45 |
| LoRA TTT | architecture_modification, test_time_training | 44 |
| GPTQ-lite | architecture_modification, quantization | 27 |
| LN Scale | architecture_modification, regularization | 20 |
| logit softcap | architecture_modification, regularization | 4 |
| late QAT | architecture_modification, lr_schedule, quantization | 3 |
| resid_mix | architecture_modification, initialization | 2 |
| phase-transition resid_mix | architecture_modification, initialization | 2 |
| Selective ±1 magnitude pruning | architecture_modification, quantization | 2 |
| LN scaling | architecture_modification, regularization | 2 |

## `architecture` Field Analysis

- **Unique values**: 65
- **Null count**: 50

**Top 10 values:**

- "Transformer" (368)
- "GPT" (24)
- "modded-nanogpt-derived Transformer" (3)
- "U-Net Transformer" (2)
- "Universal Transformer" (2)
- "Hybrid Depth-Recurrent Transformer" (2)
- "11L Transformer" (2)
- "GEPA" (2)
- "U-Net" (2)
- "Ternary U-Net Transformer" (2)

**Over-verbose examples (>60 chars):**

- "Multi-head language model with kernel-based readout heads and a ComplexSSM + causal self-attention t..."
- "Transformer (11L depth recurrence with 10 unique BlockCores, LeakyReLU(0.5)² MLP)..."
- "11L/512d/8H/4KV/3xMLP (relu²), U-Net skip, Partial RoPE (16/64), XSA last 4, BigramHash(2048), VE128..."
- "11L/512d/8H/4KV/3xMLP (relu²) with U-Net skip connections, Partial RoPE (16/64), XSA last 4 layers, ..."
- "Transformer (custom with LeakyReLU, U-Net skip connections, Grouped Query Attention, partial RoPE, C..."

## `quantization` Field Analysis

- **Unique values**: 213
- **Null count**: 78

**Top 10 values:**

- "int8" (40)
- "int6 QAT" (37)
- "mixed int5/int6" (30)
- "int6" (23)
- "mixed int6/int8" (14)
- "GPTQ-lite int6" (14)
- "int8 + zlib" (13)
- "int6 per-row quantization" (8)
- "int8 QAT" (7)
- "mixed int6 quantization" (5)

**Over-verbose examples (>60 chars):**

- "mixed int6 quantization with fp16 tied embedding passthrough and STE QAT..."
- "int6 post-training quantization with selective fp16 preservation..."
- "Muon-aware QAT (STE or Gaussian noise), targeting int8/int6 quantization sensitivity..."
- "FP16 embeddings passthrough with int8/tied-embedding export implied..."
- "mixed selective precision with fp16 tied embedding and late-K passthrough..."

## `optimizer` Field Analysis

- **Unique values**: 28
- **Null count**: 153

**Top 10 values:**

- "Muon" (246)
- "AdamW" (29)
- "Parallel Muon" (19)
- "NorMuon" (13)
- "Muon + AdamW" (13)
- "SGD" (8)
- "Adam" (6)
- "Muon + Adam" (5)
- "Muon/AdamW" (2)
- "SGD with momentum" (2)

**Over-verbose examples (>60 chars):**

- "Muon (hidden/attn) + Adam (embeddings/scalars) for training; SGD with momentum=0.9 for TTT..."
- "Muon (lr=0.025, WD=0.04, momentum=0.99) for base training; SGD + momentum 0.9 for TTT..."

## Null Field Analysis

| Field | Missing Count | Sample PRs |
|-------|--------------|------------|
| val_bpb | 80 | [98, 115, 127, 133, 149] |
| architecture | 50 | [106, 153, 165, 171, 177] |
| quantization | 78 | [91, 96, 98, 106, 133] |
| optimizer | 153 | [91, 93, 94, 95, 97] |
| compression | 133 | [91, 96, 98, 106, 114] |

## Temporal Drift Analysis

**515** PRs split into terciles by PR number.

| Period | PRs | PR Range | Avg Techniques | 'other' % | val_bpb null % |
|--------|-----|----------|----------------|-----------|----------------|
| early | 171 | #85–#316 | 9.2 | 9.5% | 16.4% |
| middle | 171 | #317–#550 | 10.7 | 6.2% | 15.8% |
| late | 173 | #551–#772 | 10.7 | 7.0% | 14.5% |

### Null Rates by Period

| Field | Early % | Middle % | Late % |
|-------|---------|----------|--------|
| val_bpb | 16.4% | 15.8% | 14.5% |
| architecture | 9.9% | 9.4% | 9.8% |
| quantization | 15.8% | 14.6% | 15.0% |
| optimizer | 25.7% | 28.1% | 35.3% |
| compression | 25.7% | 26.9% | 24.9% |

### Emerging Techniques (late period only, not seen in early)

These techniques appeared only in the latest third of submissions — the prompt may not handle them well.

- **GPTQ** (18 uses)
- **cosine decay** (16 uses)
- **Parallel Muon** (16 uses)
- **Gated Attention** (11 uses)
- **LN Scale** (9 uses)
- **Value Residual** (8 uses)
- **LeakyReLU** (6 uses)
- **VE128** (5 uses)
- **TrigramHash** (4 uses)
- **MLP activation** (4 uses)
- **EMA + Tight SWA** (4 uses)
- **LeakyReLU²** (4 uses)
- **Muon + AdamW** (3 uses)
- **LeakyReLU(0.5)²** (3 uses)
- **MLP expansion** (3 uses)
- **XSA4** (3 uses)
- **EMA + SWA** (3 uses)
- **LeakyReLU(0.5)^2** (3 uses)
- **Value Residual Learning (VRL)** (2 uses)
- **XSA-all** (2 uses)

### Architecture Field Drift

- **early**: "Transformer" (127), "null" (17), "GPT" (13), "Universal Transformer" (2), "U-Net Transformer" (1)
- **middle**: "Transformer" (126), "null" (16), "GPT" (6), "recurrent motif architecture" (1), "Looped Transformer" (1)
- **late**: "Transformer" (115), "null" (17), "GPT" (5), "modded-nanogpt-derived Transformer" (3), "GEPA" (2)

### Quantization Field Drift

- **early**: "null" (27), "int8" (23), "int6 QAT" (14), "int8 + zlib" (7), "mixed int6/int8" (7)
- **middle**: "null" (25), "mixed int5/int6" (15), "int6 QAT" (15), "int8" (10), "int6" (7)
- **late**: "null" (26), "mixed int5/int6" (12), "GPTQ-lite int6" (12), "int6" (9), "int6 QAT" (8)

## Recommendations

1. **Normalize method names** — Apply canonical aliases to reduce variant proliferation
2. **Constrain `architecture`** — Prompt should request a short base type (Transformer, Mamba, LSTM, etc.), not a full config dump
3. **Constrain `quantization`** — Limit to a concise summary like "int8 QAT" not free-form descriptions
4. **Reclassify 'other'** — Many entries belong in existing categories (especially quantization, regularization)
5. **Fix status extraction** — Raw data shows state/merged fields; prompt should derive status more carefully
6. **Add missing categories** — Consider: tokenization/data, training_objective, pruning
7. **Reduce is_record false positives** — Cross-reference with labels and explicit record mentions
8. **Improve val_bpb extraction** — Many null values may have bpb buried in text or tables
