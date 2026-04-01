---
precedence: 78
required-for:
  - deployment-review
  - production-readiness
optional-for:
  - environment-audit
memory-type: runbook
token-estimate: 383
@include:
  - shared/AI_DOC_SHARED_RULES.md
  - shared/ESSENTIAL_POST_COMPACT.md
  - shared/VERSION_CONTROL_SHARED.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Replaced merged legacy notes with a sanitized deployment runbook aligned to Node 22.
---

# Deployment Guide

<!-- STATIC:BEGIN -->

This file is the active deployment runbook. It intentionally omits secrets, raw production keys, and stale platform instructions from older merged notes.

## Baseline

- Use Node `22.x`
- Validate from a feature or release branch first
- Treat `docs/archive/` deployment notes as historical only

## Pre-Deploy Checks

```bash
npm run lint
npm test
npm run build
cd functions
npm run build
cd ..
```

## Deployment Principles

- Never deploy from unreviewed changes
- Keep Hosting, Functions, and Firestore changes traceable to a PR
- Prefer explicit validation over manual hotfixes
- Do not store secrets or API keys in markdown

## Firebase/Fronend Checklist

1. Confirm the intended Firebase project and environment.
2. Verify environment variables outside the repository.
3. Build frontend and functions successfully.
4. Review any rules, indexes, or function changes.
5. Deploy using the approved operational path for the target environment.
6. Verify health after deploy.

## Post-Deploy Verification

- Open the main user flow
- Check admin login and a protected route
- Verify payment- or function-adjacent changes if touched
- Review Firebase logs and error monitoring

## Essential (Post-Compact)

- Node 22 baseline
- No secrets in docs
- Validate before deploy
- Use current runbooks, not archive notes

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

This document was sanitized on 2026-04-02 to remove embedded key material and outdated runtime references.

<!-- DYNAMIC:END -->
