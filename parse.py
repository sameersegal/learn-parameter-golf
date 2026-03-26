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
PROMPTS_DIR = Path("prompts")
PROMPT_PATH = PROMPTS_DIR / "parse_submission.txt"
MANIFEST_PATH = PROMPTS_DIR / "manifest.json"
MODEL = "gpt-5.4-mini"


def load_manifest():
    """Load prompt version manifest, or return None if it doesn't exist."""
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return None


def get_prompt_version_and_template(requested_version=None):
    """Load the prompt template for a given version.

    Returns (version_string, Template) tuple.
    Falls back to the root prompt file if no manifest exists.
    """
    manifest = load_manifest()

    if manifest is None:
        # No versioning set up — use legacy path
        log.info("No prompt manifest found, using %s", PROMPT_PATH)
        return "v1", Template(PROMPT_PATH.read_text(encoding="utf-8"))

    version = requested_version or manifest["latest"]
    if version not in manifest["versions"]:
        available = ", ".join(manifest["versions"].keys())
        log.error("Prompt version '%s' not found. Available: %s", version, available)
        sys.exit(1)

    version_path = PROMPTS_DIR / version / "parse_submission.txt"
    if not version_path.exists():
        log.error("Prompt file not found: %s", version_path)
        sys.exit(1)

    log.info("Using prompt version: %s (%s)", version, version_path)
    return version, Template(version_path.read_text(encoding="utf-8"))


def get_existing_prompt_version(pr_number):
    """Read the prompt_version from an existing parsed file, or None."""
    parsed_path = PARSED_DIR / f"{pr_number}.json"
    if not parsed_path.exists():
        return None
    try:
        data = json.loads(parsed_path.read_text(encoding="utf-8"))
        return data.get("prompt_version")
    except (json.JSONDecodeError, OSError):
        return None


def parse_pr(client, template, pr_data, prompt_version):
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
    parsed["prompt_version"] = prompt_version
    n_techniques = len(parsed.get("training_techniques", []))
    log.info(
        "PR #%d OK  %.1fs  bpb=%s  techniques=%d  readme=%s  prompt=%s",
        pr_number, elapsed, parsed.get("val_bpb"), n_techniques, has_readme, prompt_version,
    )
    return parsed


def main():
    parser = argparse.ArgumentParser(description="Parse raw PRs into structured data")
    parser.add_argument(
        "--force", action="store_true", help="Re-parse all PRs, even if already parsed"
    )
    parser.add_argument(
        "--reprompt", action="store_true",
        help="Re-parse PRs whose prompt_version differs from the target version"
    )
    parser.add_argument(
        "--prompt-version", type=str, default=None,
        help="Use a specific prompt version (default: latest from manifest)"
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
    prompt_version, template = get_prompt_version_and_template(args.prompt_version)
    client = OpenAI()

    raw_files = sorted(RAW_DIR.glob("*.json"), key=lambda f: int(f.stem))
    existing = {int(f.stem) for f in PARSED_DIR.glob("*.json")}

    if args.force:
        to_parse = list(raw_files)
    elif args.reprompt:
        # Re-parse files whose prompt_version differs from the target
        to_parse = []
        for f in raw_files:
            pr_num = int(f.stem)
            existing_version = get_existing_prompt_version(pr_num)
            if existing_version != prompt_version:
                to_parse.append(f)
    else:
        to_parse = [f for f in raw_files if int(f.stem) not in existing]

    mode = " (--force)" if args.force else " (--reprompt)" if args.reprompt else ""
    log.info(
        "Found %d raw PRs, %d already parsed, %d to parse%s [prompt: %s]",
        len(raw_files), len(existing), len(to_parse), mode, prompt_version,
    )

    parsed_count = 0
    error_count = 0
    t_start = time.time()

    for i, raw_file in enumerate(to_parse, 1):
        pr_number = int(raw_file.stem)
        pr_data = json.loads(raw_file.read_text(encoding="utf-8"))
        log.info("[%d/%d] Parsing PR #%d: %s", i, len(to_parse), pr_number, pr_data["title"][:70])

        try:
            parsed = parse_pr(client, template, pr_data, prompt_version)
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
