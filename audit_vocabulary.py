"""Taxonomy health report: analyze parsed submissions for vocabulary drift and normalization issues."""

import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

PARSED_DIR = Path("data/parsed")
REPORTS_DIR = Path("reports")
NORMALIZE_PATH = Path("scripts/normalize-methods.json")

VALID_CATEGORIES = {
    "quantization", "architecture_modification", "optimizer_technique",
    "weight_averaging", "compression", "evaluation_technique",
    "test_time_training", "initialization", "sequence_length",
    "lr_schedule", "regularization", "other",
}

# Known aliases for method-name clustering
KNOWN_ALIASES = {
    "orthoinit": "OrthoInit",
    "orthogonal init": "OrthoInit",
    "orthogonal initialization": "OrthoInit",
    "orthogonal": "OrthoInit",
    "ema": "EMA",
    "exponential moving average": "EMA",
    "swa": "SWA",
    "stochastic weight averaging": "SWA",
    "muon optimizer": "Muon",
    "muon": "Muon",
    "adamw": "AdamW",
    "adam": "Adam",
    "gptq": "GPTQ",
    "gptq quantization": "GPTQ",
    "gptq-lite": "GPTQ-lite",
    "ste qat": "STE QAT",
    "qat": "QAT",
    "late qat": "late QAT",
    "relu²": "ReLU²",
    "relu squared": "ReLU²",
    "relu^2": "ReLU²",
    "warmdown": "warmdown",
    "warmdown schedule": "warmdown",
    "warmdown lr": "warmdown",
    "cosine decay": "cosine decay",
    "cosine": "cosine decay",
    "linear warmup": "linear warmup",
    "sliding window eval": "sliding window eval",
    "sliding window": "sliding window eval",
    "sliding window evaluation": "sliding window eval",
    "lora ttt": "LoRA TTT",
    "per-document lora ttt": "LoRA TTT",
    "weight tying": "weight tying",
    "tied embeddings": "weight tying",
    "magnitude pruning": "magnitude pruning",
    "bigramhash": "BigramHash",
    "bigram hash": "BigramHash",
    "smeargate": "SmearGate",
    "smear gate": "SmearGate",
    "gqa": "GQA",
    "grouped query attention": "GQA",
    "u-net skips": "U-Net skip connections",
    "u-net skip": "U-Net skip connections",
    "u-net skip connections": "U-Net skip connections",
    "unet skip connections": "U-Net skip connections",
    "zstd": "zstd",
    "zstd-22": "zstd",
    "zstd compression": "zstd",
    "zlib": "zlib",
    "dropout": "dropout",
    "weight decay": "weight decay",
    "label smoothing": "label smoothing",
}

# "other" entries that likely belong in existing categories
OTHER_RECLASSIFY = {
    "late qat": "quantization",
    "qat": "quantization",
    "quantization-aware training": "quantization",
    "magnitude pruning": "regularization",
    "pruning": "regularization",
    "weight pruning": "regularization",
    "structured pruning": "regularization",
    "unstructured pruning": "regularization",
    "zstd": "compression",
    "zlib": "compression",
    "gzip": "compression",
    "lzma": "compression",
    "tokenization": "other_suggested:tokenization",
    "bpe": "other_suggested:tokenization",
    "self-distillation": "other_suggested:training_objective",
    "mtp": "other_suggested:training_objective",
    "multi-token prediction": "other_suggested:training_objective",
    "knowledge distillation": "other_suggested:training_objective",
}


def load_submissions():
    files = sorted(PARSED_DIR.glob("*.json"), key=lambda f: int(f.stem))
    subs = []
    for f in files:
        subs.append(json.loads(f.read_text(encoding="utf-8")))
    return subs


def canonical(name):
    """Normalize a method name to lowercase for alias lookup."""
    if name is None:
        return None
    return KNOWN_ALIASES.get(name.lower().strip(), name)


def similar(a, b, threshold=0.8):
    """Check if two strings are similar above a threshold."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= threshold


def category_frequency(subs):
    """Count usage of each technique category."""
    counts = Counter()
    for s in subs:
        for t in s.get("training_techniques", []):
            counts[t.get("category", "MISSING")] += 1
    return dict(counts.most_common())


def find_invalid_categories(subs):
    """Find technique entries with non-standard category names."""
    invalid = []
    for s in subs:
        for t in s.get("training_techniques", []):
            cat = t.get("category", "MISSING")
            if cat not in VALID_CATEGORIES:
                invalid.append({
                    "pr_number": s["pr_number"],
                    "category": cat,
                    "data": t.get("data"),
                })
    return invalid


def method_normalization_clusters(subs):
    """Group method name variants that refer to the same technique."""
    # Collect all (category, method_name, pr_number) triples
    raw_methods = []
    for s in subs:
        for t in s.get("training_techniques", []):
            cat = t.get("category", "other")
            data = t.get("data", {})
            method = data.get("method") or data.get("component") or data.get("description", "")
            if method:
                raw_methods.append((cat, method.strip(), s["pr_number"]))

    # Group by canonical name
    clusters = defaultdict(lambda: {"variants": Counter(), "prs": set(), "category": set()})
    for cat, method, pr in raw_methods:
        canon = canonical(method)
        clusters[canon]["variants"][method] += 1
        clusters[canon]["prs"].add(pr)
        clusters[canon]["category"].add(cat)

    # Find fuzzy matches between canonical names (limit to top-100 by usage to avoid O(n²) blowup)
    top_canons = sorted(clusters.keys(), key=lambda k: -sum(clusters[k]["variants"].values()))[:100]
    merge_map = {}
    for i, a in enumerate(top_canons):
        for b in top_canons[i + 1:]:
            if a != b and a not in merge_map and b not in merge_map and similar(a, b, 0.85):
                count_a = sum(clusters[a]["variants"].values())
                count_b = sum(clusters[b]["variants"].values())
                if count_a >= count_b:
                    merge_map[b] = a
                else:
                    merge_map[a] = b

    # Apply merges
    for src, dst in merge_map.items():
        if src in clusters and dst in clusters:
            clusters[dst]["variants"].update(clusters[src]["variants"])
            clusters[dst]["prs"].update(clusters[src]["prs"])
            clusters[dst]["category"].update(clusters[src]["category"])
            del clusters[src]

    # Filter to clusters with multiple variants
    multi = {}
    for canon, info in sorted(clusters.items(), key=lambda x: -sum(x[1]["variants"].values())):
        if len(info["variants"]) > 1:
            multi[canon] = {
                "variants": dict(info["variants"].most_common()),
                "total_uses": sum(info["variants"].values()),
                "categories": sorted(info["category"]),
            }
    return multi


def other_reclassification(subs):
    """Analyze 'other' entries and suggest reclassification."""
    others = []
    for s in subs:
        for t in s.get("training_techniques", []):
            if t.get("category") == "other":
                desc = (t.get("data", {}).get("description") or "").strip().lower()
                others.append({
                    "pr_number": s["pr_number"],
                    "description": t.get("data", {}).get("description", ""),
                    "parameters": t.get("data", {}).get("parameters"),
                })

    # Try to match against known reclassifications
    suggestions = []
    unmatched = []
    for entry in others:
        desc_lower = entry["description"].lower()
        matched = False
        for keyword, target in OTHER_RECLASSIFY.items():
            if keyword in desc_lower:
                suggestions.append({**entry, "suggested_category": target})
                matched = True
                break
        if not matched:
            unmatched.append(entry)

    return {"total_other": len(others), "reclassifiable": suggestions, "unmatched_count": len(unmatched)}


def cross_category_overlaps(subs):
    """Find techniques that appear in multiple categories."""
    # method -> set of categories
    method_cats = defaultdict(lambda: {"categories": set(), "count": 0})
    for s in subs:
        for t in s.get("training_techniques", []):
            cat = t.get("category", "other")
            data = t.get("data", {})
            method = canonical(data.get("method") or data.get("component") or "")
            if method:
                method_cats[method]["categories"].add(cat)
                method_cats[method]["count"] += 1

    overlaps = {}
    for method, info in sorted(method_cats.items(), key=lambda x: -x[1]["count"]):
        if len(info["categories"]) > 1:
            overlaps[method] = {
                "categories": sorted(info["categories"]),
                "total_uses": info["count"],
            }
    return overlaps


def field_verbosity(subs, field):
    """Analyze unique values and verbosity of a top-level field."""
    values = Counter()
    null_count = 0
    for s in subs:
        v = s.get(field)
        if v is None:
            null_count += 1
        else:
            values[str(v)] += 1
    return {
        "unique_values": len(values),
        "null_count": null_count,
        "top_10": dict(values.most_common(10)),
        "verbose_examples": [v for v, c in values.most_common() if len(v) > 60][:5],
    }


def null_field_analysis(subs):
    """PRs missing key fields."""
    fields = ["val_bpb", "architecture", "quantization", "optimizer", "compression"]
    result = {}
    for field in fields:
        missing = [s["pr_number"] for s in subs if s.get(field) is None]
        result[field] = {"count": len(missing), "pr_numbers": missing[:20], "total_missing": len(missing)}
    return result


def prompt_version_distribution(subs):
    """Count how many parsed files have each prompt_version value."""
    counts = Counter(s.get("prompt_version", "v1 (unversioned)") for s in subs)
    return dict(counts.most_common())


def status_analysis(subs):
    """Analyze the status field distribution."""
    return dict(Counter(s.get("status", "MISSING") for s in subs).most_common())


def is_record_analysis(subs):
    """Analyze is_record distribution."""
    records = [s["pr_number"] for s in subs if s.get("is_record")]
    return {"count": len(records), "pr_numbers": records[:20]}


def _extract_methods(subs_list):
    """Extract canonical method names from a list of submissions."""
    methods = set()
    for s in subs_list:
        for t in s.get("training_techniques", []):
            data = t.get("data", {})
            method = data.get("method") or data.get("component") or data.get("description", "")
            if method:
                methods.add(canonical(method.strip()))
    return methods


def _count_methods(subs_list):
    """Count canonical method names from a list of submissions."""
    counts = Counter()
    for s in subs_list:
        for t in s.get("training_techniques", []):
            data = t.get("data", {})
            method = data.get("method") or data.get("component") or data.get("description", "")
            if method:
                counts[canonical(method.strip())] += 1
    return counts


def temporal_drift(subs):
    """Analyze how technique vocabulary, null rates, and patterns change over time.

    Uses PR number as a proxy for time (monotonically increasing).
    Splits submissions into terciles: early / middle / late.
    """
    # subs are already sorted by PR number from load_submissions
    n = len(subs)
    if n < 3:
        return {"error": "Too few submissions for temporal analysis"}

    tercile = n // 3
    periods = {
        "early": subs[:tercile],
        "middle": subs[tercile:2 * tercile],
        "late": subs[2 * tercile:],
    }

    result = {"total": n, "periods": {}}

    for period_name, period_subs in periods.items():
        methods = _count_methods(period_subs)
        categories = Counter()
        for s in period_subs:
            for t in s.get("training_techniques", []):
                categories[t.get("category", "other")] += 1

        null_rates = {}
        for field in ["val_bpb", "architecture", "quantization", "optimizer", "compression"]:
            nulls = sum(1 for s in period_subs if s.get(field) is None)
            null_rates[field] = round(nulls / len(period_subs) * 100, 1) if period_subs else 0

        total_techniques = sum(categories.values())
        other_ratio = round(categories.get("other", 0) / total_techniques * 100, 1) if total_techniques else 0
        avg_techniques = round(total_techniques / len(period_subs), 1) if period_subs else 0

        result["periods"][period_name] = {
            "count": len(period_subs),
            "pr_range": f"#{period_subs[0]['pr_number']}–#{period_subs[-1]['pr_number']}",
            "top_methods": dict(methods.most_common(15)),
            "category_distribution": dict(categories.most_common()),
            "null_rates": null_rates,
            "other_ratio": other_ratio,
            "avg_techniques_per_pr": avg_techniques,
        }

    # Emerging techniques: in late but not early
    early_methods = _extract_methods(periods["early"])
    late_counts = _count_methods(periods["late"])
    result["emerging_techniques"] = dict(
        (m, c) for m, c in late_counts.most_common() if m not in early_methods
    )

    # Fading techniques: in early but not late
    late_methods = _extract_methods(periods["late"])
    early_counts = _count_methods(periods["early"])
    result["fading_techniques"] = dict(
        (m, c) for m, c in early_counts.most_common(15) if m not in late_methods
    )

    # Architecture and quantization drift per period
    for period_name, period_subs in periods.items():
        archs = Counter(s.get("architecture") or "null" for s in period_subs)
        result["periods"][period_name]["architecture_values"] = dict(archs.most_common(10))
        quants = Counter(s.get("quantization") or "null" for s in period_subs)
        result["periods"][period_name]["quantization_values"] = dict(quants.most_common(10))

    return result


def generate_markdown(report):
    """Generate a human-readable markdown report."""
    lines = ["# Vocabulary Audit Report\n"]

    # Prompt versions
    if "prompt_versions" in report:
        lines.append("## Prompt Version Distribution\n")
        for version, count in report["prompt_versions"].items():
            lines.append(f"- **{version}**: {count}")
        lines.append("")

    # Status
    lines.append("## Status Distribution\n")
    for status, count in report["status_distribution"].items():
        lines.append(f"- **{status}**: {count}")
    lines.append("")

    # is_record
    lines.append("## is_record Analysis\n")
    rec = report["is_record"]
    lines.append(f"- **{rec['count']}** PRs marked as record")
    lines.append(f"- Sample PR numbers: {rec['pr_numbers'][:10]}")
    lines.append("")

    # Category frequency
    lines.append("## Category Frequency\n")
    lines.append("| Category | Count |")
    lines.append("|----------|-------|")
    for cat, count in report["category_frequency"].items():
        marker = " **INVALID**" if cat not in VALID_CATEGORIES else ""
        lines.append(f"| {cat}{marker} | {count} |")
    lines.append("")

    # Invalid categories
    if report["invalid_categories"]:
        lines.append("## Invalid Categories\n")
        for entry in report["invalid_categories"]:
            lines.append(f"- PR #{entry['pr_number']}: `{entry['category']}`")
        lines.append("")

    # Method normalization clusters
    lines.append("## Method Name Variants (Normalization Needed)\n")
    for canon, info in list(report["method_clusters"].items())[:20]:
        lines.append(f"### {canon} ({info['total_uses']} uses, categories: {', '.join(info['categories'])})\n")
        for variant, count in info["variants"].items():
            lines.append(f"- \"{variant}\" ({count})")
        lines.append("")

    # Other reclassification
    other = report["other_reclassification"]
    lines.append(f"## 'other' Category Analysis\n")
    lines.append(f"- **Total 'other' entries**: {other['total_other']}")
    lines.append(f"- **Reclassifiable**: {len(other['reclassifiable'])}")
    lines.append(f"- **Unmatched**: {other['unmatched_count']}")
    lines.append("")
    if other["reclassifiable"]:
        lines.append("### Suggested Reclassifications\n")
        for entry in other["reclassifiable"][:15]:
            lines.append(f"- PR #{entry['pr_number']}: \"{entry['description'][:80]}\" → **{entry['suggested_category']}**")
        lines.append("")

    # Cross-category overlaps
    if report["cross_category_overlaps"]:
        lines.append("## Cross-Category Overlaps\n")
        lines.append("| Method | Categories | Uses |")
        lines.append("|--------|-----------|------|")
        for method, info in list(report["cross_category_overlaps"].items())[:15]:
            lines.append(f"| {method} | {', '.join(info['categories'])} | {info['total_uses']} |")
        lines.append("")

    # Field verbosity
    for field in ["architecture", "quantization", "optimizer"]:
        info = report["field_verbosity"][field]
        lines.append(f"## `{field}` Field Analysis\n")
        lines.append(f"- **Unique values**: {info['unique_values']}")
        lines.append(f"- **Null count**: {info['null_count']}")
        lines.append("")
        lines.append("**Top 10 values:**\n")
        for val, count in info["top_10"].items():
            display = val[:80] + "..." if len(val) > 80 else val
            lines.append(f"- \"{display}\" ({count})")
        lines.append("")
        if info["verbose_examples"]:
            lines.append("**Over-verbose examples (>60 chars):**\n")
            for v in info["verbose_examples"]:
                lines.append(f"- \"{v[:100]}...\"")
            lines.append("")

    # Null fields
    lines.append("## Null Field Analysis\n")
    lines.append("| Field | Missing Count | Sample PRs |")
    lines.append("|-------|--------------|------------|")
    for field, info in report["null_fields"].items():
        sample = str(info["pr_numbers"][:5])
        lines.append(f"| {field} | {info['count']} | {sample} |")
    lines.append("")

    # Temporal drift
    drift = report.get("temporal_drift", {})
    if "periods" in drift:
        lines.append("## Temporal Drift Analysis\n")
        lines.append(f"**{drift['total']}** PRs split into terciles by PR number.\n")

        # Period summary table
        lines.append("| Period | PRs | PR Range | Avg Techniques | 'other' % | val_bpb null % |")
        lines.append("|--------|-----|----------|----------------|-----------|----------------|")
        for period_name in ["early", "middle", "late"]:
            p = drift["periods"][period_name]
            lines.append(
                f"| {period_name} | {p['count']} | {p['pr_range']} "
                f"| {p['avg_techniques_per_pr']} | {p['other_ratio']}% | {p['null_rates'].get('val_bpb', '?')}% |"
            )
        lines.append("")

        # Null rates by period
        lines.append("### Null Rates by Period\n")
        lines.append("| Field | Early % | Middle % | Late % |")
        lines.append("|-------|---------|----------|--------|")
        for field in ["val_bpb", "architecture", "quantization", "optimizer", "compression"]:
            early_r = drift["periods"]["early"]["null_rates"].get(field, "?")
            mid_r = drift["periods"]["middle"]["null_rates"].get(field, "?")
            late_r = drift["periods"]["late"]["null_rates"].get(field, "?")
            lines.append(f"| {field} | {early_r}% | {mid_r}% | {late_r}% |")
        lines.append("")

        # Emerging techniques (late only)
        emerging = drift.get("emerging_techniques", {})
        if emerging:
            lines.append("### Emerging Techniques (late period only, not seen in early)\n")
            lines.append("These techniques appeared only in the latest third of submissions — the prompt may not handle them well.\n")
            for tech, count in list(emerging.items())[:20]:
                lines.append(f"- **{tech}** ({count} uses)")
            lines.append("")

        # Fading techniques
        fading = drift.get("fading_techniques", {})
        if fading:
            lines.append("### Fading Techniques (early period only, not seen in late)\n")
            for tech, count in list(fading.items())[:10]:
                lines.append(f"- {tech} ({count} uses)")
            lines.append("")

        # Architecture drift
        lines.append("### Architecture Field Drift\n")
        for period_name in ["early", "middle", "late"]:
            p = drift["periods"][period_name]
            top3 = list(p.get("architecture_values", {}).items())[:5]
            vals = ", ".join(f'"{k}" ({v})' for k, v in top3)
            lines.append(f"- **{period_name}**: {vals}")
        lines.append("")

        # Quantization drift
        lines.append("### Quantization Field Drift\n")
        for period_name in ["early", "middle", "late"]:
            p = drift["periods"][period_name]
            top3 = list(p.get("quantization_values", {}).items())[:5]
            vals = ", ".join(f'"{k}" ({v})' for k, v in top3)
            lines.append(f"- **{period_name}**: {vals}")
        lines.append("")

    # Recommendations
    lines.append("## Recommendations\n")
    lines.append("1. **Normalize method names** — Apply canonical aliases to reduce variant proliferation")
    lines.append("2. **Constrain `architecture`** — Prompt should request a short base type (Transformer, Mamba, LSTM, etc.), not a full config dump")
    lines.append("3. **Constrain `quantization`** — Limit to a concise summary like \"int8 QAT\" not free-form descriptions")
    lines.append("4. **Reclassify 'other'** — Many entries belong in existing categories (especially quantization, regularization)")
    lines.append("5. **Fix status extraction** — Raw data shows state/merged fields; prompt should derive status more carefully")
    lines.append("6. **Add missing categories** — Consider: tokenization/data, training_objective, pruning")
    lines.append("7. **Reduce is_record false positives** — Cross-reference with labels and explicit record mentions")
    lines.append("8. **Improve val_bpb extraction** — Many null values may have bpb buried in text or tables")
    lines.append("")

    return "\n".join(lines)


def main():
    subs = load_submissions()
    print(f"Loaded {len(subs)} submissions")

    report = {
        "total_submissions": len(subs),
        "prompt_versions": prompt_version_distribution(subs),
        "status_distribution": status_analysis(subs),
        "is_record": is_record_analysis(subs),
        "category_frequency": category_frequency(subs),
        "invalid_categories": find_invalid_categories(subs),
        "method_clusters": method_normalization_clusters(subs),
        "other_reclassification": other_reclassification(subs),
        "cross_category_overlaps": cross_category_overlaps(subs),
        "field_verbosity": {
            "architecture": field_verbosity(subs, "architecture"),
            "quantization": field_verbosity(subs, "quantization"),
            "optimizer": field_verbosity(subs, "optimizer"),
        },
        "null_fields": null_field_analysis(subs),
        "temporal_drift": temporal_drift(subs),
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # JSON report (convert sets to lists for serialization)
    json_report = json.loads(json.dumps(report, default=lambda o: sorted(o) if isinstance(o, set) else o))
    json_path = REPORTS_DIR / "vocabulary_audit.json"
    json_path.write_text(json.dumps(json_report, indent=2), encoding="utf-8")
    print(f"JSON report: {json_path}")

    # Markdown report
    md_path = REPORTS_DIR / "vocabulary_audit.md"
    md_path.write_text(generate_markdown(report), encoding="utf-8")
    print(f"Markdown report: {md_path}")


if __name__ == "__main__":
    main()
