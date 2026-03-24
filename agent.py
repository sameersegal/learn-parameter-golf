"""Interactive Q&A agent over parsed Parameter Golf submission data."""

import json
from pathlib import Path

from openai import OpenAI

PARSED_DIR = Path("data/parsed")
README_PATH = Path("data/readme.md")
MODEL = "gpt-4.1-mini"

SYSTEM_PROMPT = """You are an expert analyst for the "Parameter Golf" competition (openai/parameter-golf).

In this competition, participants submit solutions that try to achieve the lowest validation bits-per-byte (BPB) on a language modeling task while keeping the total artifact size (model + code) as small as possible.

You have access to all parsed submission data below. Answer questions about strategies, trends, results, comparisons, and insights. Be specific and cite PR numbers when relevant.

## Repository README
{readme}

## Parsed Submissions
{submissions}
"""


def load_data():
    """Load all parsed submissions and the README."""
    submissions = []
    for f in sorted(PARSED_DIR.glob("*.json"), key=lambda f: int(f.stem)):
        submissions.append(json.loads(f.read_text(encoding="utf-8")))

    readme = ""
    if README_PATH.exists():
        readme = README_PATH.read_text(encoding="utf-8")

    return submissions, readme


def main():
    client = OpenAI()
    submissions, readme = load_data()

    if not submissions:
        print("No parsed submissions found. Run scrape.py and parse.py first.")
        return

    print(f"Loaded {len(submissions)} submissions. Type 'quit' to exit.\n")

    system_msg = SYSTEM_PROMPT.format(
        readme=readme,
        submissions=json.dumps(submissions, indent=2),
    )

    conversation = [{"role": "system", "content": system_msg}]

    while True:
        try:
            question = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not question:
            continue
        if question.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        conversation.append({"role": "user", "content": question})

        response = client.responses.create(
            model=MODEL,
            instructions=system_msg,
            input=conversation[1:],  # skip system, use instructions instead
        )

        answer = response.output_text
        print(f"\nAssistant: {answer}\n")

        conversation.append({"role": "assistant", "content": answer})


if __name__ == "__main__":
    main()
