# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Data pipeline and analysis framework for OpenAI's **Parameter Golf** competition (`openai/parameter-golf`). Scrapes GitHub PRs, uses LLM extraction to parse submission techniques into structured data, and provides interactive Q&A over the results.

## Architecture & Data Flow

```
GitHub API (openai/parameter-golf)
    ↓
scrape.py ──→ data/raw/*.json        (raw PR metadata + README)
    ↓
parse.py  ──→ data/parsed/*.json     (structured technique extraction via gpt-4.1-mini)
    ↓
    ├─→ agent.py       (interactive Q&A REPL over parsed submissions)
    ├─→ build_eval.py  (pairs raw + parsed for human review → eval/eval_set.json)
    └─→ [Planned] web SPA (docs/spa-plan.md)
```

## Commands

```bash
# Setup
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Scrape PRs from GitHub (incremental, skips already-fetched)
python scrape.py --limit 50

# Parse raw PRs into structured JSON (skips already-parsed)
python parse.py -v          # verbose
python parse.py --force     # re-parse all

# Build evaluation dataset
python build_eval.py

# Interactive Q&A agent
python agent.py
```

## Environment Variables

- `GITHUB_TOKEN` — GitHub API authentication (required for scrape.py)
- `OPENAI_API_KEY` — OpenAI API key (required for parse.py and agent.py)

## Key Files

- `prompts/parse_submission.txt` — LLM prompt template for structured extraction; uses `string.Template` substitution with PR fields
- `data/raw/*.json` — One file per PR number with metadata, body, and submission README
- `data/parsed/*.json` — Structured extraction output with techniques, scores, architecture details
- `docs/spa-plan.md` — Architecture plan for a Next.js static web SPA

## Parsing Details

- Uses OpenAI Responses API with `gpt-4.1-mini` at temperature=0
- Extracts 12 technique categories: quantization, architecture_modification, optimizer_technique, weight_averaging, compression, evaluation_technique, test_time_training, initialization, sequence_length, lr_schedule, regularization, other
- Key extracted fields: `val_bpb` (float), `is_record` (bool), `architecture`, `novel_contributions`, `artifact_size`
