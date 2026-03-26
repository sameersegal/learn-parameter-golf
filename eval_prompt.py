"""LLM-judge evaluation of prompt extraction quality on a stratified sample of PRs.

Incorporates temporal drift analysis: the sample is stratified by time period
(early/middle/late) so the eval can detect whether newer PRs are parsed worse.
The judge prompt is enriched with audit context (emerging techniques, known
aliases) so it can score vocabulary currency.
"""

import argparse
import json
import logging
import os
import random
import sys
import time
from collections import Counter
from pathlib import Path
from string import Template

from openai import OpenAI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

RAW_DIR = Path("data/raw")
PARSED_DIR = Path("data/parsed")
REPORTS_DIR = Path("reports")
AUDIT_JSON_PATH = REPORTS_DIR / "vocabulary_audit.json"
JUDGE_PROMPT_PATH = Path("prompts/eval_judge.txt")
MODEL = "gpt-5.4-mini"
SAMPLE_SIZE = 24  # divisible by 3 periods × strata

DIMENSIONS = [
    "val_bpb_accuracy",
    "technique_completeness",
    "technique_precision",
    "method_naming_consistency",
    "architecture_appropriateness",
    "category_correctness",
    "vocabulary_currency",
]


def load_judge_template():
    return Template(JUDGE_PROMPT_PATH.read_text(encoding="utf-8"))


def load_audit_context():
    """Load vocabulary audit JSON if available, for enriching the judge prompt."""
    if not AUDIT_JSON_PATH.exists():
        log.warning("No vocabulary audit found at %s — run audit_vocabulary.py first", AUDIT_JSON_PATH)
        return None
    return json.loads(AUDIT_JSON_PATH.read_text(encoding="utf-8"))


def load_all_submissions():
    """Load all raw + parsed PR pairs, with period labels based on PR number terciles."""
    pairs = []
    for parsed_file in sorted(PARSED_DIR.glob("*.json"), key=lambda f: int(f.stem)):
        pr_number = int(parsed_file.stem)
        raw_file = RAW_DIR / f"{pr_number}.json"
        if not raw_file.exists():
            continue
        raw = json.loads(raw_file.read_text(encoding="utf-8"))
        parsed = json.loads(parsed_file.read_text(encoding="utf-8"))
        pairs.append({"pr_number": pr_number, "raw": raw, "parsed": parsed})

    # Assign period labels by PR number tercile (already sorted)
    n = len(pairs)
    for i, p in enumerate(pairs):
        if i < n // 3:
            p["period"] = "early"
        elif i < 2 * n // 3:
            p["period"] = "middle"
        else:
            p["period"] = "late"

    return pairs


def select_stratified_sample(pairs, n=SAMPLE_SIZE):
    """Select a stratified sample balanced across time periods and characteristics.

    Allocates n/3 slots per period (early/middle/late). Within each period,
    picks a mix of records, null-bpb, high-technique, and low-technique PRs.
    """
    random.seed(42)

    by_period = {"early": [], "middle": [], "late": []}
    for p in pairs:
        period = p.get("period", "unknown")
        if period in by_period:
            by_period[period].append(p)

    selected = set()
    sample = []
    per_period = max(n // 3, 1)

    def add_from(pool, count):
        added = 0
        shuffled = list(pool)
        random.shuffle(shuffled)
        for p in shuffled:
            if p["pr_number"] not in selected and added < count:
                sample.append(p)
                selected.add(p["pr_number"])
                added += 1

    for period_name in ["early", "middle", "late"]:
        pool = by_period[period_name]
        records = [p for p in pool if p["parsed"].get("is_record")]
        null_bpb = [p for p in pool if p["parsed"].get("val_bpb") is None]
        high_tech = sorted(pool, key=lambda p: len(p["parsed"].get("training_techniques", [])), reverse=True)
        low_tech = sorted(pool, key=lambda p: len(p["parsed"].get("training_techniques", [])))

        # 2 records, 2 null-bpb, 1 high-tech, 1 low-tech, fill rest randomly
        add_from(records, 2)
        add_from(null_bpb, 2)
        add_from(high_tech[:10], 1)
        add_from(low_tech[:10], 1)
        remaining = per_period - sum(1 for p in sample if p.get("period") == period_name)
        add_from(pool, remaining)

    return sample[:n]


def build_audit_summary(audit):
    """Build a concise audit context string for the judge prompt."""
    if not audit:
        return "(no audit data available)"

    parts = []

    # Emerging techniques
    drift = audit.get("temporal_drift", {})
    emerging = drift.get("emerging_techniques", {})
    if emerging:
        top = list(emerging.items())[:15]
        parts.append("EMERGING TECHNIQUES (appeared only in late-period PRs, prompt may miss these):")
        for tech, count in top:
            parts.append(f"  - {tech} ({count} uses)")

    # Known normalization aliases
    clusters = audit.get("method_clusters", {})
    if clusters:
        parts.append("\nKNOWN METHOD NAME VARIANTS (should use canonical form):")
        for canon, info in list(clusters.items())[:10]:
            variants = [f'"{v}"' for v in info["variants"] if v != canon]
            if variants:
                parts.append(f"  - Canonical: \"{canon}\" — variants: {', '.join(variants)}")

    # Cross-category overlaps
    overlaps = audit.get("cross_category_overlaps", {})
    if overlaps:
        parts.append("\nCROSS-CATEGORY ISSUES (techniques appearing in wrong categories):")
        for method, info in list(overlaps.items())[:8]:
            parts.append(f"  - \"{method}\" found in: {', '.join(info['categories'])}")

    # Other reclassification patterns
    other = audit.get("other_reclassification", {})
    if other.get("reclassifiable"):
        parts.append(f"\nOVERUSE OF 'other' CATEGORY: {other['total_other']} total, {len(other['reclassifiable'])} should be reclassified")

    return "\n".join(parts)


def judge_pr(client, template, pair, audit_summary=""):
    """Send a single PR to the LLM judge for evaluation."""
    pr_number = pair["pr_number"]
    raw = pair["raw"]
    parsed = pair["parsed"]
    period = pair.get("period", "unknown")

    prompt = template.safe_substitute(
        body=raw.get("body") or "(empty)",
        readme=raw.get("submission_readme") or "(no submission README found)",
        parsed_json=json.dumps(parsed, indent=2),
        time_period=period,
        audit_context=audit_summary,
    )

    log.debug("PR #%d judge prompt: %d chars", pr_number, len(prompt))

    t0 = time.time()
    response = client.responses.create(
        model=MODEL,
        input=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    elapsed = time.time() - t0

    text = response.output_text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    result = json.loads(text)
    overall = result.get("overall_score", 0)
    log.info("PR #%d judged  %.1fs  overall=%.1f", pr_number, elapsed, overall)
    return result


def _dim_stats(cards, dimensions):
    """Compute per-dimension stats for a list of scorecards."""
    dim_scores = {d: [] for d in dimensions}
    for card in cards:
        scores = card.get("judgment", {}).get("scores", {})
        for d in dimensions:
            if d in scores:
                dim_scores[d].append(scores[d])
    result = {}
    for d in dimensions:
        vals = dim_scores[d]
        if vals:
            result[d] = {
                "mean": round(sum(vals) / len(vals), 2),
                "min": min(vals),
                "max": max(vals),
                "count": len(vals),
            }
    return result


def compute_aggregates(scorecards):
    """Compute aggregate statistics across all scorecards, including per-period breakdowns."""
    all_issues = []
    all_missed = []
    all_hallucinated = []

    for card in scorecards:
        all_issues.extend(card.get("judgment", {}).get("issues", []))
        all_missed.extend(card.get("judgment", {}).get("missed_techniques", []))
        all_hallucinated.extend(card.get("judgment", {}).get("hallucinated_techniques", []))

    aggregates = _dim_stats(scorecards, DIMENSIONS)

    # Per-period breakdowns
    period_stats = {}
    for period in ["early", "middle", "late"]:
        period_cards = [c for c in scorecards if c.get("period") == period]
        if period_cards:
            pstats = _dim_stats(period_cards, DIMENSIONS)
            period_stats[period] = {
                "count": len(period_cards),
                "dimension_stats": pstats,
                "overall_mean": round(
                    sum(s["mean"] for s in pstats.values()) / len(pstats), 2
                ) if pstats else 0,
            }

    # Count issue patterns by dimension and severity
    issue_patterns = {}
    for issue in all_issues:
        key = f"{issue.get('dimension', 'unknown')}|{issue.get('severity', 'unknown')}"
        if key not in issue_patterns:
            issue_patterns[key] = {"count": 0, "examples": []}
        issue_patterns[key]["count"] += 1
        if len(issue_patterns[key]["examples"]) < 3:
            issue_patterns[key]["examples"].append(issue.get("description", ""))

    return {
        "dimension_stats": aggregates,
        "overall_mean": round(
            sum(a["mean"] for a in aggregates.values()) / len(aggregates), 2
        ) if aggregates else 0,
        "period_stats": period_stats,
        "issue_patterns": issue_patterns,
        "total_missed_techniques": len(all_missed),
        "total_hallucinated_techniques": len(all_hallucinated),
        "common_missed": dict(Counter(all_missed).most_common(10)),
        "common_hallucinated": dict(Counter(all_hallucinated).most_common(10)),
    }


def generate_markdown(scorecards, aggregates):
    """Generate a narrative markdown report."""
    lines = ["# Prompt Evaluation Report\n"]

    lines.append(f"**Sample size**: {len(scorecards)} PRs\n")
    lines.append(f"**Overall mean score**: {aggregates['overall_mean']}/5.0\n")

    # Period distribution
    period_counts = Counter(c.get("period", "?") for c in scorecards)
    lines.append(f"**Period distribution**: {dict(period_counts)}\n")

    # Dimension summary table
    lines.append("## Dimension Scores (Overall)\n")
    lines.append("| Dimension | Mean | Min | Max |")
    lines.append("|-----------|------|-----|-----|")
    for d in DIMENSIONS:
        stats = aggregates["dimension_stats"].get(d, {})
        lines.append(f"| {d.replace('_', ' ').title()} | {stats.get('mean', '-')} | {stats.get('min', '-')} | {stats.get('max', '-')} |")
    lines.append("")

    # Per-period comparison — the key temporal drift table
    period_stats = aggregates.get("period_stats", {})
    if period_stats:
        lines.append("## Scores by Time Period (Temporal Drift)\n")
        lines.append("Does the prompt perform worse on newer PRs?\n")
        header = "| Dimension | Early | Middle | Late |"
        sep = "|-----------|-------|--------|------|"
        lines.append(header)
        lines.append(sep)
        for d in DIMENSIONS:
            vals = []
            for period in ["early", "middle", "late"]:
                ps = period_stats.get(period, {}).get("dimension_stats", {}).get(d, {})
                vals.append(str(ps.get("mean", "-")))
            lines.append(f"| {d.replace('_', ' ').title()} | {' | '.join(vals)} |")

        # Overall by period
        vals = [str(period_stats.get(p, {}).get("overall_mean", "-")) for p in ["early", "middle", "late"]]
        lines.append(f"| **Overall** | {' | '.join(vals)} |")
        lines.append("")

        # Flag degradation
        for d in DIMENSIONS:
            early_mean = period_stats.get("early", {}).get("dimension_stats", {}).get(d, {}).get("mean")
            late_mean = period_stats.get("late", {}).get("dimension_stats", {}).get(d, {}).get("mean")
            if early_mean and late_mean and early_mean - late_mean >= 0.5:
                lines.append(f"- **{d.replace('_', ' ').title()}** degraded by {round(early_mean - late_mean, 2)} points (early→late)")
        lines.append("")

    # Issue patterns
    if aggregates["issue_patterns"]:
        lines.append("## Systematic Issues\n")
        for key, info in sorted(aggregates["issue_patterns"].items(), key=lambda x: -x[1]["count"]):
            dim, severity = key.split("|")
            lines.append(f"### {dim} ({severity}) — {info['count']} occurrences\n")
            for ex in info["examples"]:
                lines.append(f"- {ex}")
            lines.append("")

    # Missed / hallucinated
    if aggregates["common_missed"]:
        lines.append("## Most Commonly Missed Techniques\n")
        for tech, count in aggregates["common_missed"].items():
            lines.append(f"- **{tech}** ({count} times)")
        lines.append("")

    if aggregates["common_hallucinated"]:
        lines.append("## Most Commonly Hallucinated Techniques\n")
        for tech, count in aggregates["common_hallucinated"].items():
            lines.append(f"- **{tech}** ({count} times)")
        lines.append("")

    # Per-PR scorecards
    lines.append("## Per-PR Scorecards\n")
    for card in sorted(scorecards, key=lambda c: c.get("judgment", {}).get("overall_score", 0)):
        pr = card["pr_number"]
        period = card.get("period", "?")
        j = card.get("judgment", {})
        scores = j.get("scores", {})
        overall = j.get("overall_score", "?")
        lines.append(f"### PR #{pr} [{period}] (overall: {overall})\n")
        for d in DIMENSIONS:
            lines.append(f"- {d.replace('_', ' ').title()}: {scores.get(d, '?')}/5")
        issues = j.get("issues", [])
        if issues:
            lines.append("\n**Issues:**")
            for issue in issues:
                lines.append(f"- [{issue.get('severity', '?')}] {issue.get('dimension', '?')}: {issue.get('description', '')}")
        notes = j.get("notes", "")
        if notes:
            lines.append(f"\n**Notes:** {notes}")
        lines.append("")

    # Recommendations
    lines.append("## Recommendations\n")
    lines.append("Based on the evaluation results above, consider updating the parse prompt to address:")
    lines.append("")

    weakest = sorted(aggregates["dimension_stats"].items(), key=lambda x: x[1]["mean"])
    for i, (d, stats) in enumerate(weakest[:3], 1):
        lines.append(f"{i}. **{d.replace('_', ' ').title()}** (mean: {stats['mean']}/5) — lowest scoring dimension")

    # Temporal-specific recommendations
    if period_stats:
        early_overall = period_stats.get("early", {}).get("overall_mean", 0)
        late_overall = period_stats.get("late", {}).get("overall_mean", 0)
        if early_overall and late_overall and early_overall - late_overall >= 0.3:
            lines.append(f"\n**Temporal degradation detected**: late-period PRs score {round(early_overall - late_overall, 2)} "
                         f"points lower than early ({late_overall} vs {early_overall}). "
                         f"The prompt vocabulary needs updating for emerging techniques.")
    lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Evaluate prompt extraction quality using LLM judge")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    parser.add_argument("--sample-size", "-n", type=int, default=SAMPLE_SIZE, help="Number of PRs to evaluate")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if not os.environ.get("OPENAI_API_KEY"):
        log.warning("OPENAI_API_KEY not set — cannot run evaluation")
        sys.exit(1)

    pairs = load_all_submissions()
    log.info("Loaded %d raw+parsed pairs", len(pairs))

    # Load audit context for enriching the judge prompt
    audit = load_audit_context()
    audit_summary = build_audit_summary(audit)

    sample = select_stratified_sample(pairs, n=args.sample_size)
    log.info("Selected %d PRs for evaluation", len(sample))
    period_dist = Counter(p.get("period", "?") for p in sample)
    log.info("Period distribution: %s", dict(period_dist))
    log.info("Sample PRs: %s", [p["pr_number"] for p in sample])

    client = OpenAI()
    template = load_judge_template()

    scorecards = []
    error_count = 0
    t_start = time.time()

    for i, pair in enumerate(sample, 1):
        pr_number = pair["pr_number"]
        period = pair.get("period", "unknown")
        log.info("[%d/%d] Judging PR #%d [%s]", i, len(sample), pr_number, period)
        try:
            judgment = judge_pr(client, template, pair, audit_summary=audit_summary)
            scorecards.append({
                "pr_number": pr_number,
                "period": period,
                "title": pair["parsed"].get("title", ""),
                "is_record": pair["parsed"].get("is_record", False),
                "val_bpb": pair["parsed"].get("val_bpb"),
                "technique_count": len(pair["parsed"].get("training_techniques", [])),
                "judgment": judgment,
            })
        except Exception as e:
            error_count += 1
            log.error("PR #%d judge FAILED: %s", pr_number, e)

    elapsed = time.time() - t_start
    log.info("Done! %d judged, %d errors in %.1fs", len(scorecards), error_count, elapsed)

    if not scorecards:
        log.error("No scorecards produced, exiting")
        sys.exit(1)

    aggregates = compute_aggregates(scorecards)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # JSON report
    json_report = {"scorecards": scorecards, "aggregates": aggregates}
    json_path = REPORTS_DIR / "prompt_eval.json"
    json_path.write_text(json.dumps(json_report, indent=2), encoding="utf-8")
    log.info("JSON report: %s", json_path)

    # Markdown report
    md_path = REPORTS_DIR / "prompt_eval.md"
    md_path.write_text(generate_markdown(scorecards, aggregates), encoding="utf-8")
    log.info("Markdown report: %s", md_path)


if __name__ == "__main__":
    main()
