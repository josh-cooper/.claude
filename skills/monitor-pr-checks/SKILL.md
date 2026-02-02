---
name: monitor-pr-checks
description: Monitor GitHub PR checks until they complete. Use when the user asks to watch, monitor, or track PR checks, CI status, or wait for CI to pass.
allowed-tools: Bash, Read, Task
---

# Monitor PR Checks

Monitor GitHub PR checks until they complete. Works with any CI system that reports status to GitHub.

## Arguments

- PR URL (e.g., `https://github.com/owner/repo/pull/123`)
- PR number (e.g., `123`) - uses current repo
- Branch name (e.g., `my-feature-branch`) - finds PR for that branch
- No argument - uses current branch

## Instructions

### 1. Determine the PR to Monitor

```bash
# If PR URL provided, extract owner/repo and PR number
# If PR number provided, use current repo
# If branch name provided, find PR for that branch
# If no argument, get current branch and find its PR

# Get current branch if needed
git rev-parse --abbrev-ref HEAD

# Find PR for current branch
gh pr view --json number,url,headRefName,title,state

# Get repo info
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

### 2. Get Initial Check Status

```bash
# Get all checks for the PR
gh pr checks <PR_NUMBER> --json name,state,conclusion,startedAt,completedAt
```

Check states:
- `PENDING` / `QUEUED` / `IN_PROGRESS` - still running
- `COMPLETED` - finished (check conclusion for pass/fail)

Conclusions:
- `SUCCESS` - passed
- `FAILURE` - failed
- `CANCELLED` - was cancelled
- `SKIPPED` - was skipped (counts as passed)
- `NEUTRAL` - neutral result (counts as passed)

### 3. Launch Background Monitor

Launch a background agent to poll for completion:

```
Task tool:
  subagent_type: general-purpose
  run_in_background: true
  prompt: |
    Monitor GitHub PR checks for PR #<NUMBER> in <OWNER>/<REPO>.

    Poll every 45 seconds using:
    gh pr checks <NUMBER> --repo <OWNER>/<REPO> --json name,state,conclusion

    Continue polling until ALL checks have completed (no PENDING/QUEUED/IN_PROGRESS states).

    When all checks complete:
    1. Count passed (conclusion: SUCCESS/SKIPPED/NEUTRAL)
    2. Count failed (conclusion: FAILURE)
    3. Count cancelled (conclusion: CANCELLED)
    4. Report summary with list of any failed checks

    If any check fails, include the check name so user knows what to investigate.

    PR URL: <URL>
```

### 4. Report Initial Status

Tell the user:
- Which PR is being monitored (number, title, URL)
- Current check status (X running, Y completed)
- That they'll be notified when complete

## Example Output

**Starting:**
```
Monitoring PR #123: "Add new feature"
https://github.com/owner/repo/pull/123

Current status: 5 checks running, 2 passed
- ✅ lint
- ✅ type-check
- 🔄 test (in progress)
- 🔄 build (in progress)
- 🔄 security-scan (in progress)
- ⏳ coverage (queued)
- ⏳ deploy-preview (queued)

I'll notify you when all checks complete.
```

**Completed (success):**
```
✅ PR #123 - All 7 checks passed!

- ✅ lint
- ✅ type-check
- ✅ test
- ✅ build
- ✅ security-scan
- ✅ coverage
- ✅ deploy-preview
```

**Completed (failure):**
```
❌ PR #123 - 2 of 7 checks failed

Failed:
- ❌ test
- ❌ coverage

Passed:
- ✅ lint
- ✅ type-check
- ✅ build
- ✅ security-scan
- ✅ deploy-preview

Check the PR page or run `gh pr checks 123` for details.
```

## Notes

- Works with any CI that reports to GitHub (GitHub Actions, CircleCI, Travis, Buildkite, etc.)
- Uses background agents so you can continue working while waiting
- For interactive terminal monitoring, use `gh pr checks --watch` directly
