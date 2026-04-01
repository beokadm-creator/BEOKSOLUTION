---
precedence: 95
required-for:
  - markdown-maintenance
  - ai-doc-processing
optional-for:
  - repo-orientation
memory-type: policy
token-estimate: 1100
@include:
  - ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Introduced repository-wide markdown governance rules.
---

# AI Doc Shared Rules

<!-- STATIC:BEGIN -->

This file defines the repository-wide markdown governance system.

## Precedence

When two markdown files conflict, resolve in this order:

1. Higher numeric `precedence`
2. More specific path scope
3. Newer `changelog` entry
4. Non-archive document over archive document

Recommended scale:

- `100`: Canonical repository workflow and hard policy
- `90-99`: Shared policy and root/path-specific agent rules
- `75-89`: Active operational guides
- `50-74`: Reference material and runbooks
- `20-49`: Drafts, reports, and temporary planning docs
- `0-19`: Historical archive only

## STATIC/DYNAMIC Markers

- `<!-- STATIC:BEGIN --> ... <!-- STATIC:END -->`
  Use for durable instructions, architecture, conventions, and reference material that AI may cache.
- `<!-- DYNAMIC:BEGIN --> ... <!-- DYNAMIC:END -->`
  Use for versions, current status, recent observations, owners, and volatile notes that should be refreshed.

## `@include`

- Use `@include` in frontmatter to point to shared rules or supporting docs.
- Shared rules should live in `docs/shared/`.
- Prefer includes over copying the same policy into multiple files.

## Essential (Post-Compact)

Each important doc should preserve a short `Essential (Post-Compact)` section that survives aggressive summarization. Keep it to the few rules that must still hold after compaction.

## `required-for` and `optional-for`

- `required-for`: tasks that should always load this file
- `optional-for`: tasks that may consult this file for extra context

Use short task labels such as `all-code-changes`, `deployment-review`, `repo-orientation`, `multi-tenant-routing`.

## `memory-type`

Suggested values:

- `policy`
- `workflow`
- `overview`
- `architecture`
- `reference`
- `runbook`
- `report`
- `draft`
- `archive`

## `token-estimate`

- Record an approximate token budget for the whole file.
- Use it to keep active docs intentionally compact.
- When a file grows too large, split stable shared rules into `docs/shared/` and demote historical detail to `docs/archive/`.

## `changelog`

Every managed markdown file should keep a lightweight in-file changelog in frontmatter with:

- `version`
- `date`
- `summary`

## Shared Rules

Common rules belong in `docs/shared/`. Active docs should reference shared rules through `@include` instead of restating them.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Current markdown governance schema introduced on 2026-04-02.

<!-- DYNAMIC:END -->
