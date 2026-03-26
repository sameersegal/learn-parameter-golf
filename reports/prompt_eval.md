# Prompt Evaluation Report

**Sample size**: 24 PRs

**Overall mean score**: 4.31/5.0

**Period distribution**: {'early': 8, 'middle': 8, 'late': 8}

## Dimension Scores (Overall)

| Dimension | Mean | Min | Max |
|-----------|------|-----|-----|
| Val Bpb Accuracy | 4.83 | 2 | 5 |
| Technique Completeness | 4.12 | 4 | 5 |
| Technique Precision | 4.21 | 3 | 5 |
| Method Naming Consistency | 3.42 | 2 | 5 |
| Architecture Appropriateness | 4.88 | 3 | 5 |
| Category Correctness | 3.83 | 2 | 5 |
| Vocabulary Currency | 4.88 | 4 | 5 |

## Scores by Time Period (Temporal Drift)

Does the prompt perform worse on newer PRs?

| Dimension | Early | Middle | Late |
|-----------|-------|--------|------|
| Val Bpb Accuracy | 5.0 | 4.5 | 5.0 |
| Technique Completeness | 4.12 | 4.25 | 4.0 |
| Technique Precision | 4.25 | 4.25 | 4.12 |
| Method Naming Consistency | 3.38 | 3.5 | 3.38 |
| Architecture Appropriateness | 5.0 | 4.62 | 5.0 |
| Category Correctness | 3.88 | 4.12 | 3.5 |
| Vocabulary Currency | 5.0 | 4.75 | 4.88 |
| **Overall** | 4.38 | 4.28 | 4.27 |


## Systematic Issues

### category_correctness (low) — 15 occurrences

- Weight tying is placed under architecture_modification rather than a more appropriate canonical technique label; weight decay is split across optimizer_technique and regularization, creating mild category overlap.
- The 'test_time_training' and 'initialization' categories are mostly appropriate, but some entries are phrased in a way that could fit multiple categories, and 'other' is used for a technique that might merit a more specific category.
- GPT.forward_logits is placed in 'other', even though it is part of the evaluation/scoring mechanism and could arguably be categorized more specifically.

### method_naming_consistency (medium) — 14 occurrences

- Naming is somewhat verbose and non-canonical in places, especially 'tied embeddings' instead of the canonical 'weight tying', and 'sliding window eval' instead of a more standardized technique label.
- Several names are descriptive rather than canonical, especially 'tied embeddings' instead of the canonical 'weight tying'.
- Several technique names are verbose or descriptive rather than canonical, especially 'Overtone spectrum initialization' and 'Sigmoid-scheduled phase-transition residual mixing strategy.'

### technique_completeness (medium) — 11 occurrences

- The extraction missed some source details such as the 9L/512dim/8H/4KV architecture from the PR body and the explicit fp16 late-K passthrough wording; it also did not capture the 21.8M parameter count from the PR body.
- Most source techniques were captured, but a few source-listed items are missing or only partially represented, especially some of the phase 1 optimization details and the exact phrasing of several novel techniques.
- The extraction captures most techniques, but misses the explicit '11 transformer layers' / '11L' architecture detail as a technique-like contribution and does not separately capture 'seed 1337' or 'sliding window stride=64' as distinct result/config items beyond the eval technique.

### technique_completeness (low) — 9 occurrences

- Most major techniques were captured, but the extraction missed some source details such as relu^2 activation, encoder-decoder skip connections, and the explicit 9237 steps / 600s training throughput context.
- The extraction captures most major techniques, but it misses some descriptive implementation details such as the explicit 8xH100 training setup and the exact 'matrix_lr/scalar_lr tuning' phrasing.
- The extraction captures the main sliding-window evaluation idea and related GPT.forward_logits change, but it omits some potentially relevant implementation detail such as the EVAL_BATCH_SEQS setting.

### technique_precision (low) — 8 occurrences

- Most extracted techniques are supported by the source, but 'architecture': 'Transformer' is somewhat underspecified relative to the richer architecture descriptions in the source.
- Most extracted techniques are supported by the source, but 'LoRA TTT' is slightly simplified from the source's 'dynamically updated LoRA adapters on the validation stream.'
- The quantization entry is slightly imprecise: the source describes selective quantization as INT6 weights plus INT8 embeddings with zlib, while the extracted summary compresses this into a broader mixed int6/int8 formulation.

### method_naming_consistency (low) — 7 occurrences

- Some names are descriptive rather than canonical, such as 'sliding window eval' and 'mixed int6/int8 selective quantization', though they remain understandable.
- Some technique names are verbose rather than canonical, e.g. 'score-first TTT' instead of a more standardized 'legal score-first TTT' or a canonical TTT label.
- Some entries are verbose/descriptive rather than canonical method names, especially the 'other' items for the governor and GC guard.

### category_correctness (medium) — 5 occurrences

- Some techniques are placed in questionable categories or duplicated across categories, notably weight decay under both optimizer and regularization, and tied embeddings under architecture modification rather than weight tying.
- A number of techniques that could fit existing categories were placed into 'other', reducing category consistency.
- Some items are placed in broad or debatable categories, especially the optimizer entries and the 'other' bucket for pruning, but there are no major blatant misclassifications.

### technique_precision (medium) — 4 occurrences

- Several extracted items are over-interpreted or not explicitly stated as standalone techniques, such as treating 'spectral init' as a named method and splitting fp16 embedding passthrough into a separate quantization technique.
- Several extracted entries are paraphrased into generic or ambiguous technique labels (e.g., 'other' descriptions), which makes it harder to verify exact correspondence to the source.
- A few extracted items are somewhat interpretive rather than exact source phrases, such as treating 'tied embeddings' as a technique entry and summarizing 'GPTQ-lite int6 + zstd-22' into separate structured fields.

### vocabulary_currency (low) — 2 occurrences

- Newer competition terminology is mostly recognized, including Value Residual, Gated Attention, and GPTQ-lite, but some are represented with non-standard wording.
- The extraction handles late-period terminology reasonably well, but does not explicitly surface some newer or more specific competition vocabulary present in the source, such as Flash Attention v3 and Muon + AdamW.

### val_bpb_accuracy (high) — 1 occurrences

- The source explicitly says val_bpb is pending, so null is acceptable, but the rubric treats a missed existing value as 2 only if a bpb value exists. Here no numeric val_bpb is present, so the extraction is fine; however the score is kept low because the field is unresolved rather than extracted from a concrete value.

### architecture_appropriateness (medium) — 1 occurrences

- The architecture field is only 'GPT', which is clean but somewhat underspecified relative to the source's 11-layer GPT-style model; still acceptable as a base type.

### architecture_appropriateness (low) — 1 occurrences

- The architecture field is reasonably clean ('GPT') but loses important architectural context present in the source, such as 12-layer GPT with 512d, 8H/4KV, GQA, RoPE, BigramHash, and SmearGate.

### val_bpb_accuracy (low) — 1 occurrences

- Extracted val_bpb is 1.133, which is a rounded version of the source value 1.1330.

### method_naming_consistency (high) — 1 occurrences

- Technique names are mostly verbose descriptions rather than canonical method names; entries like 'runtime shard and validation-sequence limits' and 'budget-aware architecture filtering' are not standardized technique labels.

### category_correctness (high) — 1 occurrences

- All extracted techniques were placed in 'other', even though these are workflow/tooling or training-related changes and should be more specifically categorized where possible.

## Most Commonly Missed Techniques

- **U-Net skip connections** (3 times)
- **relu^2 activation** (1 times)
- **encoder-decoder skip connections** (1 times)
- **9237 steps in 600s on 8×H100** (1 times)
- **9L/512dim/8H/4KV architecture** (1 times)
- **21.8M params** (1 times)
- **fp16 late-K layer passthrough** (1 times)
- **8xH100 training setup** (1 times)
- **matrix_lr/scalar_lr tuning** (1 times)
- **optimal hyperparameters** (1 times)

## Most Commonly Hallucinated Techniques

- **spectral init** (1 times)
- **None** (1 times)

## Per-PR Scorecards

### PR #322 [middle] (overall: 3.29)

- Val Bpb Accuracy: 2/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 3/5
- Category Correctness: 3/5
- Vocabulary Currency: 4/5

**Issues:**
- [high] val_bpb_accuracy: The source explicitly says val_bpb is pending, so null is acceptable, but the rubric treats a missed existing value as 2 only if a bpb value exists. Here no numeric val_bpb is present, so the extraction is fine; however the score is kept low because the field is unresolved rather than extracted from a concrete value.
- [medium] method_naming_consistency: Several extracted names are verbose or non-canonical, such as 'score-first TTT' instead of a more standard method label, and architecture descriptions include extra detail rather than a clean canonical name.
- [medium] architecture_appropriateness: The architecture field is only 'GPT', which is clean but somewhat underspecified relative to the source's 11-layer GPT-style model; still acceptable as a base type.
- [medium] category_correctness: Some items are placed in broad or debatable categories, especially the optimizer entries and the 'other' bucket for pruning, but there are no major blatant misclassifications.

**Notes:** The extraction is generally strong and captures the main techniques, hyperparameters, and training setup. The biggest weakness is incomplete coverage of smaller but explicit details from the source, plus some non-canonical phrasing and slightly coarse categorization. The val_bpb field is correctly null because the source reports it as pending.

### PR #748 [late] (overall: 3.86)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 2/5
- Architecture Appropriateness: 5/5
- Category Correctness: 2/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: The extraction captures the main workflow changes, but it misses some source details such as the README and dedicated playbook documentation emphasis as separate contributions.
- [high] method_naming_consistency: Technique names are mostly verbose descriptions rather than canonical method names; entries like 'runtime shard and validation-sequence limits' and 'budget-aware architecture filtering' are not standardized technique labels.
- [high] category_correctness: All extracted techniques were placed in 'other', even though these are workflow/tooling or training-related changes and should be more specifically categorized where possible.

**Notes:** No bpb value is mentioned in the source, so the null extraction is correct. Architecture is correctly null because none is specified. The extraction is generally faithful to the PR, but it relies heavily on generic 'other' categorization and descriptive phrasing.

### PR #251 [early] (overall: 4.0)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 3/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 3/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: Most major techniques were captured, but the extraction missed some source details such as relu^2 activation, encoder-decoder skip connections, and the explicit 9237 steps / 600s training throughput context.
- [medium] technique_precision: Several extracted items are over-interpreted or not explicitly stated as standalone techniques, such as treating 'spectral init' as a named method and splitting fp16 embedding passthrough into a separate quantization technique.
- [medium] method_naming_consistency: Naming is somewhat verbose and non-canonical in places, especially 'tied embeddings' instead of the canonical 'weight tying', and 'sliding window eval' instead of a more standardized technique label.
- [medium] category_correctness: Some techniques are placed in questionable categories or duplicated across categories, notably weight decay under both optimizer and regularization, and tied embeddings under architecture modification rather than weight tying.

**Notes:** The extraction correctly captured the main record-setting metric, model size, quantization/compression setup, optimizer settings, and GQA configuration. The main weaknesses are mild over-fragmentation of concepts and some non-canonical naming/category choices rather than major factual errors.

### PR #344 [middle] (overall: 4.0)

- Val Bpb Accuracy: 4/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 4/5

**Issues:**
- [low] val_bpb_accuracy: Extracted val_bpb is 1.133, which is a rounded version of the source value 1.1330.
- [medium] technique_completeness: Most major techniques were captured, but some source details were omitted or simplified, such as batch size, gradient clip, and the exact BigramHash/TrigramHash phrasing.
- [medium] method_naming_consistency: Several names are not in canonical form or are verbose, such as 'tied embeddings' instead of 'weight tying' and 'Orthogonal initialization' instead of 'OrthoInit'.
- [low] category_correctness: Some techniques are placed in potentially overlapping or non-canonical categories, especially GPTQ-lite under quantization and OrthoInit under initialization versus architecture_modification.
- [low] vocabulary_currency: Newer competition terminology is mostly recognized, including Value Residual, Gated Attention, and GPTQ-lite, but some are represented with non-standard wording.

**Notes:** The extraction is generally strong and captures the core architecture, optimizer, quantization, and several novel techniques. The main weaknesses are canonical naming consistency and some omission of training/evaluation details rather than major factual errors.

### PR #298 [early] (overall: 4.14)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 3/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: Most source techniques were captured, but a few source-listed items are missing or only partially represented, especially some of the phase 1 optimization details and the exact phrasing of several novel techniques.
- [medium] technique_precision: Several extracted entries are paraphrased into generic or ambiguous technique labels (e.g., 'other' descriptions), which makes it harder to verify exact correspondence to the source.
- [medium] method_naming_consistency: Many technique names are verbose descriptions rather than canonical method names, and several entries are not standardized.
- [medium] category_correctness: A number of techniques that could fit existing categories were placed into 'other', reducing category consistency.

**Notes:** The extraction is strong on core architecture and numeric details, including the exact val_bpb and most major techniques. The main weaknesses are overuse of 'other' for novel methods and some loss of canonical naming/structure for the more experimental techniques.

### PR #763 [late] (overall: 4.14)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 3/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: Most source techniques were captured, but some mentioned details were omitted or not explicitly represented, such as U-Net skip connections, LN scaling, min_count=2, and the exact 512-dim / 8/4 GQA architecture specifics.
- [medium] technique_precision: A few extracted items are somewhat interpretive rather than exact source phrases, such as treating 'tied embeddings' as a technique entry and summarizing 'GPTQ-lite int6 + zstd-22' into separate structured fields.
- [medium] method_naming_consistency: Several names are not fully canonical or are verbose variants, e.g. 'tied embeddings' instead of 'weight tying', and 'layerwise LN scale' instead of 'LN Scale'.
- [medium] category_correctness: Some techniques are placed in categories that the audit flags as overlapping or potentially incorrect, especially GPTQ-lite under quantization and layerwise LN scale under regularization; these are acceptable but not fully canonical.

**Notes:** The extraction is strong overall and correctly captures the main result, architecture family, quantization/compression, optimizer, and the multi-order backoff cache. The main weaknesses are naming standardization and some category ambiguity around overlapping techniques. No major hallucinations are present.

### PR #170 [early] (overall: 4.29)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: The extraction missed some source details such as the 9L/512dim/8H/4KV architecture from the PR body and the explicit fp16 late-K passthrough wording; it also did not capture the 21.8M parameter count from the PR body.
- [low] technique_precision: Most extracted techniques are supported by the source, but 'architecture': 'Transformer' is somewhat underspecified relative to the richer architecture descriptions in the source.
- [medium] method_naming_consistency: Several names are descriptive rather than canonical, especially 'tied embeddings' instead of the canonical 'weight tying'.
- [low] category_correctness: Weight tying is placed under architecture_modification rather than a more appropriate canonical technique label; weight decay is split across optimizer_technique and regularization, creating mild category overlap.

**Notes:** The extraction is generally strong: it captures the main record value, the core techniques, and the artifact size correctly. The main weaknesses are naming standardization and some loss of source-specific architectural detail. Since this is an early-period PR, the vocabulary currency is excellent.

### PR #229 [early] (overall: 4.29)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: The extraction captures most major techniques, but it misses some descriptive implementation details such as the explicit 8xH100 training setup and the exact 'matrix_lr/scalar_lr tuning' phrasing.
- [low] technique_precision: Most extracted techniques are supported by the source, but 'LoRA TTT' is slightly simplified from the source's 'dynamically updated LoRA adapters on the validation stream.'
- [medium] method_naming_consistency: Several technique names are verbose or descriptive rather than canonical, especially 'Overtone spectrum initialization' and 'Sigmoid-scheduled phase-transition residual mixing strategy.'
- [low] category_correctness: The 'test_time_training' and 'initialization' categories are mostly appropriate, but some entries are phrased in a way that could fit multiple categories, and 'other' is used for a technique that might merit a more specific category.

**Notes:** The extraction is generally strong and faithful to the submission. The main weaknesses are mild over-verbosity in technique naming and a few missed operational details, but there are no clear hallucinations. Since the PR is early-period, vocabulary currency is excellent.

### PR #479 [middle] (overall: 4.29)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: Most major techniques were captured, but some training details from the source were omitted, such as grad_clip=0.3 and the exact seq_len/batch configuration.
- [low] technique_precision: A few extracted items are somewhat interpretive rather than exact source phrasing, such as describing 'QAT during training to eliminate quantization gap at inference' as a separate 'other' technique.
- [medium] method_naming_consistency: Several method names are verbose or non-canonical relative to the audit guidance, e.g. 'tied embeddings' instead of canonical 'weight tying', and 'sliding window eval' instead of a more standardized technique label.
- [low] category_correctness: Some techniques are placed in overlapping or debatable categories, especially 'weight tying' as architecture_modification and 'OrthoInit' as initialization rather than architecture-related context.

**Notes:** The extraction is strong overall: it correctly identifies the main contributions (QAT, SwiGLU, mixed int5/int6, BigramHash, SmearGate, GQA, OrthoInit, Muon, SWA). The architecture field is clean and the null val_bpb is appropriate because the source only says TBD. The main weaknesses are minor omissions and some non-canonical naming/category choices.

### PR #439 [middle] (overall: 4.29)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 4/5
- Architecture Appropriateness: 4/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: Most major techniques were captured, but the extraction omits some source details such as the 2-block causal local window and the explicit Lean 4 proof artifact names/titles as techniques.
- [low] method_naming_consistency: Some entries are verbose/descriptive rather than canonical method names, especially the 'other' items for the governor and GC guard.
- [low] architecture_appropriateness: The architecture field is reasonably clean ('GPT') but loses important architectural context present in the source, such as 12-layer GPT with 512d, 8H/4KV, GQA, RoPE, BigramHash, and SmearGate.
- [low] category_correctness: The Lyapunov governor and Chebyshev GC guard are placed in 'other' instead of a more specific technique category, reflecting mild overuse of the catch-all bucket.

**Notes:** The extraction is strong overall: it correctly identifies the main architecture changes, optimizer, quantization, and training techniques. val_bpb is correctly null because the source explicitly says validation is pending. The main weaknesses are mild under-specification and some reliance on 'other' for specialized components.

### PR #333 [middle] (overall: 4.29)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: A few source techniques were not clearly captured, notably the explicit fp32 accumulation detail for SWA and the GQA-compatible repeat_interleave implementation detail for XSA.
- [low] technique_precision: Some extracted entries are slightly interpretive rather than exact source phrasing, such as 'tied embeddings' instead of canonical 'weight tying' and the broad description of phase-transition residual mixing.
- [medium] method_naming_consistency: Several names are non-canonical or verbose, including 'tied embeddings' instead of 'weight tying', 'Orthogonal initialization' instead of 'OrthoInit', and 'MLP3x' for a 2.75x expansion.
- [low] category_correctness: Most techniques are categorized correctly, but there is some overlap/duplication such as weight decay appearing both under Muon and as a separate regularization entry, and SWA-related details being split across categories.

**Notes:** The extraction is strong overall: the main metrics, core architecture, quantization/compression, optimizer, and major techniques are captured well. The architecture field is clean and the extracted val_bpb matches exactly. The main weaknesses are naming standardization and a few omitted implementation-level details rather than major factual errors.

### PR #757 [late] (overall: 4.29)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 4/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 4/5

**Issues:**
- [medium] technique_completeness: The extraction captures most major techniques, but misses some source details such as Muon + AdamW as a combined training setup, Flash Attention v3, and the explicit score-first protocol / 8xH100 training context as techniques or relevant methods.
- [low] technique_precision: Most extracted techniques are grounded in the source, but some entries are slightly over-interpreted or generalized, such as 'Transformer' as architecture and 'score-first full TTT' as a method label.
- [low] method_naming_consistency: Several names are descriptive rather than canonical, e.g. 'score-first full TTT', 'sliding window eval', and 'Int6 STE QAT', though they are understandable.
- [low] category_correctness: A few items are arguably placed in suboptimal categories, especially EMA under weight_averaging (acceptable but cross-category overlap exists) and zstd appearing both as compression and quantization-related context.
- [low] vocabulary_currency: The extraction handles late-period terminology reasonably well, but does not explicitly surface some newer or more specific competition vocabulary present in the source, such as Flash Attention v3 and Muon + AdamW.

**Notes:** The extracted JSON is strong overall: it correctly identifies the record score, core TTT setup, quantization/compression, and most architecture components. The main weaknesses are mild under-completeness and some normalization/categorization issues rather than major factual errors.

### PR #754 [late] (overall: 4.29)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: Most major techniques were captured, but some source details were omitted or only partially represented, such as Flash Attention 3, torch.compile(fullgraph=True), no DDP/manual gradient sync, and the exact 3-phase optimizer flow.
- [medium] technique_precision: A few extracted items are slightly over-interpreted or generalized, such as treating 'GPTQ-lite int6 QAT' as a single quantization method and describing 'tied embeddings' instead of the canonical 'weight tying'.
- [medium] method_naming_consistency: Several names are verbose or non-canonical relative to the audit guidance, including 'tied embeddings' instead of 'weight tying' and descriptive labels like 'weight decay' rather than a standardized technique name.
- [low] category_correctness: Most techniques are categorized correctly, but there is some overlap/duplication between quantization and training-related entries (e.g., GPTQ-lite and STE QAT), and some methods could arguably be placed in more canonical categories.

**Notes:** The extraction is strong overall: the key record metric, core optimizer, major architecture additions, quantization, and TTT recipe are all present. The main weaknesses are incomplete capture of some implementation/training details and slightly non-canonical naming. The architecture field is appropriately clean.

### PR #716 [late] (overall: 4.29)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: The extraction captures the main techniques, but misses some source details such as quarter batch sizing / TRAIN_BATCH_TOKENS=131072 as a distinct technique and the explicit 29-experiment search loop.
- [medium] method_naming_consistency: Several names are descriptive rather than canonical, e.g. 'tied embeddings' instead of 'weight tying', and 'LeakyReLU2' instead of the more standardized late-period variant naming like 'LeakyReLU²' or 'LeakyReLU(0.5)²'.
- [low] category_correctness: Most categories are correct, but 'tied embeddings' is placed under architecture_modification rather than a more canonical weight-tying/regularization-style category, and 'other' is used for torch.compile/hardware details instead of a more specific optimization/runtime category.

**Notes:** The key metric and core techniques are extracted well. The architecture field is clean and the val_bpb matches exactly. Main weaknesses are naming standardization and a small amount of under-capture of search/process details rather than substantive factual errors.

### PR #233 [early] (overall: 4.43)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 5/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: The extraction captures the main sliding-window evaluation idea and related GPT.forward_logits change, but it omits some potentially relevant implementation detail such as the EVAL_BATCH_SEQS setting.
- [medium] method_naming_consistency: The technique description uses a verbose free-form phrase ('sliding window eval') and an 'other' entry instead of a more standardized technique label.
- [low] category_correctness: GPT.forward_logits is placed in 'other', even though it is part of the evaluation/scoring mechanism and could arguably be categorized more specifically.

**Notes:** The extraction is strong overall: no val_bpb is mentioned in the source, so null is correct; no architecture is mentioned, so null is also correct. The main weakness is slight under-specification of the evaluation-related implementation details and the use of a generic 'other' bucket.

### PR #150 [early] (overall: 4.43)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 5/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: The extraction captures most techniques, but misses the explicit '11 transformer layers' / '11L' architecture detail as a technique-like contribution and does not separately capture 'seed 1337' or 'sliding window stride=64' as distinct result/config items beyond the eval technique.
- [medium] method_naming_consistency: Several entries are verbose or non-canonical relative to the audit vocabulary, such as 'STE QAT' instead of the more exact 'STE int6 QAT', 'tied embeddings' instead of canonical 'weight tying', and 'full TTT' instead of a cleaner canonical technique name.
- [low] category_correctness: Most categories are correct, but 'tied embeddings' is placed under architecture_modification rather than the canonical weight-tying concept, and some items are somewhat overlapping between architecture and technique categories.

**Notes:** The extracted JSON is strong overall: it correctly captures the main score, optimizer, compression, evaluation, TTT, SWA, NTK-RoPE, BigramHash, SmearGate, and OrthoInit. The main weaknesses are minor naming normalization issues and a small completeness gap around explicit configuration/result details.

### PR #92 [early] (overall: 4.43)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 4/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: The extraction captures the main techniques, but omits some source details such as the 8-layer model being part of the approach and the explicit TRAIN_SEQ_LEN=4096 configuration in the novel_contributions list.
- [low] technique_precision: The quantization entry is slightly imprecise: the source describes selective quantization as INT6 weights plus INT8 embeddings with zlib, while the extracted summary compresses this into a broader mixed int6/int8 formulation.
- [low] method_naming_consistency: Some names are descriptive rather than canonical, such as 'sliding window eval' and 'mixed int6/int8 selective quantization', though they remain understandable.
- [low] category_correctness: The tokenizer is placed under 'other' rather than a more specific technique category, which is acceptable but not ideal given the structured extraction goal.

**Notes:** The extraction is strong overall. The key metric, architecture, optimizer, evaluation method, and quantization/compression details are all captured correctly. The main weaknesses are mild normalization issues and slight incompleteness around configuration details.

### PR #735 [late] (overall: 4.43)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 5/5
- Method Naming Consistency: 3/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: The extraction captured the main PR changes, but it did not explicitly separate every listed item as a distinct technique/contribution (e.g., SDPA fallback, NO_COMPILE, single-GPU mode, NCCL->GLOO fallback, and rocm-smi fallback are bundled together).
- [medium] method_naming_consistency: Several entries are verbose descriptive phrases rather than canonical method names, especially the ROCm support bundle and the auxiliary load balancing / unbank-rebank items.
- [low] category_correctness: Multiple implementation/support changes were placed in 'other' instead of more specific categories, reducing categorical precision.

**Notes:** No bpb value is mentioned in the source, so null is correct. The extraction is largely faithful and captures the late-period Micro-MoE terminology well. The main weakness is stylistic/categorical: several distinct changes are grouped into broad 'other' descriptions rather than normalized technique entries.

### PR #647 [late] (overall: 4.43)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 5/5
- Architecture Appropriateness: 5/5
- Category Correctness: 3/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: The extraction captures the main process-level contributions, but it omits some explicit items from the PR body such as live dry-run validation through gpt-5.4 and the rollback/active-base recovery emphasis as separate techniques/contributions.
- [medium] category_correctness: All extracted items are placed under 'other', which is acceptable for an infrastructure/research submission but still reflects weak category specificity and overuse of the fallback category.

**Notes:** No bpb value is mentioned in the source, so null is correct. The extraction is largely faithful and uses reasonable canonical wording, but it is more of a summary of the PR than a structured decomposition into technique categories.

### PR #768 [late] (overall: 4.43)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 4/5
- Method Naming Consistency: 4/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [medium] technique_completeness: The extraction captures most major techniques, but it misses some source details such as Parameter Banking, Legal TTT as a named technique, and the explicit learned projection/per-layer scales implementation detail.
- [low] technique_precision: Some entries are slightly over-interpreted or duplicated in spirit, such as splitting the shared ValueEmbedding idea into two separate architecture_modification items.
- [low] method_naming_consistency: Most names are reasonable, but 'score-first TTT' is a paraphrase rather than the more canonical 'Legal TTT', and 'Tight SWA' is embedded as a type rather than a standardized method label.
- [low] category_correctness: A few techniques could be categorized more cleanly: weight tying is an architecture modification, but EMA and SWA are better treated as weight_averaging only; the current split is acceptable but slightly redundant.

**Notes:** The extraction is strong overall: the main contribution, key metrics, and most supporting techniques are correctly captured. The architecture field is clean, the bpb value is exact, and the output reflects late-period terminology such as Parallel Muon and GPTQ-lite. The main weakness is incomplete capture of some named techniques and implementation details, plus mild redundancy in how the shared ValueEmbedding change is represented.

### PR #490 [middle] (overall: 4.57)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 5/5
- Technique Precision: 4/5
- Method Naming Consistency: 4/5
- Architecture Appropriateness: 5/5
- Category Correctness: 4/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_precision: The extracted 'evaluation_technique' entry for stride-based eval is plausible but not explicitly framed as a named technique in the source; it is more of a config detail.
- [low] method_naming_consistency: Some technique names are verbose rather than canonical, e.g. 'score-first TTT' instead of a more standardized 'legal score-first TTT' or a canonical TTT label.
- [low] category_correctness: EMA and cosine decay are reasonable extractions, but they are configuration/training details rather than core techniques; category placement is acceptable but slightly debatable.

**Notes:** The extraction is strong overall: it captures the main architecture changes, legal score-first TTT, and the pending val_bpb status correctly. Architecture is appropriately simplified to 'Transformer'. The only minor concern is that some extracted items are more hyperparameter/configuration details than competition techniques.

### PR #523 [middle] (overall: 4.71)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 4/5
- Technique Precision: 5/5
- Method Naming Consistency: 4/5
- Architecture Appropriateness: 5/5
- Category Correctness: 5/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] technique_completeness: The extraction captures the main architecture change, but omits some mentioned implementation/context details such as the learned recurrence gate being mixed through sigmoid as a distinct technique detail, and the unchanged tokenizer/dataset/export path framing as part of the method description.
- [low] method_naming_consistency: The technique is described in a verbose, source-like form ('depth recurrence', 'learned recurrence gates') rather than a more standardized canonical method label.

**Notes:** The extraction is strong overall. val_bpb matches exactly, the architecture field is appropriately generic, and no clear hallucinations are present. The main weakness is slight incompleteness in technique-level detail and some non-canonical phrasing.

### PR #491 [middle] (overall: 4.86)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 5/5
- Technique Precision: 5/5
- Method Naming Consistency: 4/5
- Architecture Appropriateness: 5/5
- Category Correctness: 5/5
- Vocabulary Currency: 5/5

**Issues:**
- [low] method_naming_consistency: Most names are well standardized, but 'score-first TTT' is a descriptive label rather than a canonical method name; 'Test-Time Training' would be cleaner.

**Notes:** Extraction is highly faithful overall. It correctly captures the three main additions, inherited architecture details, and evaluation/training specifics. The null val_bpb is appropriate because the source only says TBD. Minor naming verbosity is the only notable issue.

### PR #165 [early] (overall: 5.0)

- Val Bpb Accuracy: 5/5
- Technique Completeness: 5/5
- Technique Precision: 5/5
- Method Naming Consistency: 5/5
- Architecture Appropriateness: 5/5
- Category Correctness: 5/5
- Vocabulary Currency: 5/5

**Notes:** The source text contains no bpb value and no explicit model techniques or architecture details. The extraction correctly leaves those fields null/empty and only captures the clearly supported contextual note about logs.md.

## Recommendations

Based on the evaluation results above, consider updating the parse prompt to address:

1. **Method Naming Consistency** (mean: 3.42/5) — lowest scoring dimension
2. **Category Correctness** (mean: 3.83/5) — lowest scoring dimension
3. **Technique Completeness** (mean: 4.12/5) — lowest scoring dimension
