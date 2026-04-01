---
precedence: 94
required-for:
  - markdown-maintenance
  - ai-doc-processing
optional-for:
  - repo-orientation
memory-type: policy
token-estimate: 500
@include:
  - AI_DOC_SHARED_RULES.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Added compact-survival rules for markdown summarization.
---

# Essential Post-Compact

<!-- STATIC:BEGIN -->

Keep these rules visible even after aggressive summarization:

- Prefer active docs over archive docs.
- Respect `precedence` before recency or convenience.
- Treat `STATIC` blocks as cacheable and `DYNAMIC` blocks as refresh targets.
- Use `@include` instead of duplicating shared policy.
- Keep each file's role explicit through `required-for`, `optional-for`, and `memory-type`.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

No volatile content.

<!-- DYNAMIC:END -->
