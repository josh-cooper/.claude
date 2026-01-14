---
name: clio-clustering
description: |
  Build a complete data clustering and visualization pipeline from any data source.
  Use when the user wants to analyze patterns in text data (GitHub issues, Slack messages,
  support tickets, code reviews, forum posts, customer feedback, etc.), cluster similar items,
  or build an interactive visualization to explore the patterns.
  Triggers on: "cluster", "analyze patterns", "group similar", "clio-style", "pattern analysis",
  "visualize clusters", "find themes", "topic modeling", "semantic clustering".
user-invocable: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch
---

# Clio-Style Clustering Pipeline

Build an end-to-end semantic clustering analysis from any text data source, with interactive visualization.

## What This Skill Does

This skill guides you through building a complete clustering pipeline:
1. **Data Sourcing** - Identify APIs/methods to fetch data, build tests to verify access
2. **Scraping** - Collect data with proper pagination and rate limiting
3. **Embedding** - Generate embeddings using OpenAI's text-embedding-3-large
4. **Clustering** - Hierarchical HDBSCAN clustering with UMAP projection
5. **Labeling** - LLM-powered cluster naming and description
6. **Visualization** - Interactive React/D3 explorer with drill-down

## Quick Start

When the user describes a data source (e.g., "GitHub issues from facebook/react"), follow these steps:

### Phase 1: Data Source Discovery

First, identify how to access the data:

1. **Research the API** - Use web search to find official API documentation
2. **Identify authentication** - What tokens/keys are needed?
3. **Find pagination patterns** - How does the API handle large datasets?
4. **Determine rate limits** - What are the constraints?

See [data-sourcing.md](data-sourcing.md) for common patterns (GitHub, Slack, etc.)

### Phase 2: Build & Test Data Fetcher

**IMPORTANT: Write tests BEFORE building the full scraper.**

```python
# test_fetcher.py - Verify API access works
import os
import requests

def test_api_access():
    """Verify we can access the API."""
    # Adapt this for your specific data source
    token = os.environ.get('API_TOKEN')
    assert token, "API_TOKEN not set"

    response = requests.get(
        'https://api.example.com/endpoint',
        headers={'Authorization': f'Bearer {token}'}
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data) > 0, "No data returned"
    print(f"Successfully fetched {len(data)} items")

if __name__ == '__main__':
    test_api_access()
```

Run the test: `python test_fetcher.py`

Only proceed to the full scraper once tests pass.

### Phase 3: Build the Scraper

Create a scraper that:
- Handles pagination efficiently
- Respects rate limits
- Stores data in SQLite for resumability
- Saves progress for resumable scraping

See [data-sourcing.md](data-sourcing.md) for the database schema and scraper template.

### Phase 4: Generate Embeddings & Cluster

Use the clustering pipeline to:
1. Generate embeddings with OpenAI
2. Run hierarchical HDBSCAN clustering
3. Project to 2D with UMAP
4. Label clusters with LLM

See [clustering-reference.md](clustering-reference.md) for the complete implementation.

### Phase 5: Build Visualization

Set up the interactive visualization:
1. Export data to JSON
2. Create Next.js app with D3 visualization
3. Add hierarchical drill-down view

See [visualization-setup.md](visualization-setup.md) for setup instructions.

The `components/` directory contains ready-to-copy React components.

## Project Structure

When complete, the project should look like:

```
project/
├── data/
│   └── items.db              # SQLite database
├── pipeline/
│   ├── __init__.py
│   ├── db.py                 # Database operations
│   ├── scraper.py            # Data fetcher
│   ├── embed.py              # Embedding generation
│   ├── cluster.py            # HDBSCAN clustering
│   ├── describe.py           # LLM labeling
│   └── export.py             # JSON export
├── visualizer/
│   ├── app/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── HierarchicalView.tsx
│   │   ├── ScatterPlot.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── types.ts
│   │   ├── data.ts
│   │   └── utils.ts
│   └── public/data/
│       ├── items.json
│       └── clusters.json
├── test_fetcher.py           # API access tests
├── requirements.txt
└── README.md
```

## Dependencies

### Python (for pipeline)
```
openai>=1.0
instructor>=1.0
hdbscan>=0.8.33
umap-learn>=0.5
scikit-learn>=1.3
numpy>=1.24
rich>=13.0
```

### Node.js (for visualization)
```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.2.0",
    "d3": "^7.8.5",
    "framer-motion": "^11.0.0",
    "tailwindcss": "^3.4.1"
  }
}
```

## Environment Variables

```bash
OPENAI_API_KEY=sk-...           # Required for embeddings and labeling
# Plus whatever auth your data source needs:
GITHUB_TOKEN=ghp_...            # For GitHub
SLACK_TOKEN=xoxb-...            # For Slack
# etc.
```

## Running the Pipeline

```bash
# 1. Test API access
python test_fetcher.py

# 2. Scrape data
python -m pipeline.scraper

# 3. Generate embeddings
python -m pipeline.embed

# 4. Cluster
python -m pipeline.cluster

# 5. Label clusters with LLM
python -m pipeline.describe

# 6. Export for visualization
python -m pipeline.export

# 7. Run visualizer
cd visualizer && npm run dev
```

## Key Design Decisions

1. **SQLite for storage** - Simple, portable, supports resumability
2. **HDBSCAN over K-means** - Finds natural clusters, handles noise
3. **3-level hierarchy** - Coarse (L1) -> Medium (L2) -> Fine (L3)
4. **UMAP for projection** - Preserves local structure better than t-SNE
5. **text-embedding-3-large** - Best quality embeddings for semantic similarity
6. **Next.js + D3** - Fast, interactive visualization with SSR support

## Detailed Documentation

- [Data Sourcing Patterns](data-sourcing.md) - API patterns, auth, pagination
- [Clustering Implementation](clustering-reference.md) - Embedding, HDBSCAN, UMAP code
- [Visualization Setup](visualization-setup.md) - Next.js app and components
