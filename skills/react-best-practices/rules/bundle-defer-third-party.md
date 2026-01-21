---
title: Defer Non-Critical Third-Party Libraries
impact: MEDIUM
impactDescription: loads after hydration
tags: bundle, third-party, analytics, defer, react-lazy, suspense, next-dynamic
---

## Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them after hydration.

**Incorrect (blocks initial bundle):**

```tsx
import { AnalyticsTracker } from 'some-analytics-library'

export default function App({ children }) {
  return (
    <div>
      {children}
      <AnalyticsTracker />
    </div>
  )
}
```

**Correct - React.lazy() + Suspense (standard React pattern):**

```tsx
import { lazy, Suspense } from 'react'

const AnalyticsTracker = lazy(() =>
  import('some-analytics-library').then(m => ({ default: m.AnalyticsTracker }))
)

export default function App({ children }) {
  return (
    <div>
      {children}
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
    </div>
  )
}
```

**Correct - next/dynamic (Next.js alternative with SSR control):**

```tsx
import dynamic from 'next/dynamic'

const AnalyticsTracker = dynamic(
  () => import('some-analytics-library').then(m => m.AnalyticsTracker),
  { ssr: false }
)

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <AnalyticsTracker />
      </body>
    </html>
  )
}
```

> **Note:** For client-only third-party scripts (analytics, error tracking), `next/dynamic` with `{ ssr: false }` ensures the code only runs in the browser. React.lazy() works for CSR apps but doesn't prevent SSR attempts.
