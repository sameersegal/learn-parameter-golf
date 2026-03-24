# Plan: Parameter Golf Visualization SPA

## Context
We have 42 parsed PR JSON files from `openai/parameter-golf` with structured technique data. Goal: build a static Next.js SPA to visualize techniques, browse submissions, and ask LLM questions — all client-side, no backend.

## Stack
- **Next.js 14+** (App Router, `output: 'export'` for static build)
- **TypeScript**, **Tailwind CSS**
- **Recharts** for charts
- **Direct `fetch`** to OpenAI API from browser (user's own API key, stored in localStorage)

## Project Structure
```
web/                              # Next.js app (new directory)
  next.config.ts                  # output: 'export'
  package.json
  tailwind.config.ts
  src/
    app/
      layout.tsx                  # Root layout + nav
      page.tsx                    # Dashboard
      techniques/page.tsx         # Technique explorer
      pr/[id]/page.tsx            # PR detail
      chat/page.tsx               # LLM Q&A
      globals.css
    components/
      Nav.tsx                     # Navigation bar
      Leaderboard.tsx             # Sortable table
      StatsCards.tsx              # Summary stats
      BpbChart.tsx                # val_bpb scatter chart
      TechFreqChart.tsx           # Technique frequency bar chart
      TechniqueDetail.tsx         # Technique card
      PrCard.tsx                  # Compact PR card
      ChatPanel.tsx               # Chat messages + input
      ApiKeyInput.tsx             # API key entry (localStorage)
    lib/
      data.ts                     # Types + data import
      openai.ts                   # Browser-side fetch to OpenAI
      techniques.ts               # Aggregation helpers
    data/
      submissions.json            # Merged 42 parsed JSONs (build-time generated)
scripts/
  bundle-data.js                  # Merges data/parsed/*.json → web/src/data/submissions.json
```

## Data Loading
- `scripts/bundle-data.js` reads all `data/parsed/*.json`, merges into a single array, writes to `web/src/data/submissions.json`
- App imports it statically: `import submissions from '../data/submissions.json'`
- ~150-200KB, trivially small — no lazy loading needed
- `package.json` `prebuild` script runs the bundler automatically

## Pages

### 1. Dashboard (`/`)
- **Stats cards**: Total PRs, records count, best val_bpb, unique authors
- **Leaderboard table**: Sortable by val_bpb/PR#/author. Click → PR detail. Filter: records only / all. Exclude null bpb and outliers (>2.0)
- **val_bpb scatter chart**: X=PR number, Y=val_bpb. Gold dots for records. Click → PR detail
- **Technique frequency bar chart**: Horizontal bars per category. Click → technique explorer

### 2. Technique Explorer (`/techniques`)
- **Category tabs/sidebar**: 12 categories with instance counts
- **Method grouping**: Within selected category, group by `data.component` or `data.method`. Show count per method
- **PR list per method**: Compact cards showing which PRs use each technique variant
- **URL param**: `/techniques?category=quantization` for deep-linking

### 3. PR Detail (`/pr/[id]`)
- Header: PR#, title, author, status/record badges
- Key metrics row: val_bpb, architecture, optimizer, quantization, artifact_size
- Training techniques: Expandable cards grouped by category, showing all `data` fields
- Novel contributions: Bulleted list
- Prev/Next PR navigation
- Uses `generateStaticParams()` to pre-render all 42 pages

### 4. Chat (`/chat`)
- **API key bar**: Input field, saved to localStorage. Warning that key is used browser-side
- **Chat area**: Scrollable messages with markdown rendering
- **Starter questions**: "What techniques do record PRs share?", "Compare PR #628 and #620", "What's the trend in val_bpb?"
- **Implementation**: Direct `fetch` to `https://api.openai.com/v1/chat/completions`, model `gpt-4o-mini`, system prompt contains full submissions JSON (~40K tokens input, ~$0.006/message)

## LLM Integration (`lib/openai.ts`)
- Direct `fetch` (not the `openai` npm package — avoids bundle bloat and Node polyfill issues)
- System prompt: competition context + full submissions JSON (same pattern as `agent.py`)
- Streaming via `ReadableStream` for token-by-token display
- API key from localStorage, never persisted elsewhere

## Implementation Order
1. **Scaffold**: `create-next-app`, bundle script, types, static export config
2. **Dashboard**: Stats cards, leaderboard, charts
3. **PR Detail**: Full submission view with technique cards
4. **Technique Explorer**: Category tabs, method grouping, PR lists
5. **Chat**: API key input, chat panel, OpenAI integration
6. **Polish**: Dark mode, error states, responsive tweaks

## .gitignore additions
```
web/node_modules/
web/.next/
web/out/
```
Note: `web/src/data/submissions.json` SHOULD be committed (build artifact that enables the static site).

## Verification
```bash
cd web
npm install
npm run build          # runs bundle-data.js then next build
npx serve out          # serve the static export locally
```
