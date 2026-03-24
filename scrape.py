"""Fetch and persist raw PR data from openai/parameter-golf."""

import base64
import json
import os
import sys
import time
from pathlib import Path

import requests

REPO = "openai/parameter-golf"
API_BASE = f"https://api.github.com/repos/{REPO}"
RAW_DIR = Path("data/raw")
README_PATH = Path("data/readme.md")
PER_PAGE = 100


def get_headers():
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        print("Warning: GITHUB_TOKEN not set. Rate limits will be very low.")
    return headers


def fetch_prs(headers):
    """Fetch all PRs (open + closed) with pagination."""
    prs = []
    for state in ("open", "closed"):
        page = 1
        while True:
            resp = requests.get(
                f"{API_BASE}/pulls",
                headers=headers,
                params={
                    "state": state,
                    "per_page": PER_PAGE,
                    "page": page,
                },
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            prs.extend(batch)
            print(f"  Fetched page {page} of {state} PRs ({len(batch)} items)")
            page += 1
    return prs


def fetch_pr_readme(pr, headers):
    """Fetch the submission README.md from the PR's head branch.

    Looks at the PR's changed files, finds any README.md in a records/ folder,
    and fetches its content from the head SHA.
    """
    pr_number = pr["number"]
    head_sha = pr["head"]["sha"]

    # Get list of files changed in this PR
    files = []
    page = 1
    while True:
        resp = requests.get(
            f"{API_BASE}/pulls/{pr_number}/files",
            headers=headers,
            params={"per_page": PER_PAGE, "page": page},
        )
        if resp.status_code == 422:
            # PR too large or unavailable
            return None
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        files.extend(batch)
        page += 1

    # Find README.md files in records/ folders
    readme_path = None
    for f in files:
        fname = f["filename"]
        if fname.lower().endswith("readme.md") and "records/" in fname.lower():
            readme_path = fname
            break

    if not readme_path:
        return None

    # Fetch the file content from the PR's head SHA
    resp = requests.get(
        f"{API_BASE}/contents/{readme_path}",
        headers=headers,
        params={"ref": head_sha},
    )
    if resp.status_code != 200:
        return None

    content = resp.json().get("content")
    if not content:
        return None

    return base64.b64decode(content).decode("utf-8")


def save_pr(pr, headers):
    """Save a single PR as a JSON file, extracting relevant fields."""
    readme = fetch_pr_readme(pr, headers)

    data = {
        "number": pr["number"],
        "title": pr["title"],
        "author": pr["user"]["login"],
        "body": pr.get("body") or "",
        "state": pr["state"],
        "merged": pr.get("merged_at") is not None,
        "labels": [l["name"] for l in pr.get("labels", [])],
        "created_at": pr["created_at"],
        "updated_at": pr["updated_at"],
        "submission_readme": readme,
    }
    path = RAW_DIR / f"{pr['number']}.json"
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    has_readme = "with README" if readme else "no README"
    print(f"    Saved PR #{pr['number']} ({has_readme})")
    return data["number"]


def fetch_repo_readme(headers):
    """Fetch the repo README and save it."""
    resp = requests.get(
        f"{API_BASE}/readme",
        headers=headers,
        params={"ref": "main"},
    )
    resp.raise_for_status()
    content = resp.json()
    readme_text = base64.b64decode(content["content"]).decode("utf-8")
    README_PATH.parent.mkdir(parents=True, exist_ok=True)
    README_PATH.write_text(readme_text, encoding="utf-8")
    print(f"Saved repo README ({len(readme_text)} chars)")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Scrape PRs from openai/parameter-golf")
    parser.add_argument(
        "--limit", type=int, default=0, help="Max number of new PRs to fetch (0 = all)"
    )
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    headers = get_headers()

    # Determine which PRs we already have
    existing = {int(f.stem) for f in RAW_DIR.glob("*.json")}
    print(f"Found {len(existing)} existing PRs on disk")

    # Fetch all PRs
    print("Fetching PRs...")
    prs = fetch_prs(headers)
    print(f"Total PRs from API: {len(prs)}")

    # Save new PRs (includes fetching each PR's submission README)
    new_count = 0
    for pr in prs:
        if pr["number"] not in existing:
            save_pr(pr, headers)
            new_count += 1
            if args.limit and new_count >= args.limit:
                print(f"Reached limit of {args.limit} PRs")
                break

    print(f"Saved {new_count} new PRs (skipped {len(existing)} existing)")

    # Fetch repo README
    print("Fetching repo README...")
    fetch_repo_readme(headers)

    print("Done!")


if __name__ == "__main__":
    main()
