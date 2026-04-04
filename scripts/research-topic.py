#!/usr/bin/env python3
"""Quick research helper for deep-dive-writer agent.

Usage: python scripts/research-topic.py <keyword> [keyword2 ...]

Searches all parsed submissions for the given keywords (case-insensitive)
and prints aggregated stats: counts, top submissions by BPB, and details
from the best raw PRs. Designed to replace dozens of individual file reads
with a single command.
"""

import json
import glob
import sys
import collections
import os


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/research-topic.py <keyword> [keyword2 ...]")
        print("Example: python scripts/research-topic.py BigramHash SmearGate 'U-Net'")
        sys.exit(1)

    keywords = sys.argv[1:]
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Load all parsed submissions
    parsed = []
    for f in sorted(glob.glob(os.path.join(base, "data/parsed/*.json"))):
        with open(f) as fh:
            parsed.append(json.load(fh))

    print(f"Loaded {len(parsed)} parsed submissions\n")

    for kw in keywords:
        kw_lower = kw.lower()
        matches = []
        for p in parsed:
            text = json.dumps(p).lower()
            if kw_lower in text:
                matches.append(p)

        with_bpb = [m for m in matches if m.get("val_bpb") is not None]
        with_bpb.sort(key=lambda x: x["val_bpb"])

        print(f'=== "{kw}" ===')
        print(f"  Total matches: {len(matches)}, with BPB: {len(with_bpb)}")

        if with_bpb:
            bpbs = [m["val_bpb"] for m in with_bpb]
            print(f"  Avg BPB: {sum(bpbs)/len(bpbs):.4f}, Best: {bpbs[0]:.4f}, Worst: {bpbs[-1]:.4f}")
            print(f"\n  Top 8 submissions:")
            for p in with_bpb[:8]:
                arch = p.get("architecture", "?")
                novel = p.get("novel_contributions", [])
                techniques = [
                    f'{t["category"]}:{t["data"].get("method","")}'
                    for t in p.get("training_techniques", [])
                    if t["data"].get("method")
                ]
                print(f"    PR #{p['pr_number']}: {p['val_bpb']:.4f} BPB")
                print(f"      arch={arch}, quant={p.get('quantization')}, artifact={p.get('artifact_size')}")
                if techniques:
                    print(f"      techniques: {', '.join(techniques[:8])}")
                if novel:
                    print(f"      novel: {novel[0][:100]}")

        # Check technique category counts
        cat_methods = collections.Counter()
        for p in matches:
            for t in p.get("training_techniques", []):
                method = t["data"].get("method", "")
                if method:
                    cat_methods[f'{t["category"]}:{method}'] += 1
        if cat_methods:
            print(f"\n  Technique breakdown (top 10):")
            for method, count in cat_methods.most_common(10):
                print(f"    {method}: {count}")

        print()

    # Print detailed raw PR info for top 3 matches across all keywords
    all_matches = []
    for kw in keywords:
        kw_lower = kw.lower()
        for p in parsed:
            text = json.dumps(p).lower()
            if kw_lower in text and p.get("val_bpb") is not None:
                all_matches.append(p)

    # Deduplicate and sort
    seen = set()
    unique = []
    for p in all_matches:
        if p["pr_number"] not in seen:
            seen.add(p["pr_number"])
            unique.append(p)
    unique.sort(key=lambda x: x["val_bpb"])

    if unique:
        print("=== RAW PR DETAILS (top 3) ===")
        for p in unique[:3]:
            pr_num = p["pr_number"]
            raw_path = os.path.join(base, f"data/raw/{pr_num}.json")
            if os.path.exists(raw_path):
                with open(raw_path) as fh:
                    raw = json.load(fh)
                body = raw.get("body", "")[:1500]
                readme = raw.get("submission_readme", "")[:1500]
                print(f"\n--- PR #{pr_num} (BPB: {p['val_bpb']:.4f}) ---")
                print(f"Body:\n{body}")
                if readme:
                    print(f"\nREADME:\n{readme}")
            print()


if __name__ == "__main__":
    main()
