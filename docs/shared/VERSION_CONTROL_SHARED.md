---
precedence: 93
required-for:
  - all-code-changes
  - release-work
optional-for:
  - documentation-only-review
memory-type: policy
token-estimate: 650
@include:
  - AI_DOC_SHARED_RULES.md
  - ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Extracted shared version-control rules from duplicated operational docs.
---

# Version Control Shared Rules

<!-- STATIC:BEGIN -->

## Core Rules

- Work on a feature or fix branch, never directly on `main`.
- Do not delete, move, or rewrite protected tags.
- Do not bypass hooks or required validation.
- Use PRs for merge into protected branches.

## Minimum Validation

- `npm run lint`
- `npm test`
- Any task-specific build checks relevant to touched areas

## Rollback Safety

- Prefer forward fixes over history rewrites.
- Use new branches and PRs for remediation.
- Treat protected history and tags as immutable baselines.

## Essential (Post-Compact)

- Branch first
- Validate locally
- PR before merge
- No protected-history rewrites

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Shared policy aligned to release tag `v1.0.1` as of 2026-04-02.

<!-- DYNAMIC:END -->
