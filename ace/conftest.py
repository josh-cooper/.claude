"""
Pytest configuration for ACE tests.

Sets up the Python path and configures live test markers.
"""

import os
import sys

import pytest

# Add the ace directory to the Python path
ACE_DIR = os.path.dirname(os.path.abspath(__file__))
if ACE_DIR not in sys.path:
    sys.path.insert(0, ACE_DIR)


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "live: mark test as requiring real API calls")


def has_openai_key():
    """Check if OpenAI API key is available."""
    # Load from .env if present
    env_path = os.path.join(ACE_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("OPENAI_API_KEY="):
                    key = line.split("=", 1)[1].strip()
                    if key and not key.startswith("your-"):
                        os.environ["OPENAI_API_KEY"] = key
                        return True
    return bool(os.environ.get("OPENAI_API_KEY"))


def pytest_addoption(parser):
    """Add --run-live command line option."""
    parser.addoption(
        "--run-live",
        action="store_true",
        default=False,
        help="Run live API tests (requires OPENAI_API_KEY)",
    )


def pytest_collection_modifyitems(config, items):
    """Skip live tests unless --run-live flag is passed."""
    if config.getoption("--run-live") and has_openai_key():
        # Run all tests including live
        return

    skip_live = pytest.mark.skip(reason="Need --run-live flag and OPENAI_API_KEY to run")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip_live)
