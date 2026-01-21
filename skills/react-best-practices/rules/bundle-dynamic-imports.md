---
title: Dynamic Imports for Heavy Components
impact: CRITICAL
impactDescription: directly affects TTI and LCP
tags: bundle, dynamic-import, code-splitting, react-lazy, suspense, next-dynamic
---

## Dynamic Imports for Heavy Components

Use lazy loading to defer large components not needed on initial render.

**Incorrect (Monaco bundles with main chunk ~300KB):**

```tsx
import { MonacoEditor } from './monaco-editor'

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />
}
```

**Correct - React.lazy() + Suspense (standard React pattern):**

```tsx
import { lazy, Suspense } from 'react'

const MonacoEditor = lazy(() =>
  import('./monaco-editor').then(m => ({ default: m.MonacoEditor }))
)

function CodePanel({ code }: { code: string }) {
  return (
    <Suspense fallback={<div>Loading editor...</div>}>
      <MonacoEditor value={code} />
    </Suspense>
  )
}
```

**Correct - next/dynamic (Next.js alternative with SSR control):**

```tsx
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(
  () => import('./monaco-editor').then(m => m.MonacoEditor),
  { ssr: false, loading: () => <div>Loading editor...</div> }
)

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />
}
```

> **Note:** React.lazy() doesn't support SSR out of the box. In Next.js, use `next/dynamic` with `{ ssr: false }` for client-only components like Monaco that depend on browser APIs.
