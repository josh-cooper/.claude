#!/usr/bin/env python3
"""
ACE Hook Wrapper - Entry point for the Stop hook.

This script:
1. Reads hook input from stdin immediately
2. Spawns the main pipeline in the background
3. Returns {"decision": "approve"} immediately so Claude Code continues

The background pipeline writes to ~/.claude/playbooks/ace.log for debugging.
"""

import json
import os
import subprocess
import sys


def main() -> None:
    # Read hook input immediately
    hook_input = json.load(sys.stdin)

    # Ensure log directory exists
    log_path = os.path.expanduser("~/.claude/playbooks/ace.log")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)

    # Spawn background process with the data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pipeline_script = os.path.join(script_dir, "ace_pipeline.py")
    # Use the venv Python to ensure packages are available
    venv_python = os.path.join(script_dir, "venv", "bin", "python")

    proc = subprocess.Popen(
        [venv_python, pipeline_script],
        stdin=subprocess.PIPE,
        stdout=open(log_path, "a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,  # Detach from parent
    )
    proc.stdin.write(json.dumps(hook_input).encode())
    proc.stdin.close()

    # Return immediately so Claude Code continues
    print(json.dumps({"decision": "approve"}))


if __name__ == "__main__":
    main()
