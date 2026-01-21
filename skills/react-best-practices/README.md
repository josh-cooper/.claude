# React Best Practices

A structured repository for creating and maintaining React Best Practices optimized for agents and LLMs.

## Fork Notes

This skill is forked from [Vercel's React Best Practices](https://github.com/vercel/react-best-practices) with modifications to remove Vercel-specific bias and make the guidance more framework-agnostic.

### Changes from upstream

**Library recommendations:**
- Replaced SWR with TanStack Query throughout (more widely used, more features)
- `client-swr-dedup.md` → `client-tanstack-query-dedup.md`

**Framework-agnostic patterns:**
- Added `React.lazy()` + `Suspense` as the primary pattern alongside `next/dynamic`
- Generalized deployment advice (removed Vercel Fluid Compute promotion)
- Removed `@vercel/analytics` examples, replaced with generic placeholders

**Data fetching guidance:**
- Added `data-fetching-patterns.md` decision guide for choosing the right approach
- Server Components → URL params → Server Actions → Route Handlers → TanStack Query
- Updated related rules to cross-reference this decision framework
- Emphasis on server-first patterns; client-side fetching as last resort

**Documentation updates:**
- Updated `server-auth-actions.md` to reference React docs instead of Next.js docs
- Reframed Server Actions as a React feature (not Next.js-specific)
- Renamed skill from `vercel-react-best-practices` to `react-best-practices`

### What we kept

- Next.js remains a primary example framework (it's the most-used RSC framework)
- Next.js-specific APIs (`next/dynamic`, `after()`) are shown where relevant
- Core performance patterns are unchanged - Vercel's engineering advice is solid
- Original rule structure and categorization

## Structure

- `rules/` - Individual rule files (one per rule)
  - `_sections.md` - Section metadata (titles, impacts, descriptions)
  - `_template.md` - Template for creating new rules
  - `area-description.md` - Individual rule files
- `src/` - Build scripts and utilities
- `metadata.json` - Document metadata (version, organization, abstract)
- __`AGENTS.md`__ - Compiled output (generated)
- __`test-cases.json`__ - Test cases for LLM evaluation (generated)

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build AGENTS.md from rules:
   ```bash
   pnpm build
   ```

3. Validate rule files:
   ```bash
   pnpm validate
   ```

4. Extract test cases:
   ```bash
   pnpm extract-tests
   ```

## Creating a New Rule

1. Copy `rules/_template.md` to `rules/area-description.md`
2. Choose the appropriate area prefix:
   - `async-` for Eliminating Waterfalls (Section 1)
   - `bundle-` for Bundle Size Optimization (Section 2)
   - `server-` for Server-Side Performance (Section 3)
   - `client-` for Client-Side Data Fetching (Section 4)
   - `rerender-` for Re-render Optimization (Section 5)
   - `rendering-` for Rendering Performance (Section 6)
   - `js-` for JavaScript Performance (Section 7)
   - `advanced-` for Advanced Patterns (Section 8)
3. Fill in the frontmatter and content
4. Ensure you have clear examples with explanations
5. Run `pnpm build` to regenerate AGENTS.md and test-cases.json

## Rule File Structure

Each rule file should follow this structure:

```markdown
---
title: Rule Title Here
impact: MEDIUM
impactDescription: Optional description
tags: tag1, tag2, tag3
---

## Rule Title Here

Brief explanation of the rule and why it matters.

**Incorrect (description of what's wrong):**

```typescript
// Bad code example
```

**Correct (description of what's right):**

```typescript
// Good code example
```

Optional explanatory text after examples.

Reference: [Link](https://example.com)

## File Naming Convention

- Files starting with `_` are special (excluded from build)
- Rule files: `area-description.md` (e.g., `async-parallel.md`)
- Section is automatically inferred from filename prefix
- Rules are sorted alphabetically by title within each section
- IDs (e.g., 1.1, 1.2) are auto-generated during build

## Impact Levels

- `CRITICAL` - Highest priority, major performance gains
- `HIGH` - Significant performance improvements
- `MEDIUM-HIGH` - Moderate-high gains
- `MEDIUM` - Moderate performance improvements
- `LOW-MEDIUM` - Low-medium gains
- `LOW` - Incremental improvements

## Scripts

- `pnpm build` - Compile rules into AGENTS.md
- `pnpm validate` - Validate all rule files
- `pnpm extract-tests` - Extract test cases for LLM evaluation
- `pnpm dev` - Build and validate

## Contributing

When adding or modifying rules:

1. Use the correct filename prefix for your section
2. Follow the `_template.md` structure
3. Include clear bad/good examples with explanations
4. Add appropriate tags
5. Run `pnpm build` to regenerate AGENTS.md and test-cases.json
6. Rules are automatically sorted by title - no need to manage numbers!

## Acknowledgments

Originally created by [@shuding](https://x.com/shuding) at Vercel. Forked and de-Vercelled for framework-agnostic use.
