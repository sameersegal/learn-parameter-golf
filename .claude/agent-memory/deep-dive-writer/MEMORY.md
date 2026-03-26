# Deep Dive Writer Agent Memory

## Project Structure
- Deep dive articles live in `web/src/content/deep-dives/*.ts` as TypeScript DeepDive objects
- Registry at `web/src/content/deep-dives/registry.ts` lists all articles (3 written, 6 stubs)
- Interactive animations in `web/src/components/animations/*.tsx` (3 exist: QuantizationDemo, SlidingWindowDemo, TTTDemo)
- Content rendered via `web/src/components/ContentRenderer.tsx` (custom markdown parser)
- Types defined in `web/src/lib/types.ts` (DeepDive, DeepDiveSection types)

## Existing Articles (as of March 2026)
1. **quantization-fundamentals** (4 sections) - order 1, category: quantization
2. **test-time-training** (6 sections) - order 6, category: test_time_training
3. **evaluation-strategies** (6 sections) - order 10, category: evaluation_technique

## Stub Articles (empty sections)
- architecture-tricks (order 2), optimizers (order 3), weight-averaging (order 4)
- compression (order 5), learning-rate-schedules (order 7), initialization (order 8), regularization (order 9)

## Data Facts (verified March 2026)
- 615 parsed submissions, 522 with val_bpb scores
- PR range: #54 to #812
- Current best: PR #809 at 0.29519 BPB (N-gram Backoff + TTT)
- PR #620 (referenced as "record" in quantization article) ranks #34 at 0.9443 BPB
- Stride=64 is used 60% of eval technique entries (260/433), NOT 88% as claimed in eval article
- int6 is most common quantization (93), followed by int8 (79), STE QAT (66)
- Score-first TTT (58) and LoRA TTT (56) are roughly equally popular

## Content Rendering Limitations
- ContentRenderer uses custom markdown parser (NOT a full markdown library)
- Supports: **bold**, `code`, ###/## headers, tables with |, lists with -/*, code blocks with ```
- Does NOT support: links, images, blockquotes (>), numbered lists, nested lists
- Section types: "text", "animation", "code", "computation"

## Writing Conventions Observed
- Articles use inline markdown in TypeScript template literals
- Code sections are separate from text (type: "code" with language field)
- Animation sections reference animationId that maps to AnimationContainer registry
- Tables use pipe format compatible with custom renderer
- Bold for key terms (**bold**), code for technical names (`code`)
- PR references use format "PR #NNN"

## Key Accuracy Issues Found
- Quantization article says PR #620 is "current record holder" - it is NOT (ranks #34)
- Eval article claims "stride=64 is used by ~88% of competitive entries" - actual is ~60%
- TTT article says "two highest-scoring confirmed submissions don't use TTT" citing PR #505 (1.1181) and PR #535 (1.1204) - these are far from highest-scoring now
- Competition has evolved massively: best BPB went from ~1.1 to ~0.29 with N-gram techniques
