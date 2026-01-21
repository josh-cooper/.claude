---
title: Use TanStack Query for Automatic Deduplication
impact: MEDIUM-HIGH
impactDescription: automatic deduplication
tags: client, tanstack-query, deduplication, data-fetching
---

## Use TanStack Query for Automatic Deduplication

TanStack Query enables request deduplication, caching, and revalidation across component instances.

> **When to use:** Only reach for TanStack Query when you genuinely need client-side features like automatic retries, background refetching, or optimistic updates. For most data needs, prefer Server Components + URL params + Server Actions. See the Data Fetching Patterns guide.

**Incorrect (useEffect for data that could be server-fetched):**

```tsx
function UserList() {
  const [users, setUsers] = useState([])
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers)
  }, [])
}
```

**Correct (multiple instances share one request):**

```tsx
import { useQuery } from '@tanstack/react-query'

function UserList() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json())
  })
}
```

**For immutable/static data (data that rarely changes):**

```tsx
import { useQuery } from '@tanstack/react-query'

function StaticContent() {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
    staleTime: Infinity,  // Never considered stale
    gcTime: Infinity      // Never garbage collected
  })
}
```

**For mutations:**

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

function UpdateButton() {
  const queryClient = useQueryClient()
  const { mutate } = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
  return <button onClick={() => mutate()}>Update</button>
}
```

**When TanStack Query is the right choice:**

- Optimistic updates with rollback on failure
- Background refetching while user interacts
- Infinite scroll with complex loading states
- Data depending on client-only state (geolocation, localStorage)
- Polling or real-time updates on the client

If none of these apply, consider Server Components instead.

Reference: [https://tanstack.com/query](https://tanstack.com/query)
