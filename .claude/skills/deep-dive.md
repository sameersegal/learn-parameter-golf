---
name: deep-dive
description: "Write a deep dive article for the Parameter Golf site. Accepts an optional topic argument (e.g., /deep-dive compression). Orchestrates the deep-dive-writer and interactive-widget-animator agents, updates the registry, and verifies the build."
user_invocable: true
---

# Deep Dive Article Workflow

You are orchestrating the full deep-dive article creation pipeline for the Parameter Golf learning site.

**Topic**: $ARGUMENTS (if empty, check `web/src/content/deep-dives/registry.ts` for stub articles with `sections: []` and pick the next one by order number)

## Step 1: Research & Write the Article

Launch the **deep-dive-writer** agent (subagent_type: "deep-dive-writer") with a prompt that includes:
- The topic to write about
- Instruction to read `data/parsed/*.json` for real submission data
- Instruction to read `.claude/agent-memory/deep-dive-writer/MEMORY.md` for conventions and prior context
- Instruction to create the article as a TypeScript file in `web/src/content/deep-dives/<slug>.ts`
- Reminder about ContentRenderer limitations: no LaTeX, no blockquotes, no numbered lists, no links, no images
- Instruction to define `[INTERACTIVE: component-name]` specs for any animations needed

Wait for the agent to complete before proceeding.

## Step 2: Build Interactive Animations

After the article is written, check the article file for any `[INTERACTIVE:` markers or animation section references.

For each animation needed, launch the **interactive-widget-animator** agent (subagent_type: "interactive-widget-animator") with:
- The concept being visualized
- The learning goal from the article
- Instruction to create the animation as a React component in `web/src/components/animations/<AnimationName>.tsx`
- Instruction to register it in the AnimationContainer component

Multiple animations can be launched in parallel.

## Step 3: Update the Registry

Update `web/src/content/deep-dives/registry.ts`:
1. Add the import for the new article module
2. Replace the stub entry (if one exists for this topic) with the imported article object
3. If no stub exists, add the new article to the array in the correct order position

## Step 4: Verify the Build

Run these checks sequentially:
1. `cd web && npx tsc --noEmit` — TypeScript type-check to catch errors early
2. `node scripts/bundle-data.js` — Re-bundle parsed data for the web app

If the type-check fails, fix the issues before proceeding.

## Step 5: Update Agent Memory

Update `.claude/agent-memory/deep-dive-writer/MEMORY.md` with:
- The new article slug and order number added to the "Written Articles" list
- Any new data facts discovered during research

## Completion

Summarize what was created:
- Article file path and section count
- Animations created (if any)
- Registry updated
- Build status
