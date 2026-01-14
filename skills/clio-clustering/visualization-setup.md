# Visualization Setup

Guide to setting up the interactive Next.js/D3 visualization.

## Quick Start

```bash
# Create Next.js app with TypeScript and Tailwind
npx create-next-app@14 visualizer --typescript --tailwind --eslint --app --src-dir=false

cd visualizer

# Install dependencies
npm install d3 @types/d3 framer-motion clsx tailwind-merge recharts lucide-react
```

## Project Structure

```
visualizer/
├── app/
│   ├── page.tsx              # Main page
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── HierarchicalView.tsx  # Circle-packing drill-down view
│   ├── ScatterPlot.tsx       # UMAP scatter plot
│   ├── FilterPanel.tsx       # Filter controls
│   └── ClusterList.tsx       # Cluster listing
├── lib/
│   ├── types.ts              # TypeScript types
│   ├── data.ts               # Data loading
│   └── utils.ts              # Utilities
└── public/
    └── data/
        ├── items.json        # Exported items
        └── clusters.json     # Exported clusters
```

## TypeScript Types

Create `lib/types.ts`:

```typescript
// lib/types.ts
export interface Item {
  id: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string | null;
  x: number;
  y: number;
  cluster_l1: number | null;
  cluster_l2: number | null;
  cluster_l3: number | null;
}

export interface Cluster {
  id: number;
  cluster_type: string;
  level: number;
  name: string;
  parent_id: number | null;
  comment_count: number;
  description: string | null;
  pattern_name: string | null;
  category: string | null;
  strength: number | null;
}

export interface HierarchicalNode {
  id: string;
  name: string;
  summary: string;
  level: number;
  size: number;
  category?: string;
  strength?: number;
  originalLabel?: number;
  children: HierarchicalNode[];
}

export type ColorMode = 'l1' | 'l2' | 'l3' | 'category';

export type ViewMode = 'spatial' | 'hierarchical';

export interface Filters {
  clusterLevel: 1 | 2 | 3;
  selectedCluster: number | null;
  category: string[];
}
```

## Data Loading

Create `lib/data.ts`:

```typescript
// lib/data.ts
import { Item, Cluster } from './types';

let itemsCache: Item[] | null = null;
let clustersCache: Cluster[] | null = null;

export async function loadItems(): Promise<Item[]> {
  if (itemsCache) return itemsCache;

  try {
    const response = await fetch('/data/items.json');
    if (!response.ok) return [];
    itemsCache = await response.json();
    return itemsCache || [];
  } catch (error) {
    console.error('Error loading items:', error);
    return [];
  }
}

export async function loadClusters(): Promise<Cluster[]> {
  if (clustersCache) return clustersCache;

  try {
    const response = await fetch('/data/clusters.json');
    if (!response.ok) return [];
    clustersCache = await response.json();
    return clustersCache || [];
  } catch (error) {
    console.error('Error loading clusters:', error);
    return [];
  }
}

export async function loadAllData(): Promise<{
  items: Item[];
  clusters: Cluster[];
}> {
  const [items, clusters] = await Promise.all([
    loadItems(),
    loadClusters()
  ]);
  return { items, clusters };
}
```

## Utilities

Create `lib/utils.ts`:

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Cluster, HierarchicalNode } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// Color palette for clusters
export const CLUSTER_COLORS = [
  '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
  '#86bcb6', '#f1ce63', '#d37295', '#8cd17d', '#b6992d'
];

export function getClusterColor(index: number): string {
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}

// Category colors
export const CATEGORY_COLORS: Record<string, string> = {
  bug: '#e15759',
  feature_request: '#4e79a7',
  question: '#f28e2c',
  feedback: '#59a14f',
  discussion: '#76b7b2',
  documentation: '#edc949',
  enhancement: '#af7aa1',
  general: '#bab0ab'
};

export function getCategoryColor(category?: string): string {
  if (!category) return '#666666';
  return CATEGORY_COLORS[category] || '#666666';
}

// Extract label number from cluster name (e.g., "L3_2" -> 2)
function extractLabelFromName(name: string): number | undefined {
  const match = name.match(/^L\d+_(\d+)$/);
  return match ? parseInt(match[1]) : undefined;
}

// Build hierarchical tree from flat clusters
export function buildClusterHierarchy(clusters: Cluster[]): HierarchicalNode {
  const embeddingClusters = clusters.filter(c => c.cluster_type === 'embedding');

  const l1Clusters = embeddingClusters.filter(c => c.level === 1);
  const l2Clusters = embeddingClusters.filter(c => c.level === 2);
  const l3Clusters = embeddingClusters.filter(c => c.level === 3);

  // Build L3 nodes
  const l3Nodes: Map<number, HierarchicalNode> = new Map();
  for (const cluster of l3Clusters) {
    l3Nodes.set(cluster.id, {
      id: `l3-${cluster.id}`,
      name: cluster.pattern_name || cluster.name,
      summary: cluster.description || '',
      level: 3,
      size: cluster.comment_count,
      category: cluster.category || undefined,
      strength: cluster.strength || undefined,
      originalLabel: extractLabelFromName(cluster.name),
      children: []
    });
  }

  // Build L2 nodes with L3 children
  const l2Nodes: Map<number, HierarchicalNode> = new Map();
  for (const cluster of l2Clusters) {
    const children = l3Clusters
      .filter(l3 => l3.parent_id === cluster.id)
      .map(l3 => l3Nodes.get(l3.id)!)
      .filter(Boolean);

    l2Nodes.set(cluster.id, {
      id: `l2-${cluster.id}`,
      name: cluster.pattern_name || cluster.name,
      summary: cluster.description || '',
      level: 2,
      size: cluster.comment_count,
      category: cluster.category || undefined,
      strength: cluster.strength || undefined,
      originalLabel: extractLabelFromName(cluster.name),
      children
    });
  }

  // Build L1 nodes with L2 children
  const l1Nodes: HierarchicalNode[] = l1Clusters.map(cluster => {
    const children = l2Clusters
      .filter(l2 => l2.parent_id === cluster.id)
      .map(l2 => l2Nodes.get(l2.id)!)
      .filter(Boolean);

    return {
      id: `l1-${cluster.id}`,
      name: cluster.pattern_name || cluster.name,
      summary: cluster.description || '',
      level: 1,
      size: cluster.comment_count,
      category: cluster.category || undefined,
      strength: cluster.strength || undefined,
      originalLabel: extractLabelFromName(cluster.name),
      children
    };
  });

  // Root node
  return {
    id: 'root',
    name: 'All Clusters',
    summary: 'Semantic Clusters',
    level: 0,
    size: clusters.reduce((sum, c) => sum + c.comment_count, 0),
    children: l1Nodes
  };
}
```

## Main Page

Create `app/page.tsx`:

```typescript
// app/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { loadAllData } from '@/lib/data';
import { Item, Cluster, ColorMode, Filters, ViewMode } from '@/lib/types';
import { buildClusterHierarchy } from '@/lib/utils';
import { ScatterPlot } from '@/components/ScatterPlot';
import { HierarchicalView } from '@/components/HierarchicalView';

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchical');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const hierarchy = useMemo(() => {
    if (clusters.length === 0) return null;
    return buildClusterHierarchy(clusters);
  }, [clusters]);

  useEffect(() => {
    loadAllData().then(data => {
      setItems(data.items);
      setClusters(data.clusters);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading data...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold mb-2">No Data Found</h1>
          <p className="text-gray-400 mb-4">
            Make sure you have run the pipeline and exported data to public/data/
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Cluster Explorer</h1>
          <p className="text-sm text-gray-400">
            {items.length.toLocaleString()} items, {clusters.length} clusters
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('spatial')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'spatial' ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              Spatial
            </button>
            <button
              onClick={() => setViewMode('hierarchical')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'hierarchical' ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              Hierarchical
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden p-4">
        {viewMode === 'hierarchical' && hierarchy ? (
          <HierarchicalView
            hierarchy={hierarchy}
            items={items}
            onClusterSelect={(id, level) => console.log('Selected:', id, level)}
          />
        ) : (
          <ScatterPlot
            items={items}
            selectedItem={selectedItem}
            onItemSelect={setSelectedItem}
          />
        )}
      </div>
    </div>
  );
}
```

## Layout

Create `app/layout.tsx`:

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cluster Explorer',
  description: 'Interactive visualization of semantic clusters',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-white`}>
        {children}
      </body>
    </html>
  );
}
```

## Global Styles

Update `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-900 text-white;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgb(31, 41, 55);
}

::-webkit-scrollbar-thumb {
  background: rgb(75, 85, 99);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgb(107, 114, 128);
}
```

## Components

The `components/` directory in this skill contains ready-to-copy React components:

- **HierarchicalView.tsx** - Circle-packing visualization with drill-down navigation
- **ScatterPlot.tsx** - UMAP 2D scatter plot with zoom/pan

Copy these files directly to your project's `components/` directory.

See the [components/](components/) directory for the full implementations.

## Running the Visualizer

```bash
cd visualizer

# Development
npm run dev

# Production build
npm run build
npm start
```

The app will be available at http://localhost:3000

## Customization

### Adding New Views

Create new components in `components/` and add them to the view mode toggle in `page.tsx`.

### Changing Colors

Edit the color palettes in `lib/utils.ts`:
- `CLUSTER_COLORS` - For cluster coloring
- `CATEGORY_COLORS` - For category-based coloring

### Adding Filters

1. Add filter state to `page.tsx`
2. Create a `FilterPanel` component
3. Apply filters when rendering items

### Custom Metadata Display

Edit the item detail panel to show fields from your data's metadata.
