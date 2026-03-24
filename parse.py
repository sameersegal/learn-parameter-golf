"""LLM-powered structured extraction of PR submissions using OpenAI Responses API."""

import argparse
import json
import logging
import os
import sys
import time
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
PROMPT_PATH = Path("prompts/parse_submission.txt")
MODEL = "gpt-4.1-mini"


def load_prompt_template():
    return Template(PROMPT_PATH.read_text(encoding="utf-8"))


def parse_pr(client, template, pr_data):
    """Parse a single PR using the OpenAI Responses API."""
    pr_number = pr_data["number"]
    has_readme = bool(pr_data.get("submission_readme"))
    prompt = template.safe_substitute(
        readme=pr_data.get("submission_readme") or "(no submission README found)",
        pr_number=pr_number,
        title=pr_data["title"],
        author=pr_data["author"],
        state=pr_data["state"],
        labels=", ".join(pr_data.get("labels", [])) or "none",
        body=pr_data["body"] or "(empty)",
    )

    prompt_chars = len(prompt)
    log.debug("PR #%d prompt: %d chars (readme: %s)", pr_number, prompt_chars, has_readme)

    t0 = time.time()
    response = client.responses.create(
        model=MODEL,
        input=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    elapsed = time.time() - t0

    # Extract text from the response
    text = response.output_text.strip()
    log.debug("PR #%d response: %d chars in %.1fs", pr_number, len(text), elapsed)

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    parsed = json.loads(text)
    n_techniques = len(parsed.get("training_techniques", []))
    log.info(
        "PR #%d OK  %.1fs  bpb=%s  techniques=%d  readme=%s",
        pr_number, elapsed, parsed.get("val_bpb"), n_techniques, has_readme,
    )
    return parsed


def main():
    parser = argparse.ArgumentParser(description="Parse raw PRs into structured data")
    parser.add_argument(
        "--force", action="store_true", help="Re-parse all PRs, even if already parsed"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable debug logging"
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if not os.environ.get("OPENAI_API_KEY"):
        log.warning("OPENAI_API_KEY not set, skipping parse")
        return

    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    template = load_prompt_template()
    client = OpenAI()

    raw_files = sorted(RAW_DIR.glob("*.json"), key=lambda f: int(f.stem))
    existing = {int(f.stem) for f in PARSED_DIR.glob("*.json")}
    to_parse = [f for f in raw_files if args.force or int(f.stem) not in existing]

    log.info(
        "Found %d raw PRs, %d already parsed, %d to parse%s",
        len(raw_files), len(existing), len(to_parse),
        " (--force)" if args.force else "",
    )

    parsed_count = 0
    error_count = 0
    t_start = time.time()

    for i, raw_file in enumerate(to_parse, 1):
        pr_number = int(raw_file.stem)
        pr_data = json.loads(raw_file.read_text(encoding="utf-8"))
        log.info("[%d/%d] Parsing PR #%d: %s", i, len(to_parse), pr_number, pr_data["title"][:70])

        try:
            parsed = parse_pr(client, template, pr_data)
            out_path = PARSED_DIR / f"{pr_number}.json"
            out_path.write_text(json.dumps(parsed, indent=2), encoding="utf-8")
            parsed_count += 1
        except Exception as e:
            error_count += 1
            log.error("PR #%d FAILED: %s", pr_number, e)

    elapsed = time.time() - t_start
    log.info("Done! %d parsed, %d errors in %.1fs", parsed_count, error_count, elapsed)


if __name__ == "__main__":
    main()
