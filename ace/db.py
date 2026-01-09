"""
SQLite database operations for ACE playbook storage.

Handles concurrent access from multiple Claude Code sessions.
Location: ~/.claude/playbooks/ace.db
"""

import os
import sqlite3
from contextlib import contextmanager
from typing import Generator

DB_PATH = os.path.expanduser("~/.claude/playbooks/ace.db")

# Section to ID prefix mapping
SECTION_PREFIXES = {
    "strategies": "str",
    "code_patterns": "code",
    "pitfalls": "pit",
    "context": "ctx",
}


def init_db() -> None:
    """Initialize the database schema if it doesn't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bullets (
                id TEXT PRIMARY KEY,
                section TEXT NOT NULL,
                path TEXT,
                helpful INTEGER DEFAULT 0,
                harmful INTEGER DEFAULT 0,
                created TEXT NOT NULL,
                content TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bullets_section ON bullets(section)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bullets_path ON bullets(path)")
        conn.commit()


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def add_bullet(section: str, path: str | None, content: str) -> str:
    """
    Add a new bullet to the playbook.

    Args:
        section: One of 'strategies', 'code_patterns', 'pitfalls', 'context'
        path: Scope path (None for global, path string for scoped)
        content: The bullet content

    Returns:
        The generated bullet ID (e.g., 'str-00001')

    Raises:
        ValueError: If section is not valid
    """
    if section not in SECTION_PREFIXES:
        raise ValueError(f"Invalid section '{section}'. Must be one of: {list(SECTION_PREFIXES.keys())}")

    prefix = SECTION_PREFIXES[section]

    with get_db() as conn:
        # Generate next ID for section
        cursor = conn.execute(
            "SELECT COUNT(*) FROM bullets WHERE id LIKE ?",
            (f"{prefix}-%",)
        )
        count = cursor.fetchone()[0]
        bullet_id = f"{prefix}-{count + 1:05d}"

        conn.execute(
            "INSERT INTO bullets (id, section, path, created, content) VALUES (?, ?, ?, datetime('now'), ?)",
            (bullet_id, section, path, content)
        )
        conn.commit()
        return bullet_id


def increment_counter(bullet_id: str, field: str) -> None:
    """
    Increment the helpful or harmful counter for a bullet.

    Args:
        bullet_id: The bullet ID to update
        field: Either 'helpful' or 'harmful'

    Raises:
        ValueError: If field is not 'helpful' or 'harmful'
    """
    if field not in ("helpful", "harmful"):
        raise ValueError(f"Invalid field '{field}'. Must be 'helpful' or 'harmful'")

    with get_db() as conn:
        # Use parameterized query for the value, but field name is validated above
        conn.execute(
            f"UPDATE bullets SET {field} = {field} + 1 WHERE id = ?",
            (bullet_id,)
        )
        conn.commit()


def get_bullets_for_path(cwd: str) -> list[dict]:
    """
    Get all bullets that apply to the given working directory.

    Returns global bullets (path IS NULL) plus any bullets whose path
    is a prefix of the current working directory.

    Args:
        cwd: Current working directory

    Returns:
        List of bullet dicts, ordered by section then helpful count (descending)
    """
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM bullets
            WHERE path IS NULL
               OR ? LIKE path || '%'
            ORDER BY section, helpful DESC
            """,
            (cwd,)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_playbook_stats() -> dict:
    """
    Get statistics about the current playbook.

    Returns:
        Dict with 'bullet_count' and 'total_content_length' (proxy for tokens)
    """
    with get_db() as conn:
        cursor = conn.execute("SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(content)), 0) as total_len FROM bullets")
        row = cursor.fetchone()
        return {
            "bullet_count": row["count"],
            "total_content_length": row["total_len"],
            # Rough token estimate (4 chars per token average)
            "estimated_tokens": row["total_len"] // 4,
        }


def get_all_bullets() -> list[dict]:
    """Get all bullets in the database."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM bullets ORDER BY section, helpful DESC")
        return [dict(row) for row in cursor.fetchall()]


def format_playbook_for_prompt(bullets: list[dict]) -> str:
    """
    Format bullets into a string suitable for inclusion in prompts.

    Groups bullets by section and formats each with its ID.
    """
    if not bullets:
        return "(No bullets in playbook yet)"

    sections: dict[str, list[dict]] = {}
    for bullet in bullets:
        section = bullet["section"]
        if section not in sections:
            sections[section] = []
        sections[section].append(bullet)

    parts = []
    section_order = ["strategies", "code_patterns", "pitfalls", "context"]

    for section in section_order:
        if section not in sections:
            continue
        section_bullets = sections[section]
        section_title = section.replace("_", " ").title()
        parts.append(f"### {section_title}")
        for bullet in section_bullets:
            scope = f" [scope: {bullet['path']}]" if bullet["path"] else " [global]"
            parts.append(f"- [{bullet['id']}]{scope} {bullet['content']}")
        parts.append("")

    return "\n".join(parts)


# Initialize database on module import
init_db()
