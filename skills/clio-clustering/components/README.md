# Ready-to-Copy Components

These React components can be copied directly into your visualizer project.

## Files

- **HierarchicalView.tsx** - Circle-packing visualization with drill-down navigation
- **ScatterPlot.tsx** - UMAP 2D scatter plot with zoom/pan

## Installation

1. Copy the components to your project:
   ```bash
   cp ~/.claude/skills/clio-clustering/components/*.tsx visualizer/components/
   ```

2. Make sure you have the required dependencies:
   ```bash
   cd visualizer
   npm install d3 @types/d3 framer-motion lucide-react
   ```

3. Adjust the import paths to match your project structure:
   - Update `@/lib/types` to point to your types file
   - Update `@/lib/utils` to point to your utils file

## Type Requirements

Your `lib/types.ts` should include these interfaces:

```typescript
export interface Item {
  id: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string | null;
  x: number;  // UMAP x coordinate
  y: number;  // UMAP y coordinate
  cluster_l1: number | null;
  cluster_l2: number | null;
  cluster_l3: number | null;
}

export interface HierarchicalNode {
  id: string;
  name: string;
  summary: string;
  level: number;
  size: number;
  category?: string;
  strength?: number;
  originalLabel?: number;  // Maps to cluster_l1/l2/l3
  children: HierarchicalNode[];
}

export type ColorMode = 'l1' | 'l2' | 'l3' | 'category';
```

## Utility Requirements

Your `lib/utils.ts` should include:

```typescript
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function getCategoryColor(category?: string): string {
  const colors: Record<string, string> = {
    bug: '#e15759',
    feature_request: '#4e79a7',
    question: '#f28e2c',
    feedback: '#59a14f',
    discussion: '#76b7b2',
    general: '#bab0ab'
  };
  return category ? colors[category] || '#666666' : '#666666';
}

export function getClusterColor(index: number): string {
  const colors = [
    '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
    '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
  ];
  return colors[index % colors.length];
}

export const CLUSTER_COLORS = [
  '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
];
```

## Customization

### Changing the Legend

Edit the legend section in `HierarchicalView.tsx` (around line 450) to match your categories:

```tsx
{Object.entries({
  your_category: 'Display Name',
  another_category: 'Another Name',
  // ...
}).map(([key, label]) => (
  // ...
))}
```

### Changing Colors

Edit `lib/utils.ts` to customize:
- `CLUSTER_COLORS` - Colors for cluster indices
- `getCategoryColor()` - Colors for category names

### Adding Item Details

In the leaf detail view, customize what metadata is shown in the selected item panel (around line 300 in HierarchicalView.tsx).
