#!/usr/bin/env python3
"""
ACE Warmup Script - Analyze existing Claude Code sessions to build initial playbook.

This implements "offline warmup" from the paper (Section 4.2, Table 3):
- Run offline adaptation on training data first to build initial playbook
- Then use that playbook as initialization for online adaptation
- Paper shows ~3.4% improvement from warmup

Usage:
    # Analyze all existing sessions
    ~/.claude/ace/venv/bin/python ~/.claude/ace/warmup.py

    # Analyze only recent sessions (last 7 days)
    ~/.claude/ace/venv/bin/python ~/.claude/ace/warmup.py --days 7

    # Analyze specific project
    ~/.claude/ace/venv/bin/python ~/.claude/ace/warmup.py --project "myproject"

    # Dry run (show what would be analyzed)
    ~/.claude/ace/venv/bin/python ~/.claude/ace/warmup.py --dry-run

    # Limit number of sessions to process
    ~/.claude/ace/venv/bin/python ~/.claude/ace/warmup.py --limit 10

    # Random sample 10% of sessions
    ~/.claude/ace/venv/bin/python ~/.claude/ace/warmup.py --sample 10
"""

import argparse
import os
import random
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

# Add ace directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from ace_pipeline import run_pipeline, parse_transcript, format_for_llm
from db import get_playbook_stats, get_all_bullets


def estimate_tokens(text: str) -> int:
    """Rough token estimate (4 chars per token)."""
    return len(text) // 4


def find_transcripts(
    projects_dir: Path,
    days: int | None = None,
    project_filter: str | None = None,
) -> list[tuple[Path, float]]:
    """
    Find all transcript files, optionally filtered by age or project.

    Returns list of (path, mtime) tuples sorted by modification time (oldest first).
    """
    transcripts = []

    cutoff_time = None
    if days:
        cutoff_time = time.time() - (days * 24 * 60 * 60)

    for jsonl_file in projects_dir.rglob("*.jsonl"):
        # Skip agent files (subagent transcripts)
        if jsonl_file.name.startswith("agent-"):
            continue

        # Filter by project name if specified
        if project_filter:
            if project_filter.lower() not in str(jsonl_file).lower():
                continue

        # Filter by age if specified
        mtime = jsonl_file.stat().st_mtime
        if cutoff_time and mtime < cutoff_time:
            continue

        transcripts.append((jsonl_file, mtime))

    # Sort by modification time (oldest first for chronological processing)
    transcripts.sort(key=lambda x: x[1])

    return transcripts


def extract_cwd_from_path(transcript_path: Path) -> str:
    """
    Extract the original working directory from the transcript path.

    Claude Code stores transcripts in ~/.claude/projects/{encoded-path}/
    where encoded-path is the cwd with slashes replaced by dashes.
    """
    # Get the parent directory name (the encoded project path)
    encoded = transcript_path.parent.name

    # Convert back: "-Users-josh-myproject" -> "/Users/josh/myproject"
    if encoded.startswith("-"):
        # Replace leading dash and internal dashes with slashes
        # But be careful: "my-project" should stay as "my-project"
        # The pattern is: dash followed by capital letter or at start = path separator
        parts = encoded.split("-")
        # First part is empty (from leading dash), rest are path components
        # This is a heuristic - may not be perfect for all paths
        cwd = "/" + "/".join(parts[1:])
    else:
        cwd = "/" + encoded.replace("-", "/")

    return cwd


def run_warmup(
    days: int | None = None,
    project_filter: str | None = None,
    limit: int | None = None,
    sample: int | None = None,
    dry_run: bool = False,
    preview: bool = False,
):
    """Run the warmup process on existing transcripts."""
    projects_dir = Path.home() / ".claude" / "projects"

    if not projects_dir.exists():
        print(f"No projects directory found at {projects_dir}")
        return

    print("=" * 60)
    print("ACE Warmup - Analyzing existing Claude Code sessions")
    print("=" * 60)

    # Find transcripts
    transcripts = find_transcripts(projects_dir, days, project_filter)
    total_found = len(transcripts)

    # Random sampling (applied before limit)
    if sample is not None:
        sample_size = max(1, int(len(transcripts) * sample / 100))
        transcripts = random.sample(transcripts, sample_size)
        # Re-sort by mtime after sampling
        transcripts.sort(key=lambda x: x[1])

    if limit:
        transcripts = transcripts[:limit]

    if sample is not None:
        print(f"\nFound {total_found} transcripts, sampled {len(transcripts)} ({sample}%)")
    else:
        print(f"\nFound {len(transcripts)} transcript(s) to process")

    if not transcripts:
        print("No transcripts found matching criteria.")
        return

    if dry_run or preview:
        total_tokens = 0
        total_messages = 0

        for i, (path, mtime) in enumerate(transcripts, 1):
            mtime_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
            cwd = extract_cwd_from_path(path)

            print(f"\n{'=' * 60}")
            print(f"[{i}/{len(transcripts)}] {path.name}")
            print(f"  Modified: {mtime_str}")
            print(f"  CWD: {cwd}")

            try:
                messages = parse_transcript(str(path))
                formatted = format_for_llm(messages)
                tokens = estimate_tokens(formatted)

                total_messages += len(messages)
                total_tokens += tokens

                # Count message types
                user_msgs = sum(1 for m in messages if m["type"] == "user")
                asst_msgs = sum(1 for m in messages if m["type"] == "assistant")

                print(f"  Messages: {len(messages)} ({user_msgs} user, {asst_msgs} assistant)")
                print(f"  Estimated tokens: {tokens:,}")

                if preview:
                    print(f"\n  --- Formatted transcript preview (first 1500 chars) ---")
                    preview_text = formatted[:1500]
                    if len(formatted) > 1500:
                        preview_text += "\n  [...truncated...]"
                    # Indent the preview
                    for line in preview_text.split("\n"):
                        print(f"  {line}")
                    print(f"  --- End preview ---")

            except Exception as e:
                print(f"  Error reading: {e}")

        print(f"\n{'=' * 60}")
        print(f"Summary")
        print(f"{'=' * 60}")
        print(f"Total transcripts: {len(transcripts)}")
        print(f"Total messages: {total_messages:,}")
        print(f"Total estimated tokens: {total_tokens:,}")
        # Cost estimate based on OpenAI pricing (Jan 2026)
        # GPT-5.2: $1.75/1M input, $14/1M output
        # GPT-5-mini: $0.25/1M input, $2/1M output
        # Assume: 4 stages, ~50% pass triviality, output ~10% of input
        input_tokens = total_tokens * 2.5  # avg stages per transcript
        output_tokens = input_tokens * 0.1
        # Current setup: mini for filter, 5.2 for rest
        filter_input = total_tokens
        main_input = total_tokens * 1.5  # 50% * 3 stages
        cost_input = (filter_input * 0.25 + main_input * 1.75) / 1_000_000
        cost_output = (output_tokens * 14) / 1_000_000  # assume 5.2 output pricing
        print(f"Estimated API cost: ~${cost_input + cost_output:.2f}")
        print(f"\nRun without --dry-run/--preview to process")
        return

    # Get initial stats
    initial_stats = get_playbook_stats()
    print(f"\nInitial playbook: {initial_stats['bullet_count']} bullets")

    # Process each transcript
    processed = 0
    errors = 0
    skipped_trivial = 0

    for i, (transcript_path, mtime) in enumerate(transcripts, 1):
        mtime_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
        print(f"\n[{i}/{len(transcripts)}] Processing {transcript_path.name}")
        print(f"  Modified: {mtime_str}")

        cwd = extract_cwd_from_path(transcript_path)
        print(f"  CWD: {cwd}")

        try:
            # Get bullet count before
            before_count = get_playbook_stats()["bullet_count"]

            # Run the pipeline
            run_pipeline({
                "transcript_path": str(transcript_path),
                "cwd": cwd,
            })

            # Check if bullets were added
            after_count = get_playbook_stats()["bullet_count"]
            added = after_count - before_count

            if added > 0:
                print(f"  ✓ Added {added} bullet(s)")
                processed += 1
            else:
                print(f"  - Skipped (trivial or no insights)")
                skipped_trivial += 1

        except Exception as e:
            print(f"  ✗ Error: {e}")
            errors += 1
            # Continue with next transcript

    # Final summary
    final_stats = get_playbook_stats()

    print("\n" + "=" * 60)
    print("Warmup Complete")
    print("=" * 60)
    print(f"Transcripts processed: {processed}")
    print(f"Skipped (trivial): {skipped_trivial}")
    print(f"Errors: {errors}")
    print(f"\nPlaybook growth: {initial_stats['bullet_count']} → {final_stats['bullet_count']} bullets")
    print(f"Estimated tokens: {final_stats['estimated_tokens']}")

    # Show sample of new bullets
    bullets = get_all_bullets()
    if bullets:
        print(f"\nSample bullets (showing up to 5):")
        for bullet in bullets[:5]:
            content_preview = bullet["content"][:80] + "..." if len(bullet["content"]) > 80 else bullet["content"]
            print(f"  [{bullet['id']}] {content_preview}")


def main():
    parser = argparse.ArgumentParser(
        description="Warm up ACE playbook by analyzing existing Claude Code sessions",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--days",
        type=int,
        help="Only analyze sessions from the last N days",
    )
    parser.add_argument(
        "--project",
        type=str,
        help="Only analyze sessions matching this project name (substring match)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of sessions to process",
    )
    parser.add_argument(
        "--sample",
        type=int,
        metavar="PERCENT",
        help="Randomly sample N%% of sessions (e.g., --sample 10 for 10%%)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show stats for each transcript without processing",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Show formatted transcript content that would be sent to LLM",
    )

    args = parser.parse_args()

    run_warmup(
        days=args.days,
        project_filter=args.project,
        limit=args.limit,
        sample=args.sample,
        dry_run=args.dry_run,
        preview=args.preview,
    )


if __name__ == "__main__":
    main()
