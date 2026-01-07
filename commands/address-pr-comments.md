---
description: Analyze and address GitHub PR review comments using Bostrom's Reversal Check
argument-hint: <pr-number> [--repo owner/repo]
---

# Address PR Review Comments

Systematically analyze and address code review comments on a GitHub pull request using Bostrom's Reversal Check framework to evaluate each suggestion's merit.

## Arguments

- `$1`: PR number (required)
- `$2`: Repository in `owner/repo` format (optional, defaults to current repo)

## Current Context

- Repository: !`gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "unknown"`
- Current branch: !`git branch --show-current`

---

## Phase 1: Fetch Review Comments

First, retrieve all inline review comments from the PR using the GitHub CLI.

### Commands to fetch comments:

```bash
# Get inline review comments with file, line, author, and body
gh api repos/{owner}/{repo}/pulls/{pr}/comments --jq '.[] | {id: .id, author: .user.login, path: .path, line: (.line // .original_line), body: .body}'

# Get review thread IDs (needed for resolving)
gh api graphql -f query='
query {
  repository(owner: "{owner}", name: "{repo}") {
    pullRequest(number: {pr}) {
      reviewThreads(first: 50) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              databaseId
              body
              author { login }
            }
          }
        }
      }
    }
  }
}'
```

---

## Phase 2: Analyze Each Comment

For each comment, spawn a sub-agent to perform independent analysis. Use the Task tool with `subagent_type="general-purpose"`.

### Analysis Framework (Bostrom's Reversal Check)

Each sub-agent should evaluate:

#### 1. Is the suggestion warranted?

- **Factual accuracy**: Does the reviewer's claim hold up? (e.g., "this pattern exists in file X" - verify it)
- **Context awareness**: Does the reviewer understand the PR's scope and intent?
- **Codebase consistency**: Does the suggestion align with or contradict existing patterns?

Assume ~50% of suggestions are warranted and ~50% are not (misunderstandings, lack of context, or genuinely bad suggestions).

#### 2. Reversal Check

> "If change X was applied, would it produce a similar critique from the opposite direction?"

Examples:
- Suggestion: "Add defensive null check" → Reversal: "Unnecessary defensive programming, the value is guaranteed non-null"
- Suggestion: "Add JSDoc comments" → Reversal: "Over-documented, functions are self-explanatory"
- Suggestion: "Extract to shared utility" → Reversal: "Premature abstraction, only used once"
- Suggestion: "Add error handling" → Reversal: "Error can never occur in this context, dead code"

If the reversal produces an equally valid critique, the original suggestion likely has low value.

#### 3. Importance Rating

| Rating | Criteria |
|--------|----------|
| **Critical** | Security vulnerability, data loss risk, or broken functionality |
| **Major** | Bug, significant performance issue, or violation of critical standards |
| **Minor** | Improvement to maintainability, DX, or consistency |
| **Nit** | Stylistic preference, optional enhancement, or housekeeping |

#### 4. Recommendation

- **FIX**: Warranted, passes reversal check, importance >= Minor
- **SKIP**: Not warranted, fails reversal check, or Nit-level
- **DEFER**: Valid but out of scope, add to future housekeeping

### Sub-agent Prompt Template

```
Analyze this code review comment using Bostrom's Reversal Check framework:

**Comment from:** {author}
**File:** {path}:{line}
**Suggestion:** {body_summary}

**Analysis required:**
1. Is this warranted? Verify any factual claims by reading relevant files.
2. Apply the Reversal Check: If we implement this, what opposite critique might we receive?
3. Rate importance: Critical / Major / Minor / Nit
4. Check codebase patterns: Does the existing codebase support or contradict this suggestion?

Return a structured assessment:
- Warranted: Yes/No/Partially
- Reversal Risk: High/Medium/Low (with example reversal critique)
- Importance: Critical/Major/Minor/Nit
- Recommendation: FIX/SKIP/DEFER
- Reasoning: Brief explanation
```

---

## Phase 3: Generate Report

Compile sub-agent findings into a summary table:

```markdown
| # | Source | File | Suggestion | Warranted? | Reversal Risk | Importance | Recommendation |
|---|--------|------|------------|------------|---------------|------------|----------------|
| 1 | {author} | {file}:{line} | {summary} | Yes/No | High/Med/Low | Major | FIX |
| 2 | ... | ... | ... | ... | ... | ... | ... |
```

Include detailed findings for each comment explaining the reasoning.

---

## Phase 4: Present Plan for Review

Before making any changes, present the plan to the user:

1. **Comments to FIX**: List with approach for each
2. **Comments to SKIP**: List with justification
3. **Comments to DEFER**: List for future housekeeping

Ask user to confirm or modify the plan before proceeding.

---

## Phase 5: Apply Changes (if any)

For comments marked FIX:

### Simple/Related Changes
Group small related changes and assign to a single sub-agent:
- Use Task tool with clear instructions
- Sub-agent makes edits and commits

### Complex Changes
For each complex change:
1. Spawn a sub-agent to create a focused implementation plan
2. Review plans sequentially
3. Apply each plan using a fresh sub-agent to manage context

### Commit Strategy
- One commit per logical group of related fixes
- Commit message should reference the review comment being addressed

---

## Phase 6: Respond to Comments

After changes are applied (or for SKIP/DEFER items), respond to each comment individually.

### Reply to a comment:

```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
  -f body="Your response here"
```

### Resolve a thread:

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {
    threadId: "{thread_id}"
  }) {
    thread { isResolved }
  }
}'
```

### Response Templates

**For FIX:**
> Fixed in {commit_sha}. {brief explanation of change}

**For SKIP (not warranted):**
> {Explanation of why suggestion doesn't apply, with evidence}

**For SKIP (reversal check failed):**
> Following established codebase pattern in {file/location}. {Explanation of existing convention}

**For DEFER:**
> Valid suggestion - will address in a future housekeeping PR. {brief note on why deferring}

---

## Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ 1. FETCH         gh api .../pulls/{pr}/comments             │
├─────────────────────────────────────────────────────────────┤
│ 2. ANALYZE       Sub-agents evaluate each comment           │
│                  - Warranted? (verify claims)               │
│                  - Reversal Check (opposite critique?)      │
│                  - Importance rating                        │
│                  - Recommendation: FIX/SKIP/DEFER           │
├─────────────────────────────────────────────────────────────┤
│ 3. REPORT        Generate summary table + detailed findings │
├─────────────────────────────────────────────────────────────┤
│ 4. PLAN          Present to user for review                 │
│                  - What to fix and how                      │
│                  - What to skip and why                     │
│                  - User confirms/modifies                   │
├─────────────────────────────────────────────────────────────┤
│ 5. APPLY         Sub-agents implement approved fixes        │
│                  - Group simple related changes             │
│                  - Plan then apply complex changes          │
│                  - Commit with references                   │
├─────────────────────────────────────────────────────────────┤
│ 6. RESPOND       Reply to + resolve each comment            │
│                  - gh api .../comments/{id}/replies         │
│                  - gh api graphql resolveReviewThread       │
└─────────────────────────────────────────────────────────────┘
```

---

## Usage Examples

```bash
# Address comments on PR #134 in current repo
/address-pr-comments 134

# Address comments on PR in specific repo
/address-pr-comments 456 rdytech/emtech-noema
```

---

## Begin

Fetch the review comments for PR $1 and begin Phase 1. After fetching, spawn sub-agents to analyze each comment in parallel (Phase 2), then generate the report (Phase 3) and present the plan for my review (Phase 4).

Do not proceed to Phase 5 (Apply Changes) or Phase 6 (Respond) until I approve the plan.
