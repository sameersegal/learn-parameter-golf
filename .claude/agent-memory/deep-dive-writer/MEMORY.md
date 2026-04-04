# Deep Dive Writer Agent Memory

## Project Structure
- Deep dive articles live in `web/src/content/deep-dives/*.ts` as TypeScript DeepDive objects
- Registry at `web/src/content/deep-dives/registry.ts` lists all articles
- Interactive animations in `web/src/components/animations/*.tsx`
- Content rendered via `web/src/components/ContentRenderer.tsx` (custom markdown parser)
- Types defined in `web/src/lib/types.ts` (DeepDive, DeepDiveSection types)

## Content Rendering Capabilities (CRITICAL)
- Custom markdown parser, NOT a full markdown library
- **Supports**: bold (**), code (`), ### headers, tables with |, lists with -/*, LaTeX math via KaTeX
- **Math notation**: Use `\\(x^2\\)` for inline math and `$$x^2$$` for display math (rendered by KaTeX)
- **Does NOT support**: links, images, blockquotes (>), numbered lists (1. 2. 3.), nested lists
- Use LaTeX for mathematical formulas: `\\(W_{ij}\\)`, `$$X_{k+1} = \\frac{1}{2} X_k$$`
- Use code formatting for code-like formulas: `shadow = decay * shadow + (1 - decay) * current`

## Data Facts (verified April 2026, 1162 parsed submissions)
- 1162 total parsed, 967 with val_bpb scores
- PR range: #54 to #1114+
- Best overall: PR #721 (~0.000), PR #959 (~0.000), PR #1076 (0.011) -- statistical methods
- Best neural: PR #1056 (0.018 BPB, Muon, SWA+EMA)
- Weight averaging: 623 subs, 749 technique entries; EMA=353, SWA=313
- EMA decay 0.997: 292 of 335 reported (87.2%)
- SWA interval 50: 108 of 131 reported (82.4%)
- Combined EMA+SWA: 181 submissions
- 8/10 top neural submissions use weight averaging
- With WA avg BPB: 1.354 vs without WA: 1.423 (gap=0.068)
- Muon optimizer: 84.6% of submissions specifying optimizer

## Written Articles (as of April 2026)
1. **quantization-fundamentals** (order 1) - 4 sections, no LaTeX
2. **architecture-tricks** (order 2) - 9 sections (text, animation, code), covers BigramHash, SmearGate, U-Net skips, depth recurrence, GQA, Partial RoPE, XSA, LN Scale
3. **optimizers** (order 3) - 10 sections, uses LaTeX math notation (KaTeX)
4. **weight-averaging** (order 4) - 12 sections, rewritten April 2026
5. **compression** (order 5) - 6 sections (text, code), covers zstd/zlib/lzma comparison, pruning for compressibility, weight ordering
6. **test-time-training** (order 6)
7. **learning-rate-schedules** (order 7) - 7 sections (text, animation, code), warmdown focus (3500 steps), cosine decay, WSD, interaction with weight averaging
8. **initialization** (order 8) - 6 sections (text, code), OrthoInit (171 subs), spectral init, resid mix, overtone init
9. **regularization** (order 9) - 7 sections, weight decay (266 subs), LN Scale (189 subs), magnitude pruning (52 subs), gradient clipping, logit softcapping, dual generalization+compressibility role
10. **evaluation-strategies** (order 10)

## Writing Conventions
- Section types: "text", "animation", "code", "computation"
- Code sections are separate from text (type: "code" with language field)
- Animation sections reference animationId mapping to AnimationContainer registry
- Tables use pipe format compatible with custom renderer
- Bold for key terms, code formatting for technical names
- PR references: "PR #NNN"
- Avoid blockquotes (> syntax) even though writing guidelines mention them -- renderer doesn't support them
- Use dashes for lists, not numbers
- Keep template literals clean -- escape backticks with backslash in code examples within template literals
