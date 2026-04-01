---
precedence: 85
required-for:
  - branch-management
  - commit-preparation
  - pull-request-work
optional-for:
  - release-review
memory-type: workflow
token-estimate: 318
@include:
  - shared/AI_DOC_SHARED_RULES.md
  - shared/ESSENTIAL_POST_COMPACT.md
  - shared/VERSION_CONTROL_SHARED.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Replaced duplicate branch-protection prose with the canonical git workflow.
---

# Git Workflow

<!-- STATIC:BEGIN -->

This document describes the working git path for this repository. It complements `../MANDATORY_WORKFLOW.md` and should be read as the practical sequence for day-to-day branch work.

## Standard Flow

1. Check the current branch and worktree.
2. Create a feature or fix branch.
3. Make the smallest safe change set.
4. Run validation.
5. Commit with hooks enabled.
6. Push the branch.
7. Open a PR.
8. Wait for CI and review.

## Recommended Commands

```bash
git status --short
git checkout -b feature/short-description
npm run lint
npm test
git add <files>
git commit -m "docs: normalize markdown governance"
git push -u origin feature/short-description
```

## Forbidden Shortcuts

- Direct push to `main`
- `git commit --no-verify`
- Force-pushing protected branches
- Tag mutation or deletion

## Conflict Rule

If workflow instructions conflict:

1. Path-specific `AGENTS.md`
2. `../MANDATORY_WORKFLOW.md`
3. This file
4. Historical docs in `archive/`

## Essential (Post-Compact)

- Use branches, not `main`.
- Keep hooks on.
- PRs are required.
- Protected history is not a rollback tool.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Current protected release tag referenced by active docs: `v1.0.1`.

<!-- DYNAMIC:END -->
