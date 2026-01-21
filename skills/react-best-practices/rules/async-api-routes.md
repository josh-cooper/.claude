---
title: Parallelize Operations in Route Handlers
impact: CRITICAL
impactDescription: 2-10× improvement
tags: api-routes, route-handlers, server-actions, waterfalls, parallelization
---

## Parallelize Operations in Route Handlers

> **When to use Route Handlers:** Only create Route Handlers (API routes) when you need: endpoints for non-React clients, polling/WebSocket connections, explicit cache headers, or shared endpoints across multiple consumers. For simple mutations, use Server Actions instead. See the Data Fetching Patterns guide.

In Route Handlers and Server Actions, start independent operations immediately to avoid waterfall chains.

**Incorrect (config waits for auth, data waits for both):**

```typescript
export async function GET(request: Request) {
  const session = await auth()
  const config = await fetchConfig()
  const data = await fetchData(session.user.id)
  return Response.json({ data, config })
}
```

**Correct (auth and config start immediately):**

```typescript
export async function GET(request: Request) {
  const sessionPromise = auth()
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id)
  ])
  return Response.json({ data, config })
}
```

For operations with more complex dependency chains, use `better-all` to automatically maximize parallelism (see Dependency-Based Parallelization).
