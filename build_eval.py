"""Generate eval set for human review of parsed PR data."""

import json
from pathlib import Path

RAW_DIR = Path("data/raw")
PARSED_DIR = Path("data/parsed")
EVAL_DIR = Path("eval")
EVAL_PATH = EVAL_DIR / "eval_set.json"


def main():
    EVAL_DIR.mkdir(parents=True, exist_ok=True)

    parsed_files = sorted(PARSED_DIR.glob("*.json"), key=lambda f: int(f.stem))
    if not parsed_files:
        print("No parsed files found. Run parse.py first.")
        return

    eval_set = []
    for parsed_file in parsed_files:
        pr_number = int(parsed_file.stem)
        raw_file = RAW_DIR / f"{pr_number}.json"

        raw_data = json.loads(raw_file.read_text(encoding="utf-8"))
        parsed_data = json.loads(parsed_file.read_text(encoding="utf-8"))

        eval_set.append({
            "pr_number": pr_number,
            "original_body": raw_data.get("body", ""),
            "parsed_json": parsed_data,
        })

    EVAL_PATH.write_text(json.dumps(eval_set, indent=2), encoding="utf-8")
    print(f"Generated eval set with {len(eval_set)} entries at {EVAL_PATH}")


if __name__ == "__main__":
    main()
