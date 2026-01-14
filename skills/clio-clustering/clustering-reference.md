# Clustering Implementation Reference

Complete implementation for embedding generation, hierarchical clustering, and LLM labeling.

## Overview

The clustering pipeline has three stages:
1. **Embedding** - Convert text to vectors using OpenAI
2. **Clustering** - Hierarchical HDBSCAN with 3 levels
3. **Labeling** - LLM-powered cluster descriptions

## 1. Embedding Generation

```python
# embed.py
"""Embedding generation using OpenAI API."""

import os
from typing import Optional

from openai import OpenAI
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeRemainingColumn

from .db import Database, serialize_embedding

console = Console()

# IMPORTANT: Always use text-embedding-3-large for best quality
EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIM = 3072
BATCH_SIZE = 100


class EmbeddingGenerator:
    """Generate embeddings for text items."""

    def __init__(self, db: Database):
        self.db = db
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        self.client = OpenAI(api_key=api_key)

    def prepare_text(self, item: dict) -> str:
        """
        Prepare text for embedding. Customize this for your data.

        Tips:
        - Include relevant context (e.g., file path, metadata)
        - Truncate very long text (embeddings have token limits)
        - Combine multiple fields if relevant
        """
        parts = []

        # Add metadata context if available
        metadata = item.get('metadata', {})
        if isinstance(metadata, str):
            import json
            try:
                metadata = json.loads(metadata)
            except:
                metadata = {}

        # Example: add title if present
        if metadata.get('title'):
            parts.append(f"Title: {metadata['title']}")

        # The main content
        content = item.get('content', '').strip()
        if len(content) > 8000:
            content = content[:8000] + "..."
        if content:
            parts.append(content)

        return "\n\n".join(parts)

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts."""
        if not texts:
            return []

        response = self.client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts
        )

        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]

    def generate_all(self, batch_size: int = BATCH_SIZE):
        """Generate embeddings for all items without embeddings."""
        items = self.db.execute(
            "SELECT * FROM items WHERE embedding IS NULL ORDER BY id"
        )
        items = [dict(row) for row in items]

        if not items:
            console.print("[green]All items already have embeddings!")
            return

        console.print(f"[bold]Generating embeddings for {len(items)} items")
        console.print(f"[dim]Model: {EMBEDDING_MODEL}")

        processed = 0
        errors = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            task = progress.add_task("[cyan]Generating...", total=len(items))

            for i in range(0, len(items), batch_size):
                batch = items[i:i + batch_size]

                try:
                    texts = [self.prepare_text(item) for item in batch]
                    valid_pairs = [(item, text) for item, text in zip(batch, texts) if text.strip()]

                    if not valid_pairs:
                        progress.update(task, advance=len(batch))
                        continue

                    valid_items, valid_texts = zip(*valid_pairs)
                    embeddings = self.embed_batch(list(valid_texts))

                    # Save to database
                    with self.db.connection() as conn:
                        for item, emb in zip(valid_items, embeddings):
                            conn.execute(
                                "UPDATE items SET embedding = ? WHERE id = ?",
                                (serialize_embedding(emb), item['id'])
                            )

                    processed += len(valid_pairs)
                    progress.update(task, advance=len(batch))

                except Exception as e:
                    console.print(f"[red]Error: {e}")
                    errors += 1
                    progress.update(task, advance=len(batch))
                    if errors > 5:
                        break

        console.print(f"[green]Done! Processed: {processed}, Errors: {errors}")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', default='data/items.db')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE)
    args = parser.parse_args()

    db = Database(args.db)
    generator = EmbeddingGenerator(db)
    generator.generate_all(args.batch_size)


if __name__ == '__main__':
    main()
```

## 2. Hierarchical HDBSCAN Clustering

```python
# cluster.py
"""Hierarchical clustering using HDBSCAN."""

import numpy as np
import hdbscan
import umap
from sklearn.preprocessing import normalize
from rich.console import Console

from .db import Database, deserialize_embedding, serialize_embedding

console = Console()


class Clusterer:
    """Multi-level hierarchical clusterer."""

    def __init__(self, db: Database):
        self.db = db

    def run(self):
        """Run the full clustering pipeline."""
        console.print("[bold]Starting clustering pipeline")

        # Clear existing clusters
        self.db.execute("DELETE FROM clusters")
        self.db.execute("""
            UPDATE items SET
                embedding_cluster_l1 = NULL,
                embedding_cluster_l2 = NULL,
                embedding_cluster_l3 = NULL,
                umap_x = NULL,
                umap_y = NULL
        """)

        # Load embeddings
        rows = self.db.execute(
            "SELECT id, embedding FROM items WHERE embedding IS NOT NULL"
        )

        if not rows:
            console.print("[yellow]No embeddings found")
            return

        ids = [row['id'] for row in rows]
        embeddings = np.vstack([deserialize_embedding(row['embedding']) for row in rows])

        console.print(f"Loaded {len(ids)} embeddings of dimension {embeddings.shape[1]}")

        # Normalize for cosine similarity
        normalized = normalize(embeddings)

        # Level 1: Coarse clusters
        console.print("[dim]Level 1 clustering (coarse)...")
        labels_l1 = self._cluster_level(
            normalized,
            min_cluster_size=max(50, len(ids) // 100),
            min_samples=10
        )
        n_l1 = len(set(labels_l1)) - (1 if -1 in labels_l1 else 0)
        console.print(f"  Found {n_l1} L1 clusters")

        # Level 2: Medium clusters within each L1
        console.print("[dim]Level 2 clustering (medium)...")
        labels_l2 = self._subcluster(
            normalized, labels_l1,
            min_cluster_size_fn=lambda n: max(15, n // 10),
            min_samples=5,
            min_points=30
        )
        n_l2 = len(set(labels_l2)) - (1 if -1 in labels_l2 else 0)
        console.print(f"  Found {n_l2} L2 clusters")

        # Level 3: Fine clusters within each L2
        console.print("[dim]Level 3 clustering (fine)...")
        labels_l3 = self._subcluster(
            normalized, labels_l2,
            min_cluster_size_fn=lambda n: min(50, max(5, n // 5)),
            min_samples=3,
            min_points=15
        )
        n_l3 = len(set(labels_l3)) - (1 if -1 in labels_l3 else 0)
        console.print(f"  Found {n_l3} L3 clusters")

        # UMAP projection for visualization
        console.print("[dim]Running UMAP projection...")
        reducer = umap.UMAP(
            n_components=2,
            n_neighbors=15,
            min_dist=0.1,
            metric='cosine',
            random_state=42,
            verbose=False
        )
        projections = reducer.fit_transform(embeddings)

        # Save to database
        console.print("[dim]Saving results...")
        with self.db.connection() as conn:
            for i, item_id in enumerate(ids):
                conn.execute("""
                    UPDATE items SET
                        embedding_cluster_l1 = ?,
                        embedding_cluster_l2 = ?,
                        embedding_cluster_l3 = ?,
                        umap_x = ?,
                        umap_y = ?
                    WHERE id = ?
                """, (
                    int(labels_l1[i]) if labels_l1[i] >= 0 else None,
                    int(labels_l2[i]) if labels_l2[i] >= 0 else None,
                    int(labels_l3[i]) if labels_l3[i] >= 0 else None,
                    float(projections[i, 0]),
                    float(projections[i, 1]),
                    item_id
                ))

        # Create cluster records with parent relationships
        self._create_cluster_records(normalized, labels_l1, labels_l2, labels_l3)

        console.print(f"[green]Clustering complete!")
        console.print(f"  L1: {n_l1}, L2: {n_l2}, L3: {n_l3}")

    def _cluster_level(self, data: np.ndarray, min_cluster_size: int, min_samples: int) -> np.ndarray:
        """Run HDBSCAN at a single level."""
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
            metric='euclidean',
            cluster_selection_method='eom'
        )
        return clusterer.fit_predict(data)

    def _subcluster(
        self,
        data: np.ndarray,
        parent_labels: np.ndarray,
        min_cluster_size_fn,
        min_samples: int,
        min_points: int
    ) -> np.ndarray:
        """Create sub-clusters within each parent cluster."""
        labels = np.full_like(parent_labels, -1)
        offset = 0

        for parent_label in set(parent_labels) - {-1}:
            mask = parent_labels == parent_label
            if mask.sum() < min_points:
                continue

            sub_clusterer = hdbscan.HDBSCAN(
                min_cluster_size=min_cluster_size_fn(mask.sum()),
                min_samples=min_samples,
                metric='euclidean',
                cluster_selection_method='eom'
            )
            sub_labels = sub_clusterer.fit_predict(data[mask])

            # Offset labels to make them globally unique
            sub_labels_offset = sub_labels.copy()
            sub_labels_offset[sub_labels >= 0] += offset
            labels[mask] = sub_labels_offset

            n_new = len(set(sub_labels)) - (1 if -1 in sub_labels else 0)
            offset = labels.max() + 1 if labels.max() >= 0 else 0

        return labels

    def _create_cluster_records(self, normalized, labels_l1, labels_l2, labels_l3):
        """Create cluster records with parent relationships."""
        l1_to_db = {}
        l2_to_db = {}

        # L1 clusters
        for label in sorted(set(labels_l1) - {-1}):
            mask = labels_l1 == label
            centroid = normalized[mask].mean(axis=0)
            with self.db.connection() as conn:
                cursor = conn.execute("""
                    INSERT INTO clusters (cluster_type, level, name, comment_count, centroid)
                    VALUES ('embedding', 1, ?, ?, ?)
                """, (f'L1_{label}', int(mask.sum()), serialize_embedding(centroid)))
                l1_to_db[label] = cursor.lastrowid

        # L2 clusters with L1 parents
        for label in sorted(set(labels_l2) - {-1}):
            mask = labels_l2 == label
            centroid = normalized[mask].mean(axis=0)

            # Find parent L1
            l1_labels = labels_l1[mask]
            valid_l1 = l1_labels[l1_labels >= 0]
            parent_id = None
            if len(valid_l1) > 0:
                parent_l1 = int(np.bincount(valid_l1).argmax())
                parent_id = l1_to_db.get(parent_l1)

            with self.db.connection() as conn:
                cursor = conn.execute("""
                    INSERT INTO clusters (cluster_type, level, name, parent_id, comment_count, centroid)
                    VALUES ('embedding', 2, ?, ?, ?, ?)
                """, (f'L2_{label}', parent_id, int(mask.sum()), serialize_embedding(centroid)))
                l2_to_db[label] = cursor.lastrowid

        # L3 clusters with L2 parents
        for label in sorted(set(labels_l3) - {-1}):
            mask = labels_l3 == label
            centroid = normalized[mask].mean(axis=0)

            # Find parent L2
            l2_labels = labels_l2[mask]
            valid_l2 = l2_labels[l2_labels >= 0]
            parent_id = None
            if len(valid_l2) > 0:
                parent_l2 = int(np.bincount(valid_l2).argmax())
                parent_id = l2_to_db.get(parent_l2)

            with self.db.connection() as conn:
                conn.execute("""
                    INSERT INTO clusters (cluster_type, level, name, parent_id, comment_count, centroid)
                    VALUES ('embedding', 3, ?, ?, ?, ?)
                """, (f'L3_{label}', parent_id, int(mask.sum()), serialize_embedding(centroid)))


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', default='data/items.db')
    args = parser.parse_args()

    db = Database(args.db)
    clusterer = Clusterer(db)
    clusterer.run()


if __name__ == '__main__':
    main()
```

## 3. LLM Cluster Labeling

```python
# describe.py
"""LLM-based cluster description using Instructor."""

import json
import os
import random
from typing import Optional

import instructor
from openai import OpenAI
from pydantic import BaseModel, Field
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeRemainingColumn

from .db import Database

console = Console()

# Model for cluster labeling
CHAT_MODEL = "gpt-4o-mini"  # Fast and cheap, good for labeling
MIN_CLUSTER_SIZE = 3
MAX_SAMPLE_SIZE = 20


class ClusterDescription(BaseModel):
    """Structured description of a cluster."""

    summary: str = Field(
        description="2-3 sentence summary of what this cluster is about"
    )

    pattern_name: str = Field(
        description="Short name for this pattern (3-5 words)"
    )

    category: str = Field(
        description="Primary category (e.g., bug, feature_request, question, feedback, etc.)"
    )

    strength: int = Field(
        ge=1, le=10,
        description="How consistent/coherent this cluster is (1=weak, 10=very strong)"
    )


# Customize this prompt for your data
SYSTEM_PROMPT = """You are analyzing text items that have been clustered based on semantic similarity.

Given a cluster of similar items, identify the common pattern or theme they represent.
Be specific and actionable in your description."""


class ClusterDescriber:
    """Generate LLM descriptions for clusters."""

    def __init__(self, db: Database):
        self.db = db
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")

        self.client = instructor.from_openai(OpenAI(api_key=api_key))

    def get_cluster_items(self, cluster: dict, max_samples: int = MAX_SAMPLE_SIZE) -> list[str]:
        """Get sample items for a cluster."""
        cluster_name = cluster['name']
        level = cluster.get('level', 1)

        # Extract cluster number from name (e.g., 'L1_5' -> 5)
        cluster_num = int(cluster_name.split('_')[1])
        col = f'embedding_cluster_l{level}'

        rows = self.db.execute(
            f"SELECT content FROM items WHERE {col} = ? AND content IS NOT NULL",
            (cluster_num,)
        )

        contents = [r['content'] for r in rows if r['content'] and r['content'].strip()]

        if len(contents) > max_samples:
            contents = random.sample(contents, max_samples)

        return contents

    def describe_cluster(self, items: list[str]) -> ClusterDescription:
        """Generate description for a cluster using LLM."""
        items_text = "\n---\n".join(
            f"Item {i+1}: {c[:500]}{'...' if len(c) > 500 else ''}"
            for i, c in enumerate(items)
        )

        return self.client.chat.completions.create(
            model=CHAT_MODEL,
            response_model=ClusterDescription,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"""Here are {len(items)} items clustered together based on semantic similarity:

---
{items_text}
---

Analyze these items and describe the pattern they represent."""
                }
            ],
            max_retries=2
        )

    def describe_all(self, min_size: int = MIN_CLUSTER_SIZE):
        """Generate descriptions for all clusters."""
        clusters = self.db.execute(
            "SELECT * FROM clusters WHERE llm_description IS NULL ORDER BY comment_count DESC"
        )
        clusters = [dict(row) for row in clusters]

        if not clusters:
            console.print("[green]All clusters already have descriptions!")
            return

        console.print(f"[bold]Describing {len(clusters)} clusters")

        described = 0
        skipped = 0
        errors = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            task = progress.add_task("[cyan]Describing...", total=len(clusters))

            for cluster in clusters:
                try:
                    items = self.get_cluster_items(cluster)

                    if len(items) < min_size:
                        skipped += 1
                        progress.update(task, advance=1)
                        continue

                    description = self.describe_cluster(items)

                    self.db.execute("""
                        UPDATE clusters SET
                            llm_description = ?,
                            llm_pattern_name = ?,
                            llm_category = ?,
                            strength_score = ?
                        WHERE id = ?
                    """, (
                        description.summary,
                        description.pattern_name,
                        description.category,
                        description.strength,
                        cluster['id']
                    ))

                    described += 1
                    progress.update(
                        task, advance=1,
                        description=f"[cyan]{description.pattern_name}"
                    )

                except Exception as e:
                    console.print(f"[red]Error: {e}")
                    errors += 1
                    progress.update(task, advance=1)
                    if errors > 10:
                        break

        console.print(f"[green]Done! Described: {described}, Skipped: {skipped}, Errors: {errors}")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', default='data/items.db')
    parser.add_argument('--min-size', type=int, default=MIN_CLUSTER_SIZE)
    args = parser.parse_args()

    db = Database(args.db)
    describer = ClusterDescriber(db)
    describer.describe_all(args.min_size)


if __name__ == '__main__':
    main()
```

## 4. Export for Visualization

```python
# export.py
"""Export data for visualization."""

import json
from pathlib import Path

from rich.console import Console

from .db import Database

console = Console()


class Exporter:
    """Export data for the Next.js visualization."""

    def __init__(self, db: Database):
        self.db = db

    def export_items(self) -> list[dict]:
        """Export all items with cluster assignments."""
        rows = self.db.execute("""
            SELECT
                id,
                content,
                metadata,
                created_at,
                umap_x,
                umap_y,
                embedding_cluster_l1,
                embedding_cluster_l2,
                embedding_cluster_l3
            FROM items
            WHERE umap_x IS NOT NULL AND umap_y IS NOT NULL
        """)

        exported = []
        for row in rows:
            metadata = row['metadata']
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}

            exported.append({
                'id': row['id'],
                'content': row['content'][:500] if row['content'] else '',
                'metadata': metadata,
                'created_at': row['created_at'],
                'x': round(row['umap_x'], 4),
                'y': round(row['umap_y'], 4),
                'cluster_l1': row['embedding_cluster_l1'],
                'cluster_l2': row['embedding_cluster_l2'],
                'cluster_l3': row['embedding_cluster_l3'],
            })

        return exported

    def export_clusters(self) -> list[dict]:
        """Export all clusters with descriptions."""
        rows = self.db.execute("""
            SELECT
                id, cluster_type, level, name, parent_id, comment_count,
                llm_description, llm_pattern_name, llm_category, strength_score
            FROM clusters
            ORDER BY level, comment_count DESC
        """)

        return [{
            'id': row['id'],
            'cluster_type': row['cluster_type'],
            'level': row['level'],
            'name': row['name'],
            'parent_id': row['parent_id'],
            'comment_count': row['comment_count'],
            'description': row['llm_description'],
            'pattern_name': row['llm_pattern_name'],
            'category': row['llm_category'],
            'strength': row['strength_score'],
        } for row in rows]

    def export_all(self, output_dir: str):
        """Export all data to JSON files."""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        console.print(f"[bold]Exporting to {output_dir}")

        items = self.export_items()
        with open(output_dir / 'items.json', 'w') as f:
            json.dump(items, f)
        console.print(f"  [green]Exported {len(items)} items")

        clusters = self.export_clusters()
        with open(output_dir / 'clusters.json', 'w') as f:
            json.dump(clusters, f, indent=2)
        console.print(f"  [green]Exported {len(clusters)} clusters")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', default='data/items.db')
    parser.add_argument('--output', default='visualizer/public/data')
    args = parser.parse_args()

    db = Database(args.db)
    exporter = Exporter(db)
    exporter.export_all(args.output)


if __name__ == '__main__':
    main()
```

## Requirements

```txt
# requirements.txt
openai>=1.0
instructor>=1.0
hdbscan>=0.8.33
umap-learn>=0.5
scikit-learn>=1.3
numpy>=1.24
rich>=13.0
pydantic>=2.0
requests>=2.31
```

## Running the Pipeline

```bash
# Install dependencies
pip install -r requirements.txt

# Run each step
python -m pipeline.embed --db data/items.db
python -m pipeline.cluster --db data/items.db
python -m pipeline.describe --db data/items.db
python -m pipeline.export --db data/items.db --output visualizer/public/data
```
