"""Update is_record in parsed PRs based on the official README leaderboard."""

import json
import logging
import re
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

README_PATH = Path("data/readme.md")
PARSED_DIR = Path("data/parsed")
SCORE_TOLERANCE = 0.003


def parse_leaderboard(readme_text):
    """Extract entries from the main leaderboard table (not unlimited/non-record)."""
    lines = readme_text.split("\n")
    entries = []
    in_leaderboard = False

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("## Leaderboard"):
            in_leaderboard = True
            continue

        # Stop at the non-record section
        if in_leaderboard and "unlimited compute" in stripped.lower():
            break

        if not in_leaderboard:
            continue

        # Skip header/separator rows
        if not stripped.startswith("|") or "---" in stripped or "Run" in stripped.split("|")[1:2]:
            continue

        cols = [c.strip() for c in stripped.split("|")]
        # cols[0] is empty (before first |), cols[-1] is empty (after last |)
        if len(cols) < 6:
            continue

        run_name = cols[1]
        try:
            score = float(cols[2])
        except (ValueError, IndexError):
            continue
        author = cols[3]
        summary = cols[4]

        # Skip baseline
        if author.lower() == "baseline":
            continue

        # Extract PR number from summary (first match only)
        pr_match = re.search(r"PR\s*#(\d+)", summary)
        pr_number = int(pr_match.group(1)) if pr_match else None

        entries.append({
            "run": run_name,
            "score": score,
            "author": author,
            "summary": summary,
            "pr_number": pr_number,
        })

    return entries


def normalize_author(name):
    """Normalize author name for fuzzy comparison."""
    return re.sub(r"[\s\-_]", "", name).lower()


def authors_match(a, b):
    """Check if two normalized author names are similar enough."""
    if a == b:
        return True
    if a in b or b in a:
        return True
    # Allow one-char edit distance for typos/extra chars (e.g., nanliu vs nanlliu)
    if abs(len(a) - len(b)) <= 1:
        shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
        # Check if shorter can be made from longer by removing one char
        for i in range(len(longer)):
            if longer[:i] + longer[i + 1:] == shorter:
                return True
    return False


def resolve_pr_numbers(entries, parsed_dir):
    """Resolve PR numbers for leaderboard entries, using score/author fallback."""
    # Load all parsed files for fallback matching
    parsed_index = {}  # pr_number -> {author, val_bpb}
    for f in parsed_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            parsed_index[int(f.stem)] = {
                "author": data.get("author", ""),
                "val_bpb": data.get("val_bpb"),
            }
        except (json.JSONDecodeError, ValueError):
            continue

    record_prs = set()

    for entry in entries:
        if entry["pr_number"]:
            record_prs.add(entry["pr_number"])
            log.debug("Leaderboard: PR #%d (explicit) — %s", entry["pr_number"], entry["run"])
            continue

        # Fallback: match by author + score
        leaderboard_author = normalize_author(entry["author"])
        candidates = []
        for pr_num, info in parsed_index.items():
            parsed_author = normalize_author(info["author"])
            if info["val_bpb"] is None:
                continue
            score_close = abs(info["val_bpb"] - entry["score"]) < SCORE_TOLERANCE
            author_match = authors_match(leaderboard_author, parsed_author)
            if score_close and author_match:
                candidates.append(pr_num)

        if len(candidates) == 1:
            record_prs.add(candidates[0])
            log.info(
                "Leaderboard: PR #%d (matched by author+score) — %s (score=%.4f, author=%s)",
                candidates[0], entry["run"], entry["score"], entry["author"],
            )
        elif len(candidates) > 1:
            log.warning(
                "Leaderboard: multiple matches for %s (score=%.4f, author=%s): PRs %s — skipping",
                entry["run"], entry["score"], entry["author"], candidates,
            )
        else:
            log.warning(
                "Leaderboard: no match for %s (score=%.4f, author=%s)",
                entry["run"], entry["score"], entry["author"],
            )

    return record_prs


def update_parsed_files(record_prs, parsed_dir):
    """Update is_record in all parsed JSON files."""
    updated = 0
    for f in sorted(parsed_dir.glob("*.json"), key=lambda x: int(x.stem)):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, ValueError):
            continue

        pr_num = int(f.stem)
        new_value = pr_num in record_prs
        old_value = data.get("is_record")

        if old_value != new_value:
            log.info("PR #%d: is_record %s → %s", pr_num, old_value, new_value)
            updated += 1

        data["is_record"] = new_value
        f.write_text(json.dumps(data, indent=2), encoding="utf-8")

    return updated


def main():
    if not README_PATH.exists():
        log.warning("No %s found, skipping record update", README_PATH)
        return

    if not PARSED_DIR.exists():
        log.warning("No %s found, skipping record update", PARSED_DIR)
        return

    readme_text = README_PATH.read_text(encoding="utf-8")
    entries = parse_leaderboard(readme_text)
    log.info("Found %d leaderboard entries", len(entries))

    record_prs = resolve_pr_numbers(entries, PARSED_DIR)
    log.info("Resolved %d record PR numbers: %s", len(record_prs), sorted(record_prs))

    updated = update_parsed_files(record_prs, PARSED_DIR)
    log.info("Updated %d parsed files", updated)


if __name__ == "__main__":
    main()
