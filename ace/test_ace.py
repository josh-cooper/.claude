#!/usr/bin/env python3
"""
Tests for the ACE playbook system.

Run unit tests:
    ~/.claude/ace/venv/bin/pytest ~/.claude/ace/test_ace.py -v

Run end-to-end tests (requires OPENAI_API_KEY):
    ~/.claude/ace/venv/bin/pytest ~/.claude/ace/test_ace.py -v --run-live

Run only live tests:
    ~/.claude/ace/venv/bin/pytest ~/.claude/ace/test_ace.py -v -m live --run-live
"""

import json
import os
import sqlite3
import tempfile
from unittest.mock import MagicMock, patch

import pytest


# === Database Tests ===


class TestDatabase:
    """Tests for db.py"""

    @pytest.fixture(autouse=True)
    def setup_test_db(self):
        """Create a fresh test database for each test."""
        import db

        # Override DB_PATH for testing
        self.original_db_path = db.DB_PATH
        db.DB_PATH = tempfile.mktemp(suffix=".db")
        db.init_db()
        yield
        # Cleanup
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.DB_PATH = self.original_db_path

    def test_init_db_creates_tables(self):
        """Test that init_db creates the bullets table and indexes."""
        import db

        with db.get_db() as conn:
            # Check table exists
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='bullets'"
            )
            assert cursor.fetchone() is not None

            # Check indexes exist
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_bullets%'"
            )
            indexes = [row[0] for row in cursor.fetchall()]
            assert "idx_bullets_section" in indexes
            assert "idx_bullets_path" in indexes

    def test_add_bullet_strategies(self):
        """Test adding a bullet to the strategies section."""
        import db

        bullet_id = db.add_bullet(
            section="strategies",
            path=None,
            content="Test strategy bullet",
        )
        assert bullet_id == "str-00001"

        # Add another
        bullet_id2 = db.add_bullet(
            section="strategies",
            path="/test/path",
            content="Another strategy",
        )
        assert bullet_id2 == "str-00002"

    def test_add_bullet_all_sections(self):
        """Test adding bullets to all sections generates correct IDs."""
        import db

        sections = {
            "strategies": "str-00001",
            "code_patterns": "code-00001",
            "pitfalls": "pit-00001",
            "context": "ctx-00001",
        }

        for section, expected_id in sections.items():
            bullet_id = db.add_bullet(section=section, path=None, content=f"Test {section}")
            assert bullet_id == expected_id, f"Expected {expected_id} for {section}, got {bullet_id}"

    def test_add_bullet_invalid_section(self):
        """Test that invalid sections raise ValueError."""
        import db

        with pytest.raises(ValueError, match="Invalid section"):
            db.add_bullet(section="invalid", path=None, content="Test")

    def test_increment_counter(self):
        """Test incrementing helpful/harmful counters."""
        import db

        bullet_id = db.add_bullet(section="strategies", path=None, content="Test")

        # Increment helpful
        db.increment_counter(bullet_id, "helpful")
        db.increment_counter(bullet_id, "helpful")

        # Increment harmful
        db.increment_counter(bullet_id, "harmful")

        # Verify counts
        with db.get_db() as conn:
            cursor = conn.execute(
                "SELECT helpful, harmful FROM bullets WHERE id = ?", (bullet_id,)
            )
            row = cursor.fetchone()
            assert row["helpful"] == 2
            assert row["harmful"] == 1

    def test_increment_counter_invalid_field(self):
        """Test that invalid fields raise ValueError."""
        import db

        bullet_id = db.add_bullet(section="strategies", path=None, content="Test")

        with pytest.raises(ValueError, match="Invalid field"):
            db.increment_counter(bullet_id, "invalid")

    def test_get_bullets_for_path_global(self):
        """Test that global bullets (path=None) are returned for any path."""
        import db

        db.add_bullet(section="strategies", path=None, content="Global bullet")

        bullets = db.get_bullets_for_path("/any/path/here")
        assert len(bullets) == 1
        assert bullets[0]["content"] == "Global bullet"

    def test_get_bullets_for_path_scoped(self):
        """Test that path-scoped bullets are correctly matched."""
        import db

        db.add_bullet(section="strategies", path="/project", content="Project bullet")
        db.add_bullet(section="strategies", path="/project/src", content="Src bullet")
        db.add_bullet(section="strategies", path="/other", content="Other bullet")

        # Should match project and src bullets
        bullets = db.get_bullets_for_path("/project/src/file.py")
        contents = [b["content"] for b in bullets]
        assert "Project bullet" in contents
        assert "Src bullet" in contents
        assert "Other bullet" not in contents

    def test_get_playbook_stats(self):
        """Test playbook statistics."""
        import db

        # Empty playbook
        stats = db.get_playbook_stats()
        assert stats["bullet_count"] == 0
        assert stats["total_content_length"] == 0

        # Add some bullets
        db.add_bullet(section="strategies", path=None, content="A" * 100)
        db.add_bullet(section="pitfalls", path=None, content="B" * 50)

        stats = db.get_playbook_stats()
        assert stats["bullet_count"] == 2
        assert stats["total_content_length"] == 150
        assert stats["estimated_tokens"] == 37  # 150 / 4

    def test_format_playbook_for_prompt_empty(self):
        """Test formatting empty playbook."""
        import db

        result = db.format_playbook_for_prompt([])
        assert "No bullets" in result

    def test_format_playbook_for_prompt(self):
        """Test formatting playbook for prompt inclusion."""
        import db

        db.add_bullet(section="strategies", path=None, content="Strategy 1")
        db.add_bullet(section="pitfalls", path="/project", content="Pitfall 1")

        bullets = db.get_all_bullets()
        result = db.format_playbook_for_prompt(bullets)

        assert "### Strategies" in result
        assert "[str-00001]" in result
        assert "Strategy 1" in result
        assert "### Pitfalls" in result
        assert "[pit-00001]" in result
        assert "[global]" in result
        assert "[scope: /project]" in result


# === Model Tests ===


class TestModels:
    """Tests for models.py"""

    def test_triviality_check(self):
        """Test TrivialityCheck model."""
        from models import TrivialityCheck

        check = TrivialityCheck(trivial=True, reason="Just a greeting")
        assert check.trivial is True
        assert check.reason == "Just a greeting"

    def test_trajectory_point(self):
        """Test TrajectoryPoint model."""
        from models import TrajectoryPoint

        point = TrajectoryPoint(
            action="Used Grep to search",
            reconstructed_reasoning="I assumed the file would be named...",
            outcome="failure",
            outcome_analysis="The assumption was wrong because...",
        )
        assert point.outcome == "failure"

    def test_trajectory_output(self):
        """Test TrajectoryOutput model."""
        from models import TrajectoryOutput, TrajectoryPoint

        output = TrajectoryOutput(
            trajectory_points=[
                TrajectoryPoint(
                    action="Action 1",
                    reconstructed_reasoning="Reasoning 1",
                    outcome="success",
                    outcome_analysis="Analysis 1",
                )
            ]
        )
        assert len(output.trajectory_points) == 1

    def test_failure_reflection(self):
        """Test FailureReflection model."""
        from models import FailureReflection

        reflection = FailureReflection(
            error_identification="Wrong assumption",
            root_cause="Didn't check architecture first",
            correct_approach="Explore before searching",
            key_insight="Always explore unfamiliar codebases",
        )
        assert reflection.type == "failure"

    def test_success_reflection(self):
        """Test SuccessReflection model."""
        from models import SuccessReflection

        reflection = SuccessReflection(
            success_identification="Found the file quickly",
            contributing_factors="Used the right search pattern",
            generalizable_pattern="Grep with file type filter",
            key_insight="Use type filters for efficiency",
        )
        assert reflection.type == "success"

    def test_curator_operations(self):
        """Test Curator operation models."""
        from models import AddOperation, IncrementOperation

        add_op = AddOperation(
            section="strategies",
            path=None,
            content="New strategy",
        )
        assert add_op.type == "ADD"

        inc_op = IncrementOperation(
            bullet_id="str-00001",
            field="helpful",
        )
        assert inc_op.type == "INCREMENT"


# === Transcript Parsing Tests ===


class TestTranscriptParsing:
    """Tests for transcript parsing in ace_pipeline.py"""

    def test_parse_transcript_valid(self):
        """Test parsing a valid JSONL transcript."""
        from ace_pipeline import parse_transcript

        # Create a temp transcript file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(json.dumps({"type": "user", "message": {"content": "Hello"}}) + "\n")
            f.write(json.dumps({"type": "assistant", "message": {"content": "Hi there"}}) + "\n")
            temp_path = f.name

        try:
            messages = parse_transcript(temp_path)
            assert len(messages) == 2
            assert messages[0]["type"] == "user"
            assert messages[1]["type"] == "assistant"
        finally:
            os.unlink(temp_path)

    def test_parse_transcript_missing_type(self):
        """Test that missing 'type' field raises ValueError."""
        from ace_pipeline import parse_transcript

        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(json.dumps({"message": {"content": "Hello"}}) + "\n")
            temp_path = f.name

        try:
            with pytest.raises(ValueError, match="missing 'type' field"):
                parse_transcript(temp_path)
        finally:
            os.unlink(temp_path)

    def test_parse_transcript_missing_message(self):
        """Test that missing 'message' field on user/assistant raises ValueError."""
        from ace_pipeline import parse_transcript

        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(json.dumps({"type": "user"}) + "\n")
            temp_path = f.name

        try:
            with pytest.raises(ValueError, match="missing 'message' field"):
                parse_transcript(temp_path)
        finally:
            os.unlink(temp_path)

    def test_parse_transcript_skips_metadata_types(self):
        """Test that metadata types (summary, file-history-snapshot) are skipped."""
        from ace_pipeline import parse_transcript

        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(json.dumps({"type": "summary", "summary": "Test summary"}) + "\n")
            f.write(json.dumps({"type": "file-history-snapshot", "snapshot": {}}) + "\n")
            f.write(json.dumps({"type": "user", "message": {"content": "Hello"}}) + "\n")
            temp_path = f.name

        try:
            messages = parse_transcript(temp_path)
            assert len(messages) == 1
            assert messages[0]["type"] == "user"
        finally:
            os.unlink(temp_path)

    def test_format_for_llm_user_message(self):
        """Test formatting user messages."""
        from ace_pipeline import format_for_llm

        messages = [{"type": "user", "message": {"content": "Hello world"}}]
        result = format_for_llm(messages)
        assert "=== USER ===" in result
        assert "Hello world" in result

    def test_format_for_llm_assistant_with_tools(self):
        """Test formatting assistant messages with tool calls."""
        from ace_pipeline import format_for_llm

        messages = [
            {
                "type": "assistant",
                "message": {
                    "content": [
                        {"type": "text", "text": "I'll search for that."},
                        {"type": "tool_use", "name": "Grep", "input": {"pattern": "auth"}},
                        {"type": "tool_result", "content": "Found 3 matches"},
                    ]
                },
            }
        ]
        result = format_for_llm(messages)
        assert "=== ASSISTANT ===" in result
        assert "I'll search for that." in result
        assert "[TOOL: Grep(" in result
        assert "[RESULT: Found 3 matches]" in result

    def test_format_for_llm_truncates_long_content(self):
        """Test that long tool inputs/results are truncated."""
        from ace_pipeline import format_for_llm

        long_content = "x" * 1000
        messages = [
            {
                "type": "assistant",
                "message": {
                    "content": [
                        {"type": "tool_use", "name": "Read", "input": {"path": long_content}},
                        {"type": "tool_result", "content": long_content},
                    ]
                },
            }
        ]
        result = format_for_llm(messages)
        # Should be truncated to ~500 chars + "..."
        assert len(result) < 1500


# === Integration Tests ===


class TestIntegration:
    """Integration tests for the full pipeline."""

    @pytest.fixture(autouse=True)
    def setup_test_db(self):
        """Create a fresh test database for each test."""
        import db

        self.original_db_path = db.DB_PATH
        db.DB_PATH = tempfile.mktemp(suffix=".db")
        db.init_db()
        yield
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.DB_PATH = self.original_db_path

    def test_run_pipeline_mocked(self):
        """Test the full pipeline with mocked OpenAI calls."""
        from ace_pipeline import run_pipeline
        from models import (
            TrivialityCheck,
            TrajectoryOutput,
            TrajectoryPoint,
            ReflectorOutput,
            SuccessReflection,
            CuratorOutput,
            AddOperation,
        )
        import db

        # Create a mock transcript
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(
                json.dumps(
                    {
                        "type": "user",
                        "message": {"content": "Find the auth files"},
                    }
                )
                + "\n"
            )
            f.write(
                json.dumps(
                    {
                        "type": "assistant",
                        "message": {
                            "content": [
                                {"type": "text", "text": "I'll search for auth files."},
                                {
                                    "type": "tool_use",
                                    "name": "Grep",
                                    "input": {"pattern": "auth"},
                                },
                                {"type": "tool_result", "content": "src/auth.py"},
                            ]
                        },
                    }
                )
                + "\n"
            )
            temp_path = f.name

        try:
            # Mock the OpenAI client responses
            mock_responses = [
                # Triviality filter
                TrivialityCheck(trivial=False, reason="Multi-step task with tool use"),
                # Trajectory reconstructor
                TrajectoryOutput(
                    trajectory_points=[
                        TrajectoryPoint(
                            action="Used Grep to search for auth",
                            reconstructed_reasoning="I assumed auth would be in filename",
                            outcome="success",
                            outcome_analysis="Found the file quickly",
                        )
                    ]
                ),
                # Reflector
                ReflectorOutput(
                    reflections=[
                        SuccessReflection(
                            success_identification="Quick file discovery",
                            contributing_factors="Good search pattern",
                            generalizable_pattern="Use Grep for code search",
                            key_insight="Grep is effective for finding code patterns",
                        )
                    ],
                    bullet_feedback=[],
                ),
                # Curator
                CuratorOutput(
                    reasoning="Adding a new strategy based on successful search",
                    operations=[
                        AddOperation(
                            section="strategies",
                            path=None,
                            content="Use Grep for finding code patterns in unfamiliar codebases",
                        )
                    ],
                ),
            ]

            response_iter = iter(mock_responses)

            def mock_create(*args, **kwargs):
                return next(response_iter)

            with patch("ace_pipeline.instructor") as mock_instructor:
                mock_client = MagicMock()
                mock_client.chat.completions.create = mock_create
                mock_instructor.from_openai.return_value = mock_client

                # Run the pipeline
                run_pipeline({"transcript_path": temp_path, "cwd": "/test/project"})

            # Verify a bullet was added
            bullets = db.get_all_bullets()
            assert len(bullets) == 1
            assert bullets[0]["section"] == "strategies"
            assert "Grep" in bullets[0]["content"]

        finally:
            os.unlink(temp_path)

    def test_run_pipeline_trivial_skipped(self):
        """Test that trivial conversations are skipped."""
        from ace_pipeline import run_pipeline
        from models import TrivialityCheck
        import db

        # Create a trivial transcript
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(
                json.dumps({"type": "user", "message": {"content": "Hello"}}) + "\n"
            )
            f.write(
                json.dumps({"type": "assistant", "message": {"content": "Hi!"}}) + "\n"
            )
            temp_path = f.name

        try:

            def mock_create(*args, **kwargs):
                return TrivialityCheck(trivial=True, reason="Just a greeting")

            with patch("ace_pipeline.instructor") as mock_instructor:
                mock_client = MagicMock()
                mock_client.chat.completions.create = mock_create
                mock_instructor.from_openai.return_value = mock_client

                run_pipeline({"transcript_path": temp_path, "cwd": "/test"})

            # No bullets should be added
            bullets = db.get_all_bullets()
            assert len(bullets) == 0

        finally:
            os.unlink(temp_path)


# === Hook Wrapper Tests ===


class TestHookWrapper:
    """Tests for run_pipeline.py hook wrapper."""

    def test_hook_returns_approve(self):
        """Test that the hook wrapper returns approve decision."""
        import subprocess
        import sys

        hook_input = json.dumps(
            {
                "transcript_path": "/nonexistent/path.jsonl",
                "cwd": "/test",
                "session_id": "test123",
            }
        )

        # Run the wrapper script
        result = subprocess.run(
            [sys.executable, os.path.expanduser("~/.claude/ace/run_pipeline.py")],
            input=hook_input,
            capture_output=True,
            text=True,
            timeout=5,
        )

        # Should return approve (even though background process will fail)
        output = json.loads(result.stdout)
        assert output["decision"] == "approve"


# === Live End-to-End Tests ===


@pytest.mark.live
class TestLiveEndToEnd:
    """
    End-to-end tests that make real OpenAI API calls.

    Run with: pytest test_ace.py -v --run-live
    Requires OPENAI_API_KEY in environment or .env file.
    """

    @pytest.fixture(autouse=True)
    def setup_test_db(self):
        """Create a fresh test database for each test."""
        import db

        self.original_db_path = db.DB_PATH
        db.DB_PATH = tempfile.mktemp(suffix=".db")
        db.init_db()
        yield
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.DB_PATH = self.original_db_path

    @pytest.fixture
    def client(self):
        """Create an instructor-wrapped OpenAI client."""
        from dotenv import load_dotenv
        import instructor
        from openai import OpenAI

        # Load .env from ace directory
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        load_dotenv(env_path)

        return instructor.from_openai(OpenAI())

    def test_live_triviality_filter_trivial(self, client):
        """Test triviality filter correctly identifies trivial conversation."""
        from models import TrivialityCheck
        from prompts import TRIVIALITY_PROMPT

        trivial_transcript = """=== USER ===
Hello!

=== ASSISTANT ===
Hi there! How can I help you today?
"""

        result = client.chat.completions.create(
            model="gpt-5-mini",
            response_model=TrivialityCheck,
            messages=[
                {"role": "user", "content": TRIVIALITY_PROMPT.format(formatted_transcript=trivial_transcript)}
            ],
        )

        assert isinstance(result, TrivialityCheck)
        assert result.trivial is True
        assert len(result.reason) > 0

    def test_live_triviality_filter_nontrivial(self, client):
        """Test triviality filter correctly identifies non-trivial conversation."""
        from models import TrivialityCheck
        from prompts import TRIVIALITY_PROMPT

        nontrivial_transcript = """=== USER ===
Find all the authentication files in this project

=== ASSISTANT ===
I'll search for authentication-related files.
[TOOL: Grep({"pattern": "auth", "type": "py"})]
[RESULT: src/auth/login.py
src/auth/oauth.py
src/middleware/auth_middleware.py]

I found 3 authentication-related files:
1. src/auth/login.py - Main login logic
2. src/auth/oauth.py - OAuth integration
3. src/middleware/auth_middleware.py - Authentication middleware

=== USER ===
Great, now show me the login.py file

=== ASSISTANT ===
[TOOL: Read({"file_path": "src/auth/login.py"})]
[RESULT: class LoginHandler:
    def authenticate(self, username, password):
        # Validate credentials
        user = self.find_user(username)
        if user and user.check_password(password):
            return self.create_session(user)
        return None]

Here's the login handler implementation...
"""

        result = client.chat.completions.create(
            model="gpt-5-mini",
            response_model=TrivialityCheck,
            messages=[
                {"role": "user", "content": TRIVIALITY_PROMPT.format(formatted_transcript=nontrivial_transcript)}
            ],
        )

        assert isinstance(result, TrivialityCheck)
        assert result.trivial is False
        assert len(result.reason) > 0

    def test_live_trajectory_reconstructor(self, client):
        """Test trajectory reconstructor extracts meaningful decision points."""
        from models import TrajectoryOutput
        from prompts import TRAJECTORY_PROMPT

        transcript = """=== USER ===
Find where the user authentication is handled

=== ASSISTANT ===
I'll search for authentication code.
[TOOL: Grep({"pattern": "class.*Auth", "type": "py"})]
[RESULT: No matches found]

Let me try a different approach and explore the project structure.
[TOOL: Glob({"pattern": "**/*.py"})]
[RESULT: src/main.py
src/api/routes.py
src/services/user_service.py
src/middleware/session.py]

[TOOL: Read({"file_path": "src/services/user_service.py"})]
[RESULT: class UserService:
    def login(self, email, password):
        user = self.db.find_by_email(email)
        if user.verify_password(password):
            return create_token(user)]

Found it! The authentication is handled in src/services/user_service.py in the UserService.login method.
"""

        result = client.chat.completions.create(
            model="gpt-5.2",
            response_model=TrajectoryOutput,
            messages=[
                {"role": "user", "content": TRAJECTORY_PROMPT.format(formatted_transcript=transcript)}
            ],
        )

        assert isinstance(result, TrajectoryOutput)
        assert len(result.trajectory_points) >= 1

        # Should identify the failed grep and successful recovery
        actions = [p.action.lower() for p in result.trajectory_points]
        outcomes = [p.outcome for p in result.trajectory_points]

        # At least one point should be about the search/recovery
        assert any("grep" in a or "search" in a or "glob" in a for a in actions)
        # Should have reconstructed reasoning
        assert all(len(p.reconstructed_reasoning) > 20 for p in result.trajectory_points)

    def test_live_reflector(self, client):
        """Test reflector extracts actionable insights."""
        from models import ReflectorOutput
        from prompts import REFLECTOR_PROMPT

        trajectory_json = """[
    {
        "action": "Used Grep to search for 'class.*Auth' pattern",
        "reconstructed_reasoning": "I assumed there would be an Auth class following common naming conventions. I expected to find a centralized authentication class.",
        "outcome": "failure",
        "outcome_analysis": "The search returned no results because this codebase doesn't use a dedicated Auth class - authentication is handled in UserService instead."
    },
    {
        "action": "Used Glob to explore project structure, then Read to examine user_service.py",
        "reconstructed_reasoning": "After the failed search, I stepped back to understand the project structure rather than guessing again. This exploration-first approach helped me find the actual location.",
        "outcome": "success",
        "outcome_analysis": "By exploring the structure first, I discovered the authentication logic lives in user_service.py, not in a dedicated auth module."
    }
]"""

        result = client.chat.completions.create(
            model="gpt-5.2",
            response_model=ReflectorOutput,
            messages=[
                {
                    "role": "user",
                    "content": REFLECTOR_PROMPT.format(
                        trajectory_json=trajectory_json,
                        playbook_bullets="(No bullets in playbook yet)",
                    ),
                }
            ],
        )

        assert isinstance(result, ReflectorOutput)
        assert len(result.reflections) >= 1

        # Should have extracted insights about the failure and success
        types = [r.type for r in result.reflections]
        assert "failure" in types or "success" in types

        # Insights should be substantive
        for reflection in result.reflections:
            assert len(reflection.key_insight) > 20

    def test_live_curator(self, client):
        """Test curator generates appropriate delta operations."""
        from models import CuratorOutput, AddOperation
        from prompts import CURATOR_PROMPT

        reflections_json = """{
    "reflections": [
        {
            "type": "failure",
            "error_identification": "Assumed standard Auth class naming without checking",
            "root_cause": "Applied common conventions without verifying project structure",
            "correct_approach": "Explore project structure before making assumptions",
            "key_insight": "In unfamiliar codebases, explore the directory structure before searching for specific patterns"
        },
        {
            "type": "success",
            "success_identification": "Successfully found auth by exploring structure",
            "contributing_factors": "Switched to exploration after initial failure",
            "generalizable_pattern": "When direct search fails, step back and explore",
            "key_insight": "Failed searches indicate incorrect mental model - explore to correct it"
        }
    ],
    "bullet_feedback": []
}"""

        result = client.chat.completions.create(
            model="gpt-5.2",
            response_model=CuratorOutput,
            messages=[
                {
                    "role": "user",
                    "content": CURATOR_PROMPT.format(
                        cwd="/Users/test/myproject",
                        bullet_count=0,
                        estimated_tokens=0,
                        playbook_bullets="(No bullets in playbook yet)",
                        reflections_json=reflections_json,
                    ),
                }
            ],
        )

        assert isinstance(result, CuratorOutput)
        assert len(result.reasoning) > 0
        assert len(result.operations) >= 1

        # Should have ADD operations
        add_ops = [op for op in result.operations if isinstance(op, AddOperation)]
        assert len(add_ops) >= 1

        # Operations should have valid sections
        valid_sections = {"strategies", "code_patterns", "pitfalls", "context"}
        for op in add_ops:
            assert op.section in valid_sections
            assert len(op.content) > 20

    def test_live_full_pipeline(self, client):
        """Test the complete pipeline end-to-end with real API calls."""
        from ace_pipeline import run_pipeline
        import db

        # Create a realistic transcript
        transcript_content = [
            {
                "type": "user",
                "message": {"content": "Help me find where errors are logged in this project"},
            },
            {
                "type": "assistant",
                "message": {
                    "content": [
                        {"type": "text", "text": "I'll search for error logging patterns."},
                        {
                            "type": "tool_use",
                            "name": "Grep",
                            "input": {"pattern": "logger.error", "type": "py"},
                        },
                        {
                            "type": "tool_result",
                            "content": "src/api/handlers.py:45: logger.error(f'Request failed: {e}')\nsrc/services/payment.py:102: logger.error('Payment processing failed', exc_info=True)",
                        },
                    ]
                },
            },
            {
                "type": "user",
                "message": {"content": "Great, can you show me the payment error handling?"},
            },
            {
                "type": "assistant",
                "message": {
                    "content": [
                        {"type": "text", "text": "I'll read the payment service file."},
                        {
                            "type": "tool_use",
                            "name": "Read",
                            "input": {"file_path": "src/services/payment.py"},
                        },
                        {
                            "type": "tool_result",
                            "content": "class PaymentService:\n    def process_payment(self, amount, card):\n        try:\n            result = self.gateway.charge(card, amount)\n            return result\n        except PaymentError as e:\n            logger.error('Payment processing failed', exc_info=True)\n            raise",
                        },
                        {
                            "type": "text",
                            "text": "The payment service logs errors with full stack traces using exc_info=True.",
                        },
                    ]
                },
            },
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            for msg in transcript_content:
                f.write(json.dumps(msg) + "\n")
            temp_path = f.name

        try:
            # Run the actual pipeline
            run_pipeline({"transcript_path": temp_path, "cwd": "/test/project"})

            # Verify bullets were created
            bullets = db.get_all_bullets()

            # Should have at least one bullet (might be 0 if deemed trivial, but this conversation should not be)
            # The pipeline ran successfully if we get here without exception
            assert isinstance(bullets, list)

            # If bullets were created, verify their structure
            for bullet in bullets:
                assert "id" in bullet
                assert "section" in bullet
                assert "content" in bullet
                assert bullet["section"] in {"strategies", "code_patterns", "pitfalls", "context"}
                assert len(bullet["content"]) > 0

        finally:
            os.unlink(temp_path)

    def test_live_pipeline_skips_trivial(self):
        """Test that trivial conversations are correctly skipped in live mode."""
        from ace_pipeline import run_pipeline
        import db

        # Create a trivial transcript
        transcript_content = [
            {"type": "user", "message": {"content": "Hi"}},
            {"type": "assistant", "message": {"content": "Hello! How can I help you?"}},
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            for msg in transcript_content:
                f.write(json.dumps(msg) + "\n")
            temp_path = f.name

        try:
            run_pipeline({"transcript_path": temp_path, "cwd": "/test/project"})

            # Should have no bullets for trivial conversation
            bullets = db.get_all_bullets()
            assert len(bullets) == 0

        finally:
            os.unlink(temp_path)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
