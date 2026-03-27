"""Compare gpt-5.4-mini vs gpt-5.4-nano on PR parsing quality.

Samples N parsed PRs, re-parses them with gpt-5.4-nano, and compares
against the existing gpt-5.4-mini output as ground truth.
"""

import argparse
import json
import random
import sys
import time
from pathlib import Path
from string import Template

from openai import OpenAI

RAW_DIR = Path("data/raw")
PARSED_DIR = Path("data/parsed")
PROMPT_PATH = Path("prompts/parse_submission.txt")
EVAL_OUT = Path("eval")

MINI_MODEL = "gpt-5.4-mini"
NANO_MODEL = "gpt-5.4-nano"


def load_template():
    return Template(PROMPT_PATH.read_text(encoding="utf-8"))


def build_prompt(template, pr_data):
    return template.safe_substitute(
        readme=pr_data.get("submission_readme") or "(no submission README found)",
        pr_number=pr_data["number"],
        title=pr_data["title"],
        author=pr_data["author"],
        state=pr_data["state"],
        labels=", ".join(pr_data.get("labels", [])) or "none",
        body=pr_data["body"] or "(empty)",
    )


def call_model(client, model, prompt):
    t0 = time.time()
    response = client.responses.create(
        model=model,
        input=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    elapsed = time.time() - t0
    text = response.output_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return json.loads(text), elapsed


# ── Comparison helpers ──────────────────────────────────────────────


def compare_scalar(mini_val, nano_val, field_name):
    """Compare a scalar field. Returns (match: bool, detail: str)."""
    if mini_val == nano_val:
        return True, f"{field_name}: ✓ match ({mini_val})"
    return False, f"{field_name}: ✗ mini={mini_val!r}  nano={nano_val!r}"


def compare_val_bpb(mini_val, nano_val):
    """val_bpb: exact match or both null."""
    if mini_val is None and nano_val is None:
        return True, "val_bpb: ✓ both null"
    if mini_val is None or nano_val is None:
        return False, f"val_bpb: ✗ mini={mini_val}  nano={nano_val}"
    if mini_val == nano_val:
        return True, f"val_bpb: ✓ match ({mini_val})"
    return False, f"val_bpb: ✗ mini={mini_val}  nano={nano_val}"


def compare_techniques(mini_techs, nano_techs):
    """Compare training_techniques by category sets and count."""
    mini_cats = sorted([t["category"] for t in mini_techs])
    nano_cats = sorted([t["category"] for t in nano_techs])

    mini_set = set(mini_cats)
    nano_set = set(nano_cats)

    missing = mini_set - nano_set
    extra = nano_set - mini_set

    count_match = len(mini_techs) == len(nano_techs)
    cats_match = mini_cats == nano_cats

    details = []
    details.append(f"  technique_count: mini={len(mini_techs)} nano={len(nano_techs)} {'✓' if count_match else '✗'}")
    details.append(f"  categories_exact: {'✓' if cats_match else '✗'}")
    if missing:
        details.append(f"  missing_in_nano: {missing}")
    if extra:
        details.append(f"  extra_in_nano: {extra}")

    # Category set overlap (Jaccard)
    if mini_set | nano_set:
        jaccard = len(mini_set & nano_set) / len(mini_set | nano_set)
    else:
        jaccard = 1.0
    details.append(f"  category_set_jaccard: {jaccard:.2f}")

    return cats_match, "\n".join(details), jaccard


def compare_novel_contributions(mini_nc, nano_nc):
    """Compare novel_contributions by count."""
    mini_count = len(mini_nc) if mini_nc else 0
    nano_count = len(nano_nc) if nano_nc else 0
    match = mini_count == nano_count
    return match, f"novel_contributions_count: mini={mini_count} nano={nano_count} {'✓' if match else '✗'}"


def evaluate_pr(mini_parsed, nano_parsed):
    """Compare mini vs nano for a single PR. Returns a dict of metrics."""
    results = {}
    details = []

    # Scalar fields
    for field in ["status", "architecture", "quantization", "optimizer", "compression", "artifact_size"]:
        match, detail = compare_scalar(mini_parsed.get(field), nano_parsed.get(field), field)
        results[field] = match
        details.append(detail)

    # val_bpb
    match, detail = compare_val_bpb(mini_parsed.get("val_bpb"), nano_parsed.get("val_bpb"))
    results["val_bpb"] = match
    details.append(detail)

    # Techniques
    mini_techs = mini_parsed.get("training_techniques", [])
    nano_techs = nano_parsed.get("training_techniques", [])
    cats_match, tech_detail, jaccard = compare_techniques(mini_techs, nano_techs)
    results["techniques_categories"] = cats_match
    results["techniques_jaccard"] = jaccard
    details.append("training_techniques:")
    details.append(tech_detail)

    # Novel contributions
    match, detail = compare_novel_contributions(
        mini_parsed.get("novel_contributions"), nano_parsed.get("novel_contributions")
    )
    results["novel_contributions_count"] = match
    details.append(detail)

    return results, "\n".join(details)


def select_sample(n, seed=42):
    """Select a stratified sample of PRs: mix of simple and complex."""
    parsed_files = sorted(PARSED_DIR.glob("*.json"), key=lambda f: int(f.stem))
    rng = random.Random(seed)

    # Split into simple (<=2 techniques) and complex (>2 techniques)
    simple, complex_ = [], []
    for f in parsed_files:
        data = json.loads(f.read_text(encoding="utf-8"))
        pr_num = int(f.stem)
        n_tech = len(data.get("training_techniques", []))
        if n_tech <= 2:
            simple.append(pr_num)
        else:
            complex_.append(pr_num)

    # Sample ~half from each bucket
    n_simple = n // 2
    n_complex = n - n_simple
    sample = rng.sample(simple, min(n_simple, len(simple))) + \
             rng.sample(complex_, min(n_complex, len(complex_)))
    return sorted(sample)


def main():
    parser = argparse.ArgumentParser(description="Eval: gpt-5.4-mini vs gpt-5.4-nano")
    parser.add_argument("-n", type=int, default=20, help="Number of PRs to sample (default: 20)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--also-mini", action="store_true",
                        help="Also re-run mini (to measure run-to-run variance)")
    args = parser.parse_args()

    client = OpenAI()
    template = load_template()
    sample_prs = select_sample(args.n, args.seed)

    print(f"Eval: {MINI_MODEL} vs {NANO_MODEL}")
    print(f"Sample: {len(sample_prs)} PRs (seed={args.seed})")
    print(f"PRs: {sample_prs}\n")
    print("=" * 70)

    all_results = []
    nano_times = []
    mini_times = []
    nano_errors = 0
    mini_rerun_errors = 0

    EVAL_OUT.mkdir(parents=True, exist_ok=True)
    per_pr_results = []

    for i, pr_num in enumerate(sample_prs, 1):
        raw_path = RAW_DIR / f"{pr_num}.json"
        parsed_path = PARSED_DIR / f"{pr_num}.json"

        if not raw_path.exists() or not parsed_path.exists():
            print(f"[{i}/{len(sample_prs)}] PR #{pr_num}: SKIP (missing files)")
            continue

        pr_data = json.loads(raw_path.read_text(encoding="utf-8"))
        mini_parsed = json.loads(parsed_path.read_text(encoding="utf-8"))
        prompt = build_prompt(template, pr_data)

        print(f"\n[{i}/{len(sample_prs)}] PR #{pr_num}: {pr_data['title'][:60]}")

        # Run nano
        try:
            nano_parsed, nano_elapsed = call_model(client, NANO_MODEL, prompt)
            nano_times.append(nano_elapsed)
            print(f"  nano: {nano_elapsed:.1f}s")
        except Exception as e:
            print(f"  nano: ERROR - {e}")
            nano_errors += 1
            continue

        # Compare
        results, detail = evaluate_pr(mini_parsed, nano_parsed)
        all_results.append(results)
        print(detail)

        pr_result = {
            "pr_number": pr_num,
            "title": pr_data["title"],
            "nano_time": round(nano_elapsed, 2),
            "results": {k: v if not isinstance(v, bool) else v for k, v in results.items()},
            "mini_parsed": mini_parsed,
            "nano_parsed": nano_parsed,
        }

        # Optionally re-run mini to measure variance
        if args.also_mini:
            try:
                mini_reparsed, mini_elapsed = call_model(client, MINI_MODEL, prompt)
                mini_times.append(mini_elapsed)
                mini_results, _ = evaluate_pr(mini_parsed, mini_reparsed)
                pr_result["mini_rerun_time"] = round(mini_elapsed, 2)
                pr_result["mini_rerun_results"] = mini_results
                print(f"  mini rerun: {mini_elapsed:.1f}s")
            except Exception as e:
                print(f"  mini rerun: ERROR - {e}")
                mini_rerun_errors += 1

        per_pr_results.append(pr_result)

    # ── Aggregate ────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("AGGREGATE RESULTS")
    print("=" * 70)

    if not all_results:
        print("No results to aggregate.")
        sys.exit(1)

    n_total = len(all_results)

    # Field-level accuracy
    scalar_fields = ["status", "val_bpb", "architecture", "quantization", "optimizer",
                     "compression", "artifact_size", "techniques_categories", "novel_contributions_count"]
    print(f"\nField accuracy (n={n_total}):")
    print("-" * 40)
    field_scores = {}
    for field in scalar_fields:
        matches = sum(1 for r in all_results if r.get(field, False))
        pct = matches / n_total * 100
        field_scores[field] = pct
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"  {field:30s} {bar} {pct:5.1f}% ({matches}/{n_total})")

    # Jaccard
    avg_jaccard = sum(r.get("techniques_jaccard", 0) for r in all_results) / n_total
    print(f"\n  {'technique_cat_jaccard (avg)':30s} {avg_jaccard:.3f}")

    # Overall score
    overall = sum(field_scores.values()) / len(field_scores)
    print(f"\n  {'OVERALL FIELD ACCURACY':30s} {overall:.1f}%")

    # Timing
    if nano_times:
        print(f"\nTiming:")
        print(f"  nano avg: {sum(nano_times)/len(nano_times):.1f}s  (total: {sum(nano_times):.0f}s)")
    if mini_times:
        print(f"  mini avg: {sum(mini_times)/len(mini_times):.1f}s  (total: {sum(mini_times):.0f}s)")

    # Errors
    if nano_errors:
        print(f"\n  nano parse errors: {nano_errors}/{n_total + nano_errors}")

    # Save detailed results
    summary = {
        "models": {"baseline": MINI_MODEL, "candidate": NANO_MODEL},
        "sample_size": n_total,
        "seed": args.seed,
        "field_accuracy": field_scores,
        "avg_technique_jaccard": round(avg_jaccard, 4),
        "overall_accuracy": round(overall, 2),
        "nano_errors": nano_errors,
        "nano_avg_time": round(sum(nano_times) / len(nano_times), 2) if nano_times else None,
        "per_pr": per_pr_results,
    }

    out_path = EVAL_OUT / "model_comparison.json"
    out_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    print(f"\nDetailed results saved to {out_path}")

    # Verdict
    print("\n" + "=" * 70)
    if overall >= 95:
        print("VERDICT: gpt-5.4-nano looks VIABLE — very close to mini quality.")
    elif overall >= 85:
        print("VERDICT: gpt-5.4-nano is USABLE with caveats — some field degradation.")
    elif overall >= 70:
        print("VERDICT: gpt-5.4-nano shows NOTABLE degradation — review failures before switching.")
    else:
        print("VERDICT: gpt-5.4-nano is NOT RECOMMENDED — significant quality drop.")
    print("=" * 70)


if __name__ == "__main__":
    main()
