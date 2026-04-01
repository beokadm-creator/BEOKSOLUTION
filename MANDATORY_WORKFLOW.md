---
precedence: 100
required-for:
  - all-code-changes
  - release-work
  - deployment-work
optional-for:
  - documentation-only-review
memory-type: policy
token-estimate: 415
@include:
  - docs/shared/AI_DOC_SHARED_RULES.md
  - docs/shared/ESSENTIAL_POST_COMPACT.md
  - docs/shared/VERSION_CONTROL_SHARED.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Rewritten as the canonical workflow document with shared rules extracted.
---

# Mandatory Workflow

<!-- STATIC:BEGIN -->

This is the authoritative workflow document for repository changes. If another general workflow document disagrees, this file wins unless a more specific `AGENTS.md` with higher effective precedence applies to the exact path you are changing.

## Pre-Work Checklist

1. Read `AGENTS.md`.
2. Confirm the current release tag with `git describe --tags --abbrev=0`.
3. Work on a feature or fix branch only.
4. Verify the standard runtime target is Node 22.x.
5. Review the active docs instead of relying on `docs/archive/`.

## Mandatory Execution Order

1. Inspect the current branch and worktree before editing.
2. Create or switch to a task-specific branch.
3. Make changes with the smallest safe scope.
4. Run the relevant checks before commit.
5. Commit without bypassing hooks.
6. Push the feature branch and open a PR.
7. Wait for CI/CD and review before merge.

## Hard Stops

- Do not commit directly to `main`.
- Do not force-push protected branches.
- Do not alter or delete release tags.
- Do not use `git commit --no-verify`.
- Do not treat historical archive docs as current policy.

## Required Local Validation

- `npm run lint`
- `npm test`
- Additional task-specific build or function checks when relevant

## Essential (Post-Compact)

- Branch first.
- Validate before commit.
- PR before merge.
- Never roll back by rewriting protected history.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Observed during this cleanup:

- Current latest tag: `v1.0.1`
- Existing local Node runtime in this workspace: `v24.13.0`
- Repository standard remains Node 22.x for project work and CI

<!-- DYNAMIC:END -->
