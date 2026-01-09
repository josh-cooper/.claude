#!/usr/bin/env python3
"""
ACE Pipeline - Main entry point for the Agentic Context Engineering system.

This script is run in the background by run_pipeline.py after each Claude Code turn.
It processes the conversation transcript and updates the playbook with new insights.

Pipeline stages:
0. Triviality Filter - skip trivial conversations
1. Trajectory Reconstructor - reconstruct reasoning from transcript
2. Reflector - extract insights from trajectory
3. Curator - generate delta operations for playbook
"""

import json
import logging
import os
import sys

from dotenv import load_dotenv
import instructor
from openai import OpenAI

# Load environment variables from .env file in the ace directory
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(ENV_PATH)

# Configure logging
# Note: run_pipeline.py redirects stdout to ace.log, so we only use StreamHandler here.
# This avoids duplicate entries when run via the hook.
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ace")

# Suppress noisy HTTP library logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("instructor").setLevel(logging.WARNING)

from db import (
    add_bullet,
    get_bullets_for_path,
    get_playbook_stats,
    format_playbook_for_prompt,
    increment_counter,
)
from models import (
    TrivialityCheck,
    TrajectoryOutput,
    ReflectorOutput,
    CuratorOutput,
    AddOperation,
    IncrementOperation,
)
from prompts import (
    TRIVIALITY_PROMPT,
    TRAJECTORY_PROMPT,
    REFLECTOR_PROMPT,
    CURATOR_PROMPT,
)


# Configuration
FILTER_MODEL = "gpt-5-mini"  # For triviality filter
MAIN_MODEL = "gpt-5.2"  # For main pipeline stages
MAX_REFLECTOR_ROUNDS = 5  # From paper Section 4.2


def parse_transcript(path: str) -> list[dict]:
    """
    Parse JSONL transcript into list of user/assistant messages.

    Skips metadata entries (summary, file-history-snapshot, etc.).
    Only returns messages with type 'user' or 'assistant'.
    Fails loudly on malformed data.
    """
    # Known metadata types that should be skipped (not errors)
    METADATA_TYPES = {"summary", "file-history-snapshot"}

    messages = []
    with open(path) as f:
        for line_num, line in enumerate(f, 1):
            if not line.strip():
                continue

            # Fail on malformed JSON
            try:
                msg = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON on line {line_num}: {e}")

            # Fail if no type field
            if "type" not in msg:
                raise ValueError(f"Message on line {line_num} missing 'type' field: {list(msg.keys())}")

            msg_type = msg["type"]

            # Skip known metadata types
            if msg_type in METADATA_TYPES:
                continue

            # Skip non-conversation message types
            if msg_type not in ("user", "assistant"):
                continue

            # Fail if user/assistant message missing required 'message' field
            if "message" not in msg:
                raise ValueError(f"{msg_type} message on line {line_num} missing 'message' field")

            messages.append(msg)

    return messages


def format_for_llm(messages: list[dict]) -> str:
    """
    Format transcript for LLM prompts.

    Converts the JSONL transcript into a readable format that shows
    user messages, tool calls, and results.
    """
    formatted = []

    for msg in messages:
        msg_type = msg["type"]
        content = msg["message"].get("content", "")

        if msg_type == "user":
            # User messages are simple strings
            if isinstance(content, str):
                formatted.append(f"=== USER ===\n{content}\n")
            else:
                formatted.append(f"=== USER ===\n{json.dumps(content)}\n")

        elif msg_type == "assistant":
            # Assistant messages may have complex content with tool calls
            if isinstance(content, list):
                parts = []
                for block in content:
                    block_type = block.get("type")
                    if block_type == "text":
                        parts.append(block.get("text", ""))
                    elif block_type == "tool_use":
                        tool_name = block.get("name", "unknown")
                        tool_input = block.get("input", {})
                        # Truncate large inputs
                        input_str = json.dumps(tool_input)
                        if len(input_str) > 500:
                            input_str = input_str[:500] + "..."
                        parts.append(f"[TOOL: {tool_name}({input_str})]")
                    elif block_type == "tool_result":
                        result = block.get("content", "")
                        if isinstance(result, str) and len(result) > 500:
                            result = result[:500] + "..."
                        parts.append(f"[RESULT: {result}]")
                content = "\n".join(parts)
            formatted.append(f"=== ASSISTANT ===\n{content}\n")

        # Skip other message types (system, etc.)

    return "\n".join(formatted)


def run_pipeline(hook_input: dict) -> None:
    """
    Run the full ACE pipeline on a conversation transcript.

    Args:
        hook_input: Dict with 'transcript_path', 'cwd', etc.
    """
    # Check for infinite loop prevention
    if hook_input.get("stop_hook_active"):
        logger.warning("Skipping: stop_hook_active is True (preventing infinite loop)")
        return

    # Expand tilde in paths
    transcript_path = os.path.expanduser(hook_input["transcript_path"])
    cwd = os.path.expanduser(hook_input["cwd"])

    logger.info(f"Starting ACE pipeline for transcript: {transcript_path}")
    logger.debug(f"Working directory: {cwd}")

    # Initialize OpenAI client with instructor
    client = instructor.from_openai(OpenAI())

    # Parse and format transcript
    messages = parse_transcript(transcript_path)
    logger.debug(f"Parsed {len(messages)} messages from transcript")

    formatted = format_for_llm(messages)

    # Stage 0: Triviality Filter
    logger.info("Stage 0: Running triviality filter...")
    triviality_check = client.chat.completions.create(
        model=FILTER_MODEL,
        response_model=TrivialityCheck,
        messages=[{"role": "user", "content": TRIVIALITY_PROMPT.format(formatted_transcript=formatted)}],
    )

    if triviality_check.trivial:
        logger.info(f"Skipping trivial conversation: {triviality_check.reason}")
        return

    logger.debug(f"Conversation worth analyzing: {triviality_check.reason}")

    # Stage 1: Trajectory Reconstructor
    logger.info("Stage 1: Running trajectory reconstructor...")
    trajectory = client.chat.completions.create(
        model=MAIN_MODEL,
        response_model=TrajectoryOutput,
        messages=[{"role": "user", "content": TRAJECTORY_PROMPT.format(formatted_transcript=formatted)}],
    )

    logger.debug(f"Reconstructed {len(trajectory.trajectory_points)} trajectory points")

    # Get current playbook for Reflector context
    bullets = get_bullets_for_path(cwd)
    playbook_bullets = format_playbook_for_prompt(bullets)

    # Stage 2: Reflector (with iterative refinement)
    logger.info("Stage 2: Running reflector...")
    trajectory_json = json.dumps([p.model_dump() for p in trajectory.trajectory_points], indent=2)

    reflections = client.chat.completions.create(
        model=MAIN_MODEL,
        response_model=ReflectorOutput,
        messages=[
            {
                "role": "user",
                "content": REFLECTOR_PROMPT.format(
                    trajectory_json=trajectory_json,
                    playbook_bullets=playbook_bullets,
                ),
            }
        ],
    )

    logger.debug(f"Generated {len(reflections.reflections)} reflections, {len(reflections.bullet_feedback)} bullet feedback items")

    # Stage 3: Curator
    logger.info("Stage 3: Running curator...")
    stats = get_playbook_stats()
    reflections_json = json.dumps(
        {
            "reflections": [r.model_dump() for r in reflections.reflections],
            "bullet_feedback": [bf.model_dump() for bf in reflections.bullet_feedback],
        },
        indent=2,
    )

    curator_output = client.chat.completions.create(
        model=MAIN_MODEL,
        response_model=CuratorOutput,
        messages=[
            {
                "role": "user",
                "content": CURATOR_PROMPT.format(
                    cwd=cwd,
                    bullet_count=stats["bullet_count"],
                    estimated_tokens=stats["estimated_tokens"],
                    playbook_bullets=playbook_bullets,
                    reflections_json=reflections_json,
                ),
            }
        ],
    )

    logger.debug(f"Curator reasoning: {curator_output.reasoning}")
    logger.debug(f"Generated {len(curator_output.operations)} operations")

    # Apply delta operations
    for op in curator_output.operations:
        if isinstance(op, AddOperation):
            bullet_id = add_bullet(op.section, op.path, op.content)
            logger.info(f"Added bullet {bullet_id}: {op.content[:50]}...")
        elif isinstance(op, IncrementOperation):
            increment_counter(op.bullet_id, op.field)
            logger.info(f"Incremented {op.field} on {op.bullet_id}")

    logger.info("Pipeline completed successfully")


def main() -> None:
    """Main entry point - reads hook input from stdin and runs pipeline."""
    try:
        hook_input = json.load(sys.stdin)
        run_pipeline(hook_input)
    except Exception:
        # Log full traceback for debugging
        logger.exception("Pipeline failed with error")
        # Re-raise to ensure non-zero exit code
        raise


if __name__ == "__main__":
    main()
