---
title: Choose the Right Data Fetching Pattern
impact: CRITICAL
impactDescription: correct architecture prevents over-engineering and improves performance
tags: data-fetching, server-components, server-actions, route-handlers, architecture
---

## Choose the Right Data Fetching Pattern

Use the right data fetching approach for each situation. Start server-side; only reach for client-side fetching when necessary.

### Core Principle: Server-First

Data required to render a page should be fetched in Server Components and passed to Client Components via props.

**Correct (fetch in Server Component, pass to Client):**

```tsx
// app/dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  const data = await fetchDashboardData()
  return <DashboardClient data={data} />
}
```

**Incorrect (fetching in Client Component when data is static):**

```tsx
'use client'
export default function DashboardPage() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData)
  }, [])
}
```

### Pattern Decision Guide

| Scenario | Pattern |
|----------|---------|
| Initial page/component data | Server Component |
| Filters, pagination, sorting | URL params + Server Component |
| Form submissions | Server Action |
| Button-triggered mutations | Server Action |
| Polling/WebSocket endpoints | Route Handler |
| External API consumers | Route Handler |
| Optimistic updates needed | TanStack Query |
| Background refetching needed | TanStack Query |

### When Each Pattern Applies

**Server Components** - Default for all initial data. Fetch in `page.tsx`, `layout.tsx`, or RSCs.

**URL Query Parameters** - For view state (filters, pagination, sorting). Server Component reads `searchParams`, Client Component mutates URL with `router.replace()`.

**Server Actions** - For mutations triggered by user actions (forms, buttons). Don't create API routes for simple mutations.

**Route Handlers** - Only when you need: endpoints for non-React clients, polling/long-running connections, explicit cache control, or shared endpoints across consumers.

**TanStack Query** - Only when you genuinely need: automatic retries, background refetching, optimistic updates, or fine-grained client-side cache control. If Server Components + URL params + Server Actions can handle it, don't reach for TanStack Query.

### Anti-Patterns

1. **useEffect for initial data** - Fetch in Server Component instead
2. **API routes for simple mutations** - Use Server Actions
3. **Client state for URL-representable filters** - Use query params
4. **TanStack Query for static data** - Use Server Components
5. **Client fetching when data doesn't depend on client-only state**

### When Client-Side Fetching IS Appropriate

- Data depends on client-only information (geolocation, localStorage)
- Real-time updates via WebSocket/SSE
- Infinite scroll with complex loading states
- Optimistic UI requiring rollback on failure
- Third-party widgets requiring client-side auth

Reference: [React Server Components](https://react.dev/reference/rsc/server-components)
