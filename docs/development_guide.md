---
precedence: 80
required-for:
  - local-development
  - test-running
optional-for:
  - onboarding
  - build-debugging
memory-type: workflow
token-estimate: 317
@include:
  - shared/AI_DOC_SHARED_RULES.md
  - shared/ESSENTIAL_POST_COMPACT.md
  - shared/VERSION_CONTROL_SHARED.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Condensed setup instructions and aligned runtime guidance to Node 22.
---

# Development Guide

<!-- STATIC:BEGIN -->

Use this document for current local setup and day-to-day development. Historical setup experiments belong in `docs/archive/`.

## Runtime Baseline

- Node: `22.x`
- Package manager: `npm`
- Frontend dev server: Vite on port `5173`
- Functions runtime target: Node `22`

## Initial Setup

```bash
npm install
cd functions
npm install
cd ..
```

## Daily Commands

```bash
npm run dev
npm run build
npm run lint
npm test
```

## When You Touch Firebase Functions

```bash
cd functions
npm run build
cd ..
```

## When You Touch Multi-Tenant Routing

- Review `docs/MULTI_TENANT_GUIDE.md`
- Check hostname and `confId` handling
- Avoid hard-coded society or domain assumptions

## Documentation Priority

1. `../MANDATORY_WORKFLOW.md`
2. `../AGENTS.md`
3. This file
4. Path-specific `AGENTS.md`
5. Archive docs only for historical context

## Essential (Post-Compact)

- Node 22 is the project baseline.
- Run lint and tests before commit.
- Build functions when backend code changes.
- Use active docs before archive docs.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Workspace note recorded on 2026-04-02: the local shell currently reports Node `v24.13.0`, which differs from the repository standard.

<!-- DYNAMIC:END -->
