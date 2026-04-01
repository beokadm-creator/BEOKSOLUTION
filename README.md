---
precedence: 80
required-for:
  - repo-orientation
  - initial-doc-triage
optional-for:
  - feature-implementation
  - deployment-review
memory-type: overview
token-estimate: 414
@include:
  - docs/shared/AI_DOC_SHARED_RULES.md
  - docs/shared/ESSENTIAL_POST_COMPACT.md
  - docs/shared/VERSION_CONTROL_SHARED.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Replaced template content with canonical repo overview and shared-rule references.
---

# eRegi

<!-- STATIC:BEGIN -->

eRegi is a multi-tenant registration and conference operations platform for societies, conference admins, vendors, and attendees. The codebase combines a React 19 frontend, Firebase backend services, and role-specific admin flows.

## Canonical Reading Order

1. `AGENTS.md`
2. `MANDATORY_WORKFLOW.md`
3. `docs/system_architecture.md`
4. `docs/MULTI_TENANT_GUIDE.md`
5. `docs/development_guide.md`

## What This Repository Covers

- Society and conference registration flows
- Admin dashboards for society, conference, and vendor operations
- Payment integrations through cloud functions
- Badge and print workflows
- Multi-tenant domain routing and role-aware access control

## Canonical Documentation Map

- Workflow and guardrails: `MANDATORY_WORKFLOW.md`
- AI markdown system: `docs/shared/AI_DOC_SHARED_RULES.md`
- Essential compact rules: `docs/shared/ESSENTIAL_POST_COMPACT.md`
- Shared version-control rules: `docs/shared/VERSION_CONTROL_SHARED.md`
- Development setup: `docs/development_guide.md`
- Git workflow: `docs/git_workflow.md`
- Deployment reference: `docs/deployment_guide_merged.md`
- Architecture: `docs/system_architecture.md`
- Multi-tenant model: `docs/MULTI_TENANT_GUIDE.md`
- Historical records: `docs/archive/`

## Essential (Post-Compact)

- Never work directly on `main`.
- Prefer the active docs above over `docs/archive/`.
- When documents conflict, use the higher `precedence` value first.
- Archive docs are historical evidence, not current policy.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Current release tag referenced by the repository guardrails: `v1.0.1`.

<!-- DYNAMIC:END -->
