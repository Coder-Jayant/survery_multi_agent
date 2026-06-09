"""
cli.py
-------
Command-line interface for MiniSense.

Usage:
    python cli.py --question "What are the top complaints this month?"
    python cli.py --question "How does CSAT compare between April and May?" --verbose
    python cli.py  # Uses a default demo question
"""

import argparse
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agents.orchestrator import ask

DEMO_QUESTIONS = [
    "What are the top 3 complaints in May 2026 and how do they compare to April?",
    "What is the current CSAT score and how does it compare to our target?",
    "Which survey channel has the most responses this month?",
]


def print_answer(answer) -> None:
    print("\n" + "=" * 65)
    print("📊 MiniSense Answer")
    print("=" * 65)
    print(f"\n❓ Question: {answer.question}\n")
    print(f"📝 Answer:\n{answer.narrative}\n")

    if answer.supporting_data:
        print("📈 Key Metrics:")
        for k, v in answer.supporting_data.items():
            if isinstance(v, list):
                print(f"   {k}: {', '.join(v) if v else 'none'}")
            elif isinstance(v, float):
                print(f"   {k}: {v:+.2f}" if "delta" in k else f"   {k}: {v:.2f}")
            else:
                print(f"   {k}: {v}")

    if answer.sources:
        print(f"\n📚 Sources: {', '.join(answer.sources)}")

    print(f"\n🤖 Agent trace: {' -> '.join(answer.agent_trace)}")
    print("=" * 65 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="MiniSense — Survey Analysis Agent CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="\nExample questions:\n" + "\n".join(f"  • {q}" for q in DEMO_QUESTIONS),
    )
    parser.add_argument(
        "--question", "-q",
        type=str,
        default=None,
        help="Business question to answer (uses demo question if omitted)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show agent execution trace",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run all demo questions sequentially",
    )

    args = parser.parse_args()

    if not os.environ.get("GROQ_API_KEY"):
        print("[ERROR] Error: GROQ_API_KEY not set. Copy .env.example to .env and add your key.")
        sys.exit(1)

    if args.demo:
        for q in DEMO_QUESTIONS:
            print(f"\n🔄 Running: {q}")
            answer = ask(q, verbose=args.verbose)
            print_answer(answer)
        return

    question = args.question or DEMO_QUESTIONS[0]
    answer = ask(question, verbose=args.verbose)
    print_answer(answer)


if __name__ == "__main__":
    main()
