# Data Sourcing Patterns

This guide covers how to identify and access data from various sources.

## General Approach

1. **Research the API** - Find official docs, understand endpoints
2. **Test access** - Write a simple test before building full scraper
3. **Handle pagination** - Most APIs paginate results
4. **Respect rate limits** - Build in delays and retries
5. **Store for resumability** - Use SQLite to track progress

## Database Schema Template

Every clustering project needs a database. Adapt this schema to your data:

```python
# db.py
"""Database operations for clustering pipeline."""

import json
import sqlite3
import struct
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional

import numpy as np


def serialize_embedding(embedding: list[float] | np.ndarray) -> bytes:
    """Serialize a float array to bytes for SQLite storage."""
    if isinstance(embedding, np.ndarray):
        embedding = embedding.tolist()
    return struct.pack(f'{len(embedding)}f', *embedding)


def deserialize_embedding(blob: bytes) -> np.ndarray:
    """Deserialize bytes back to a numpy array."""
    count = len(blob) // 4  # 4 bytes per float32
    return np.array(struct.unpack(f'{count}f', blob), dtype=np.float32)


class Database:
    """SQLite database wrapper for clustering data."""

    # Adapt this schema to your data source
    SCHEMA = """
    CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSON,
        created_at TIMESTAMP,
        -- Clustering fields (don't change these)
        embedding BLOB,
        embedding_cluster_l1 INTEGER,
        embedding_cluster_l2 INTEGER,
        embedding_cluster_l3 INTEGER,
        umap_x REAL,
        umap_y REAL
    );

    CREATE TABLE IF NOT EXISTS clusters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cluster_type TEXT,
        level INTEGER,
        name TEXT,
        parent_id INTEGER REFERENCES clusters(id),
        comment_count INTEGER,
        centroid BLOB,
        llm_description TEXT,
        llm_pattern_name TEXT,
        llm_category TEXT,
        strength_score REAL
    );

    CREATE TABLE IF NOT EXISTS scrape_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_items_cluster_l1 ON items(embedding_cluster_l1);
    CREATE INDEX IF NOT EXISTS idx_items_cluster_l2 ON items(embedding_cluster_l2);
    CREATE INDEX IF NOT EXISTS idx_items_cluster_l3 ON items(embedding_cluster_l3);
    """

    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        with self.connection() as conn:
            conn.executescript(self.SCHEMA)

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def execute(self, query: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self.connection() as conn:
            cursor = conn.execute(query, params)
            return cursor.fetchall()

    # State operations for resumability
    def set_state(self, key: str, value: Any):
        with self.connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO scrape_state (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            """, (key, json.dumps(value)))

    def get_state(self, key: str, default: Any = None) -> Any:
        rows = self.execute("SELECT value FROM scrape_state WHERE key = ?", (key,))
        if rows:
            return json.loads(rows[0]['value'])
        return default
```

## GitHub API Pattern

### Test Script
```python
# test_github.py
import os
import requests

def test_github_access():
    """Test GitHub API access."""
    token = os.environ.get('GITHUB_TOKEN')
    assert token, "GITHUB_TOKEN not set"

    # Test with a small request
    owner, repo = 'facebook', 'react'  # Adapt to your target

    response = requests.get(
        f'https://api.github.com/repos/{owner}/{repo}/issues',
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github+json'
        },
        params={'per_page': 5, 'state': 'all'}
    )

    assert response.status_code == 200, f"Failed: {response.status_code}"

    # Check rate limit
    remaining = response.headers.get('X-RateLimit-Remaining')
    print(f"Rate limit remaining: {remaining}")

    data = response.json()
    assert len(data) > 0
    print(f"Successfully fetched {len(data)} issues")
    print(f"Sample issue: {data[0]['title'][:50]}...")

if __name__ == '__main__':
    test_github_access()
```

### Full Scraper
```python
# scraper_github.py
"""GitHub Issues/PRs/Comments scraper."""

import os
import time
from typing import Optional

import requests
from rich.console import Console
from rich.progress import Progress

from .db import Database

console = Console()

class GitHubScraper:
    BASE_URL = 'https://api.github.com'

    def __init__(self, db: Database, owner: str, repo: str):
        self.db = db
        self.owner = owner
        self.repo = repo
        self.token = os.environ.get('GITHUB_TOKEN')
        if not self.token:
            raise ValueError("GITHUB_TOKEN not set")
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.token}',
            'Accept': 'application/vnd.github+json'
        })

    def _request(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """Make rate-limited request."""
        url = f'{self.BASE_URL}{endpoint}'

        while True:
            response = self.session.get(url, params=params)

            # Handle rate limiting
            if response.status_code == 403:
                reset_time = int(response.headers.get('X-RateLimit-Reset', 0))
                wait_time = max(reset_time - time.time(), 60)
                console.print(f"[yellow]Rate limited, waiting {wait_time:.0f}s")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            return response.json()

    def scrape_issues(self):
        """Scrape all issues with comments."""
        # Get last scraped page for resumability
        last_page = self.db.get_state('issues_last_page', 0)

        console.print(f"[cyan]Scraping issues from page {last_page + 1}")

        page = last_page + 1
        while True:
            issues = self._request(
                f'/repos/{self.owner}/{self.repo}/issues',
                params={'per_page': 100, 'page': page, 'state': 'all'}
            )

            if not issues:
                break

            for issue in issues:
                # Store issue
                self.db.execute("""
                    INSERT OR REPLACE INTO items (id, content, metadata, created_at)
                    VALUES (?, ?, ?, ?)
                """, (
                    f"issue-{issue['number']}",
                    issue['body'] or '',
                    {'title': issue['title'], 'labels': [l['name'] for l in issue['labels']]},
                    issue['created_at']
                ))

                # Also scrape comments if any
                if issue['comments'] > 0:
                    self._scrape_issue_comments(issue['number'])

            # Save progress
            self.db.set_state('issues_last_page', page)
            console.print(f"[dim]  Page {page}: {len(issues)} issues")

            page += 1
            time.sleep(0.5)  # Be nice to the API

    def _scrape_issue_comments(self, issue_number: int):
        """Scrape comments for a single issue."""
        comments = self._request(
            f'/repos/{self.owner}/{self.repo}/issues/{issue_number}/comments'
        )

        for comment in comments:
            self.db.execute("""
                INSERT OR REPLACE INTO items (id, content, metadata, created_at)
                VALUES (?, ?, ?, ?)
            """, (
                f"comment-{comment['id']}",
                comment['body'] or '',
                {'issue_number': issue_number, 'user': comment['user']['login']},
                comment['created_at']
            ))
```

## Slack API Pattern

### Test Script
```python
# test_slack.py
import os
from slack_sdk import WebClient

def test_slack_access():
    """Test Slack API access."""
    token = os.environ.get('SLACK_TOKEN')
    assert token, "SLACK_TOKEN not set"

    client = WebClient(token=token)

    # Test auth
    auth = client.auth_test()
    assert auth['ok'], f"Auth failed: {auth['error']}"
    print(f"Authenticated as: {auth['user']}")

    # Test channel list
    channels = client.conversations_list(limit=5)
    assert channels['ok']
    print(f"Found {len(channels['channels'])} channels")

if __name__ == '__main__':
    test_slack_access()
```

### Full Scraper
```python
# scraper_slack.py
"""Slack messages scraper."""

import os
import time
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from rich.console import Console

from .db import Database

console = Console()

class SlackScraper:
    def __init__(self, db: Database, channel_ids: list[str]):
        self.db = db
        self.channel_ids = channel_ids
        token = os.environ.get('SLACK_TOKEN')
        if not token:
            raise ValueError("SLACK_TOKEN not set")
        self.client = WebClient(token=token)

    def scrape_channel(self, channel_id: str):
        """Scrape all messages from a channel."""
        cursor = self.db.get_state(f'slack_cursor_{channel_id}')

        while True:
            try:
                result = self.client.conversations_history(
                    channel=channel_id,
                    cursor=cursor,
                    limit=200
                )
            except SlackApiError as e:
                if e.response['error'] == 'ratelimited':
                    delay = int(e.response.headers.get('Retry-After', 60))
                    console.print(f"[yellow]Rate limited, waiting {delay}s")
                    time.sleep(delay)
                    continue
                raise

            for msg in result['messages']:
                if msg.get('text'):
                    self.db.execute("""
                        INSERT OR REPLACE INTO items (id, content, metadata, created_at)
                        VALUES (?, ?, ?, ?)
                    """, (
                        f"slack-{msg['ts']}",
                        msg['text'],
                        {'channel': channel_id, 'user': msg.get('user')},
                        msg['ts']
                    ))

            # Handle pagination
            if result.get('has_more'):
                cursor = result['response_metadata']['next_cursor']
                self.db.set_state(f'slack_cursor_{channel_id}', cursor)
            else:
                break

            time.sleep(1)  # Rate limit
```

## Generic REST API Pattern

For APIs not covered above:

```python
# scraper_generic.py
"""Generic REST API scraper template."""

import os
import time
from typing import Optional, Callable

import requests
from rich.console import Console

from .db import Database

console = Console()

class GenericScraper:
    """
    Adapt this template for your specific API.

    Key things to customize:
    1. BASE_URL - Your API's base URL
    2. auth_headers() - How authentication works
    3. extract_items() - How to get items from response
    4. extract_content() - What text to use for clustering
    5. pagination - How the API paginates (cursor, page number, offset)
    """

    BASE_URL = 'https://api.example.com'

    def __init__(self, db: Database):
        self.db = db
        self.session = requests.Session()
        self.session.headers.update(self.auth_headers())

    def auth_headers(self) -> dict:
        """Return authentication headers. Customize for your API."""
        token = os.environ.get('API_TOKEN')
        if not token:
            raise ValueError("API_TOKEN not set")
        return {'Authorization': f'Bearer {token}'}

    def extract_items(self, response_data: dict) -> list[dict]:
        """Extract items from API response. Customize for your API."""
        # Common patterns:
        # return response_data['data']
        # return response_data['results']
        # return response_data['items']
        return response_data.get('data', [])

    def extract_content(self, item: dict) -> str:
        """Extract text content for clustering. Customize for your API."""
        # Common patterns:
        # return item['body']
        # return item['content']
        # return f"{item['title']}\n{item['description']}"
        return item.get('content', '')

    def get_next_cursor(self, response_data: dict) -> Optional[str]:
        """Extract pagination cursor. Customize for your API."""
        # Common patterns:
        # return response_data.get('next_cursor')
        # return response_data.get('pagination', {}).get('next')
        return response_data.get('next_cursor')

    def scrape(self, endpoint: str):
        """Scrape all items from an endpoint."""
        cursor = self.db.get_state(f'cursor_{endpoint}')

        while True:
            params = {'limit': 100}
            if cursor:
                params['cursor'] = cursor

            response = self.session.get(
                f'{self.BASE_URL}{endpoint}',
                params=params
            )

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 60))
                console.print(f"[yellow]Rate limited, waiting {retry_after}s")
                time.sleep(retry_after)
                continue

            response.raise_for_status()
            data = response.json()

            items = self.extract_items(data)
            if not items:
                break

            # Store items
            for item in items:
                content = self.extract_content(item)
                if content:
                    self.db.execute("""
                        INSERT OR REPLACE INTO items (id, content, metadata, created_at)
                        VALUES (?, ?, ?, ?)
                    """, (
                        str(item['id']),
                        content,
                        item,  # Store full item as metadata
                        item.get('created_at')
                    ))

            # Handle pagination
            cursor = self.get_next_cursor(data)
            if cursor:
                self.db.set_state(f'cursor_{endpoint}', cursor)
            else:
                break

            console.print(f"[dim]  Fetched {len(items)} items")
            time.sleep(0.5)  # Be nice to the API
```

## Common Data Sources Reference

| Source | API Docs | Auth | Rate Limit |
|--------|----------|------|------------|
| GitHub | docs.github.com/rest | Bearer token | 5000/hr |
| Slack | api.slack.com/web | Bot token | Varies |
| Jira | developer.atlassian.com | Basic/OAuth | 100/req |
| Linear | developers.linear.app | API key | 1500/hr |
| Discourse | docs.discourse.org | API key | 60/min |
| Zendesk | developer.zendesk.com | OAuth/Basic | Varies |
| Intercom | developers.intercom.com | Bearer token | Varies |

## Tips for New APIs

1. **Start with the official SDK** if one exists (e.g., `slack_sdk`, `PyGithub`)
2. **Check for GraphQL** - Often more efficient than REST for complex queries
3. **Look for bulk export** - Some services offer data export features
4. **Consider webhooks** - For real-time data, webhooks may be better than polling
5. **Test thoroughly** - Verify you're getting all the data you expect
