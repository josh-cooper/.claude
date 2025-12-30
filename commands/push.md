---
description: Branch off main, commit, push, and create PR
allowed-tools: Bash(git:*), Bash(gh:*)
---

Create a fresh branch off main, commit changes, push, and create a PR.

## Current State

- Current branch: !`git branch --show-current`
- Git status: !`git status --short`
- Uncommitted changes: !`git diff --stat`

## Making a Branch Up to Date with Main

If working on an existing branch that needs to be updated with latest main:

1. **Get fresh main**: `git checkout main && git pull origin main`
2. **Try plain rebase**: `git checkout <branch> && git rebase main`
   - This might fail since we often branch off another branch that has since been squashed and merged
3. **If rebase fails, try rebase-onto**: `git rebase --onto main <old-base-commit> <branch>`
4. **If rebase-onto doesn't work, try cherry-pick**:
   - `git checkout main && git checkout -b <new-branch>`
   - `git cherry-pick <commit1> <commit2>...` (pick only the commits from your work)
5. **If cherry-pick has conflicts, ask the user**: At this point the conflicts may be complex
6. **Last resort**: If nothing else works or it's too complex/dangerous, consider merge or ask user

## Your Task (Creating Fresh Branch)

1. **Stash any uncommitted changes** to preserve them
2. **Switch to main and pull latest**: `git checkout main && git pull origin main`
3. **Create new branch**: Suggest a branch name based on what we're working on
4. **Restore stashed changes**: `git stash pop`
5. **Stage the relevant files**: Based on context, stage only the files related to what we're working on
6. **Unstage other files**: Leave other unrelated changes unstaged
7. **Draft a commit message**: Write a concise commit message based on the changes
8. **Commit the changes**
9. **Push branch**: `git push -u origin <branch-name>`
10. **Create PR**: Use `gh pr create` with:
    - Title: Same as commit message
    - Body: Draft a SHORT description following the strict format below
    - Base: `main`

## PR Description Format (STRICT)

The PR description MUST follow this exact format:

```
[One sentence describing the general thrust of the PR]

- [Change 1]
- [Change 2]
- [Change 3]
```

**Rules:**
- NO headings like "Changes:", "Summary:", etc.
- NO verbose explanations
- Just a single sentence followed by simple bullet points
- Keep it concise and to the point

## Example

If commit message is "Fix dashboard env vars timing", the PR body should be:

```
Fixes environment variables being read at build time instead of runtime in the internal dashboard.

- Read INTERNAL_API_SECRET at runtime in isNoemaApiConfigured()
- Read INTERNAL_API_SECRET and NOEMA_API_BASE_URL at runtime in noemaFetch()
```

NOT:

```
## Summary
This PR fixes an issue where...

## Changes
- Changed the following...
```
