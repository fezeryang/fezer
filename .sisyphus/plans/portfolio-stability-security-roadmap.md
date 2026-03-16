# Portfolio Stability & Security Roadmap (4-6 Weeks)

## TL;DR

> **Quick Summary**: Harden the existing React + Express/tRPC + Drizzle stack first, then add a focused admin-managed content workflow without over-building a generic CMS.
>
> **Deliverables**:
>
> - Security/stability baseline for auth/API/runtime
> - Content CRUD API for blog/projects with admin-only mutations
> - Practical admin UI for portfolio content operations
> - Observability + TDD coverage for critical paths
>
> **Estimated Effort**: Large (4-6 weeks)
> **Parallel Execution**: YES - 4 implementation waves + final verification wave
> **Critical Path**: T1 -> T6 -> T10 -> T14 -> T17 -> F1-F4

---

## Context

### Original Request

Deeply research and plan remediation/expansion for a personal portfolio codebase where backend, admin page, and frontend all have issues and need extensibility.

### Interview Summary

**Key Discussions**:

- Priority confirmed: stability/security first.
- Delivery horizon confirmed: full 4-6 week roadmap.
- Test strategy confirmed: TDD.

**Research Findings**:

- Backend/admin capability is skeletal (`server/routers.ts`, `server/_core/systemRouter.ts`, `client/src/components/DashboardLayout.tsx`).
- Frontend visual quality is strong, but page-level animation logic is heavy and tightly coupled (`client/src/pages/Home.tsx`, `client/src/pages/Portfolio.tsx`, `client/src/pages/Blog.tsx`).
- Type-safety debt exists in runtime-sensitive paths (`server/_core/sdk.ts`, `server/storage.ts`, multiple p5 pages).

### Metis Review

**Identified Gaps** (addressed):

- Added explicit guardrails to prevent CMS overbuild and unnecessary subsystem sprawl.
- Added deployment/migration rollback requirements in acceptance criteria.
- Added explicit assumptions/defaults section for unresolved-but-non-blocking ambiguities.

---

## Work Objectives

### Core Objective

Evolve the current portfolio into a secure, maintainable, admin-manageable system while preserving the visual identity and minimizing long-term solo-maintainer burden.

### Concrete Deliverables

- Hardened auth/session/request security layer across Express + tRPC.
- Admin-only content CRUD API for portfolio projects and blog posts.
- Admin UI flow for list/create/edit/publish/unpublish content.
- Operational baseline: structured logs, audit trail, health checks, and critical-path tests.

### Definition of Done

- [ ] Security baseline checks pass via automated commands and API checks.
- [ ] Admin CRUD + publish flows are fully agent-verifiable (happy/error paths).
- [ ] TDD tests pass for auth/content/admin critical paths.
- [ ] Final verification wave (F1-F4) returns APPROVE from all reviewers.

### Must Have

- Stable and secure auth/session behavior.
- Strict admin-only mutation boundaries.
- Migration-safe schema evolution with rollback checks.
- Minimal, pragmatic admin UX (no generic CMS builder).

### Must NOT Have (Guardrails)

- No generic CMS/page-builder abstraction.
- No multi-role RBAC expansion beyond owner/admin in this roadmap.
- No architecture overbuild (no microservices/event bus/APM stack).
- No broad animation rewrite that risks current brand identity.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — all verification is agent-executed.

### Test Decision

- **Infrastructure exists**: YES (`vitest.config.ts`, `package.json:test`).
- **Automated tests**: TDD.
- **Framework**: Vitest + Playwright (scenario verification) + curl checks.
- **Coverage target defaults**:
  - Auth/security modules: >= 90%
  - Content/admin API modules: >= 80%
  - Frontend admin-critical flows: >= 70%

### QA Policy

Each task below includes executable QA scenarios (happy + failure), evidence files, and concrete assertions.
Evidence root: `.sisyphus/evidence/`.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Security & Foundations — start immediately):

- T1 Security middleware baseline (helmet/cors/rate-limit/request size policy)
- T2 Session/auth hardening policy (cookie/session validation, expiry policy checks)
- T3 Input-validation normalization (shared schemas/error mapping)
- T4 Logging baseline (request/error structured logging)
- T5 Migration safety framework (backup/rollback/check scripts + docs)

Wave 2 (Core Content & Admin API — after Wave 1):

- T6 Content schema refinements (draft/published state + metadata)
- T7 Blog admin router CRUD + publish controls
- T8 Portfolio admin router CRUD + publish controls
- T9 Audit log persistence for admin mutations
- T10 Admin authz guard consolidation + procedure boundary tests

Wave 3 (Frontend Admin & Maintainability — after Wave 2):

- T11 Route strategy for protected admin area
- T12 Admin content list/create/edit screens (blog)
- T13 Admin content list/create/edit screens (portfolio)
- T14 Frontend resilience hardening (loading/error/empty states)
- T15 Type-safety debt reduction in high-risk frontend/server paths

Wave 4 (Observability, Performance, Release Readiness — after Wave 3):

- T16 Security regression suite + abuse-case tests
- T17 Performance baseline + budget checks (API latency + key UI route)
- T18 Deployment checklist + rollback runbook validation
- T19 Integration E2E for publish/unpublish lifecycle
- T20 Cleanup pass for dead/demo-only admin references

Wave FINAL (Independent Parallel Review):

- F1 Plan compliance audit (oracle)
- F2 Code quality review (unspecified-high)
- F3 Real QA execution (unspecified-high + playwright)
- F4 Scope fidelity check (deep)

Critical Path: T1 -> T6 -> T10 -> T14 -> T17 -> F1-F4
Max Concurrent Target: 5 tasks/wave

### Dependency Matrix

- T1: none -> T6,T10,T16,T18
- T2: none -> T10,T16
- T3: none -> T7,T8,T10
- T4: none -> T9,T18
- T5: none -> T6,T18
- T6: T1,T5 -> T7,T8,T12,T13,T19
- T7: T3,T6 -> T12,T19
- T8: T3,T6 -> T13,T19
- T9: T4 -> T18,F1
- T10: T1,T2,T3 -> T11,T16,T19
- T11: T10 -> T12,T13,T14
- T12: T6,T7,T11 -> T14,T19
- T13: T6,T8,T11 -> T14,T19
- T14: T11,T12,T13 -> T17,T19
- T15: T2 -> T14,T16
- T16: T1,T2,T10,T15 -> F2,F3
- T17: T14 -> F3
- T18: T1,T4,T5,T9 -> F1,F4
- T19: T6,T7,T8,T10,T12,T13,T14 -> F3,F4
- T20: T14 -> F4

### Agent Dispatch Summary

- Wave 1: T1 `unspecified-high`, T2 `deep`, T3 `quick`, T4 `unspecified-low`, T5 `quick`
- Wave 2: T6 `deep`, T7 `unspecified-high`, T8 `unspecified-high`, T9 `quick`, T10 `deep`
- Wave 3: T11 `quick`, T12 `visual-engineering`, T13 `visual-engineering`, T14 `unspecified-high`, T15 `quick`
- Wave 4: T16 `deep`, T17 `unspecified-high`, T18 `quick`, T19 `deep`, T20 `quick`
- Final: F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [ ] 1. Security middleware baseline in Express

  **What to do**:
  - Add/normalize security middleware sequence for API runtime (headers/CORS/rate-limits/body limits).
  - Add TDD tests for expected headers and blocked abusive patterns.

  **Must NOT do**:
  - Do not broaden CORS to wildcard in production mode.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (security-sensitive runtime wiring)
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6,T10,T16,T18
  - **Blocked By**: None

  **References**:
  - `server/_core/index.ts` - server bootstrap and middleware chain anchor.
  - `package.json` - existing script/tooling constraints.

  **Acceptance Criteria**:
  - [ ] Security middleware tests pass.
  - [ ] Unauthorized origin/abusive requests are rejected as expected.

  **QA Scenarios**:

  ```
  Scenario: Security headers present on API response
    Tool: Bash (curl)
    Steps:
      1. curl -i http://localhost:3000/api/trpc/system.health?input=%7B%22timestamp%22%3A1%7D
      2. Assert response includes expected security headers.
    Expected Result: required headers present
    Evidence: .sisyphus/evidence/task-1-security-headers.txt

  Scenario: Rate-limit or request-size guard triggers on abuse
    Tool: Bash (curl)
    Steps:
      1. Send repeated or oversized request to protected endpoint.
      2. Assert blocked status and safe error body.
    Expected Result: request rejected with non-2xx
    Evidence: .sisyphus/evidence/task-1-abuse-block.txt
  ```

- [ ] 2. Session/auth hardening policy

  **What to do**:
  - Tighten session cookie/session verification behavior and error handling boundaries.
  - Add TDD tests for session validity/expiry/invalid-token paths.

  **Must NOT do**:
  - Do not replace auth architecture with new provider in this roadmap.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T10,T16,T15
  - **Blocked By**: None

  **References**:
  - `server/_core/sdk.ts` - session token creation/verification source of truth.
  - `server/_core/env.ts` - secret and auth env boundaries.
  - `shared/const.ts` - cookie/session constants.

  **Acceptance Criteria**:
  - [ ] Session tests pass for valid and invalid tokens.
  - [ ] Unauthorized behavior is deterministic and safe.

  **QA Scenarios**:

  ```
  Scenario: Valid session reaches authenticated endpoint
    Tool: Bash (curl)
    Steps:
      1. Use test fixture/session cookie for authenticated request.
      2. Call auth me endpoint.
      3. Assert user payload returned.
    Evidence: .sisyphus/evidence/task-2-valid-session.txt

  Scenario: Invalid session is rejected
    Tool: Bash (curl)
    Steps:
      1. Send tampered cookie to auth endpoint.
      2. Assert unauthorized/forbidden response.
    Evidence: .sisyphus/evidence/task-2-invalid-session.txt
  ```

- [ ] 3. Shared input validation and error normalization

  **What to do**:
  - Normalize Zod input contracts and API error mapping across routers.
  - Add TDD tests for validation failures and expected error shape.

  **Must NOT do**:
  - Do not introduce broad generic abstraction for all domain errors.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T7,T8,T10
  - **Blocked By**: None

  **References**:
  - `server/_core/systemRouter.ts` - current zod validation style.
  - `server/_core/trpc.ts` - procedure/error boundary entry.
  - `shared/_core/errors.ts` - shared error helpers.

  **Acceptance Criteria**:
  - [ ] Validation tests cover success/failure cases.
  - [ ] Error response shape consistent across endpoints.

  **QA Scenarios**:

  ```
  Scenario: Valid payload accepted
    Tool: Bash (curl)
    Steps:
      1. Submit valid input to validated endpoint.
      2. Assert 2xx and typed payload.
    Evidence: .sisyphus/evidence/task-3-valid-input.txt

  Scenario: Invalid payload rejected with structured error
    Tool: Bash (curl)
    Steps:
      1. Submit invalid body/query data.
      2. Assert deterministic validation error structure.
    Evidence: .sisyphus/evidence/task-3-invalid-input.txt
  ```

- [ ] 4. Structured request/error logging baseline

  **What to do**:
  - Introduce consistent structured logging for request lifecycle and error events.
  - Add tests/assertions for log emission on success and failure paths.

  **Must NOT do**:
  - Do not add heavy observability platform dependencies in this task.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T9,T18
  - **Blocked By**: None

  **References**:
  - `server/_core/index.ts` - current console logging points.
  - `server/_core/sdk.ts` - auth-related log sites.

  **Acceptance Criteria**:
  - [ ] Request and error logs are emitted in structured format.
  - [ ] Sensitive fields are not logged.

  **QA Scenarios**:

  ```
  Scenario: Successful request produces structured log
    Tool: interactive_bash (tmux)
    Steps:
      1. Run server in tmux pane.
      2. Execute health request.
      3. Assert log line includes route, status, latency.
    Evidence: .sisyphus/evidence/task-4-success-log.txt

  Scenario: Error path produces structured error log
    Tool: interactive_bash (tmux)
    Steps:
      1. Trigger validation/auth failure request.
      2. Assert error log includes code and correlation fields.
    Evidence: .sisyphus/evidence/task-4-error-log.txt
  ```

- [ ] 5. Migration safety and rollback framework

  **What to do**:
  - Define repeatable migration safety checks (backup/apply/rollback/integrity verification).
  - Add executable scripts/check commands for migration workflows.

  **Must NOT do**:
  - Do not run ad-hoc schema changes outside migration tooling.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6,T18
  - **Blocked By**: None

  **References**:
  - `drizzle.config.ts` - migration source of truth.
  - `drizzle/schema.ts` - schema state to protect.
  - `package.json` - db script entrypoints.

  **Acceptance Criteria**:
  - [ ] Migration safety commands execute end-to-end in test environment.
  - [ ] Rollback path validated and documented in executable form.

  **QA Scenarios**:

  ```
  Scenario: Migration apply and verify
    Tool: Bash
    Steps:
      1. Run migration apply command in test DB.
      2. Run verification query checks.
    Evidence: .sisyphus/evidence/task-5-migrate-verify.txt

  Scenario: Rollback restores prior schema state
    Tool: Bash
    Steps:
      1. Execute rollback command.
      2. Re-run schema integrity checks.
    Evidence: .sisyphus/evidence/task-5-rollback.txt
  ```

- [ ] 6. Content schema refinement for admin lifecycle

  **What to do**:
  - Extend content model to support admin lifecycle fields (publish state/timestamps/updated metadata).
  - Add TDD around schema-bound repository behavior.

  **Must NOT do**:
  - Do not introduce generic block-builder schema.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: T7,T8,T12,T13,T19
  - **Blocked By**: T1,T5

  **References**:
  - `drizzle/schema.ts` - blog/project table definitions.
  - `server/db.ts` - repository/data access methods using these tables.

  **Acceptance Criteria**:
  - [ ] Schema and migration tests pass.
  - [ ] Data access tests validate publish lifecycle behavior.

  **QA Scenarios**:

  ```
  Scenario: Published content appears in public reads
    Tool: Bash (curl)
    Steps:
      1. Seed one published and one unpublished item.
      2. Call public list endpoint.
      3. Assert only published appears.
    Evidence: .sisyphus/evidence/task-6-public-filter.txt

  Scenario: Invalid publish metadata rejected
    Tool: Bash (curl)
    Steps:
      1. Attempt create/update with invalid publish field combo.
      2. Assert validation rejection.
    Evidence: .sisyphus/evidence/task-6-invalid-publish.txt
  ```

- [ ] 7. Blog admin router CRUD + publish controls

  **What to do**:
  - Implement admin-only blog CRUD and publish/unpublish operations with validation.
  - Add TDD for success/permission/failure paths.

  **Must NOT do**:
  - Do not expose mutation endpoints as public procedures.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T12,T19
  - **Blocked By**: T3,T6

  **References**:
  - `server/routers.ts` - router composition point.
  - `server/_core/trpc.ts` - admin procedure guard pattern.
  - `server/db.ts` - existing blog read access methods.

  **Acceptance Criteria**:
  - [ ] CRUD and publish tests pass with admin/non-admin separation.
  - [ ] Validation and error mapping match shared conventions.

  **QA Scenarios**:

  ```
  Scenario: Admin creates and publishes blog post
    Tool: Bash (curl)
    Steps:
      1. Call admin create endpoint with valid payload.
      2. Call publish endpoint.
      3. Verify item appears in public list endpoint.
    Evidence: .sisyphus/evidence/task-7-blog-publish.txt

  Scenario: Non-admin mutation attempt denied
    Tool: Bash (curl)
    Steps:
      1. Invoke same mutation with non-admin session.
      2. Assert forbidden response.
    Evidence: .sisyphus/evidence/task-7-blog-forbidden.txt
  ```

- [ ] 8. Portfolio admin router CRUD + publish controls

  **What to do**:
  - Implement admin-only portfolio CRUD and publish/unpublish operations.
  - Add TDD for query consistency and authorization boundaries.

  **Must NOT do**:
  - Do not add unrelated portfolio analytics features in this task.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T13,T19
  - **Blocked By**: T3,T6

  **References**:
  - `server/routers.ts` - add feature router mounting point.
  - `server/db.ts` - existing portfolio read methods.
  - `drizzle/schema.ts` - portfolio table model.

  **Acceptance Criteria**:
  - [ ] Portfolio CRUD/publish tests pass.
  - [ ] Public endpoints return only published items.

  **QA Scenarios**:

  ```
  Scenario: Admin updates featured portfolio item
    Tool: Bash (curl)
    Steps:
      1. Create/edit portfolio item via admin API.
      2. Mark as published/featured.
      3. Verify public featured endpoint output.
    Evidence: .sisyphus/evidence/task-8-portfolio-featured.txt

  Scenario: Invalid portfolio payload rejected
    Tool: Bash (curl)
    Steps:
      1. Submit malformed payload (missing required fields).
      2. Assert validation error response.
    Evidence: .sisyphus/evidence/task-8-portfolio-invalid.txt
  ```

- [ ] 9. Admin audit log persistence

  **What to do**:
  - Record admin mutation events (actor/action/entity/timestamp/outcome).
  - Add tests to confirm audit write coverage on success/failure.

  **Must NOT do**:
  - Do not log sensitive secret/token material.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T18,F1
  - **Blocked By**: T4

  **References**:
  - `server/_core/context.ts` - actor context source.
  - `server/_core/systemRouter.ts` - admin mutation pattern.

  **Acceptance Criteria**:
  - [ ] Audit records generated for all admin mutations.
  - [ ] Failure events also captured with safe metadata.

  **QA Scenarios**:

  ```
  Scenario: Admin mutation creates audit entry
    Tool: Bash (curl)
    Steps:
      1. Execute admin mutation.
      2. Query audit log source.
      3. Assert actor/action/entity fields present.
    Evidence: .sisyphus/evidence/task-9-audit-success.txt

  Scenario: Failed mutation still records audit outcome
    Tool: Bash (curl)
    Steps:
      1. Trigger validation/permission failure.
      2. Assert failed attempt exists in audit records.
    Evidence: .sisyphus/evidence/task-9-audit-failure.txt
  ```

- [ ] 10. Admin authorization boundary consolidation

  **What to do**:
  - Ensure all admin mutations/procedures consistently use hardened admin guard.
  - Add TDD permission matrix tests across public/protected/admin routes.

  **Must NOT do**:
  - Do not weaken existing authorization semantics for convenience.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: T11,T16,T19
  - **Blocked By**: T1,T2,T3

  **References**:
  - `server/_core/trpc.ts` - protected/admin procedure definitions.
  - `server/routers.ts` - current route exposure map.

  **Acceptance Criteria**:
  - [ ] Permission matrix tests pass for all routes.
  - [ ] No admin mutation callable from non-admin context.

  **QA Scenarios**:

  ```
  Scenario: Admin can execute admin mutation
    Tool: Bash (curl)
    Steps:
      1. Call admin endpoint with admin session.
      2. Assert success response.
    Evidence: .sisyphus/evidence/task-10-admin-allowed.txt

  Scenario: Non-admin blocked across all admin endpoints
    Tool: Bash (curl)
    Steps:
      1. Run scripted calls against each admin endpoint with non-admin session.
      2. Assert forbidden for each.
    Evidence: .sisyphus/evidence/task-10-admin-blocked.txt
  ```

- [ ] 11. Protected admin route strategy in frontend

  **What to do**:
  - Define and wire protected admin route boundaries in router layer.
  - Add tests for redirect/guard behavior on authenticated vs unauthenticated states.

  **Must NOT do**:
  - Do not expose admin screens without guard checks.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: T12,T13,T14
  - **Blocked By**: T10

  **References**:
  - `client/src/App.tsx` - route registry surface.
  - `client/src/_core/hooks/useAuth.ts` - auth state/redirect behavior.
  - `client/src/components/DashboardLayout.tsx` - admin shell anchor.

  **Acceptance Criteria**:
  - [ ] Unauthenticated users are redirected away from admin routes.
  - [ ] Authenticated admin route access is stable.

  **QA Scenarios**:

  ```
  Scenario: Authenticated user enters admin route
    Tool: Playwright
    Steps:
      1. Set authenticated session state.
      2. Navigate to admin route URL.
      3. Assert admin shell renders.
    Evidence: .sisyphus/evidence/task-11-admin-route-happy.png

  Scenario: Unauthenticated user is redirected
    Tool: Playwright
    Steps:
      1. Clear session state.
      2. Visit admin route URL.
      3. Assert redirect to login flow.
    Evidence: .sisyphus/evidence/task-11-admin-route-redirect.png
  ```

- [ ] 12. Admin blog management UI

  **What to do**:
  - Build admin blog list/create/edit/publish UI flow using secured API.
  - Add UI tests for CRUD and publish states.

  **Must NOT do**:
  - Do not add rich editor complexity beyond required fields.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T14,T19
  - **Blocked By**: T6,T7,T11

  **References**:
  - `client/src/components/DashboardLayout.tsx` - admin frame.
  - `client/src/components/ui/` - reusable form/table primitives.
  - `client/src/lib/trpc.ts` - API client integration point.

  **Acceptance Criteria**:
  - [ ] Blog CRUD/publish UI actions reflect backend state accurately.
  - [ ] Error/loading/empty states are explicit and actionable.

  **QA Scenarios**:

  ```
  Scenario: Create and publish blog item from admin UI
    Tool: Playwright
    Steps:
      1. Open admin blog page.
      2. Fill form with concrete data and submit.
      3. Publish item and verify visible status label.
    Evidence: .sisyphus/evidence/task-12-blog-ui-publish.png

  Scenario: Invalid form submission blocked with field errors
    Tool: Playwright
    Steps:
      1. Submit empty required fields.
      2. Assert validation messages on exact fields.
    Evidence: .sisyphus/evidence/task-12-blog-ui-invalid.png
  ```

- [ ] 13. Admin portfolio management UI

  **What to do**:
  - Build portfolio item list/create/edit/publish admin flow.
  - Ensure featured/publish flags are represented safely in UI.

  **Must NOT do**:
  - Do not introduce analytics/dashboard widgets in this task.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T14,T19
  - **Blocked By**: T6,T8,T11

  **References**:
  - `client/src/pages/Portfolio.tsx` - public portfolio context to preserve.
  - `client/src/components/ui/` - forms/tables/dialogs.
  - `server/db.ts` - portfolio data behavior expectations.

  **Acceptance Criteria**:
  - [ ] Admin can create/edit/publish/unpublish portfolio entries.
  - [ ] Public-facing portfolio uses published-only data.

  **QA Scenarios**:

  ```
  Scenario: Admin updates featured portfolio record
    Tool: Playwright
    Steps:
      1. Edit existing portfolio item in admin UI.
      2. Toggle featured and save.
      3. Assert updated status in list and public projection.
    Evidence: .sisyphus/evidence/task-13-portfolio-ui-featured.png

  Scenario: Unauthorized user blocked from portfolio admin route
    Tool: Playwright
    Steps:
      1. Access route without admin session.
      2. Assert redirect or forbidden UX.
    Evidence: .sisyphus/evidence/task-13-portfolio-ui-forbidden.png
  ```

- [ ] 14. Frontend resilience hardening for admin/public states

  **What to do**:
  - Standardize loading/error/empty states and safe fallbacks across critical routes.
  - Add tests ensuring predictable UI behavior during API failures/timeouts.

  **Must NOT do**:
  - Do not redesign whole visual language; keep existing brand style.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: T17,T19,T20
  - **Blocked By**: T11,T12,T13

  **References**:
  - `client/src/App.tsx` - global error boundary/provider composition.
  - `client/src/_core/hooks/useAuth.ts` - auth-related loading/error behavior.

  **Acceptance Criteria**:
  - [ ] Critical views show explicit and accessible loading/error/empty states.
  - [ ] API failure does not crash route rendering.

  **QA Scenarios**:

  ```
  Scenario: API timeout shows non-blocking error state
    Tool: Playwright
    Steps:
      1. Intercept API call and force timeout/failure.
      2. Assert inline error UI and retry affordance.
    Evidence: .sisyphus/evidence/task-14-timeout-state.png

  Scenario: Empty dataset shows explicit empty state
    Tool: Playwright
    Steps:
      1. Mock empty response for admin/public listing view.
      2. Assert empty-state messaging and action CTA.
    Evidence: .sisyphus/evidence/task-14-empty-state.png
  ```

- [ ] 15. Type-safety debt reduction in high-risk paths

  **What to do**:
  - Replace highest-risk `as any`/unsafe typing in auth/storage and key animated pages.
  - Add tests around previously unsafe branches.

  **Must NOT do**:
  - Do not refactor every page indiscriminately in this task.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T14,T16
  - **Blocked By**: T2

  **References**:
  - `server/_core/sdk.ts` - high-risk auth typing casts.
  - `server/storage.ts` - storage type coercion path.
  - `client/src/pages/Home.tsx` and peers - repeated p5 any-casts.

  **Acceptance Criteria**:
  - [ ] High-risk casts reduced and covered by tests/typecheck.
  - [ ] No regression in current visual/interaction behavior.

  **QA Scenarios**:

  ```
  Scenario: Typecheck passes with reduced unsafe casts
    Tool: Bash
    Steps:
      1. Run npm run check.
      2. Assert no new type errors.
    Evidence: .sisyphus/evidence/task-15-typecheck.txt

  Scenario: Key animation page still loads and runs
    Tool: Playwright
    Steps:
      1. Open Home and Portfolio routes.
      2. Assert canvas container renders and no runtime exception in console.
    Evidence: .sisyphus/evidence/task-15-animation-regression.png
  ```

- [ ] 16. Security regression and abuse-case suite

  **What to do**:
  - Build test suite for auth abuse cases, permission bypass attempts, and malformed input attacks.
  - Integrate into CI-level command set.

  **Must NOT do**:
  - Do not require manual pen-testing to pass this task.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: F2,F3
  - **Blocked By**: T1,T2,T10,T15

  **References**:
  - `server/_core/trpc.ts` - authz gates under test.
  - `server/_core/sdk.ts` - session verification behavior.
  - `server/routers.ts` - endpoint matrix.

  **Acceptance Criteria**:
  - [ ] Abuse-case suite covers auth/session/permission/input attack vectors.
  - [ ] CI command fails on security regression.

  **QA Scenarios**:

  ```
  Scenario: Permission bypass attempt fails
    Tool: Bash (curl)
    Steps:
      1. Invoke admin mutation with crafted non-admin context.
      2. Assert forbidden and no data mutation.
    Evidence: .sisyphus/evidence/task-16-bypass-block.txt

  Scenario: Malformed payload attack rejected safely
    Tool: Bash (curl)
    Steps:
      1. Submit malformed payload to mutation endpoint.
      2. Assert validation failure with safe error response.
    Evidence: .sisyphus/evidence/task-16-malformed-block.txt
  ```

- [ ] 17. Performance baseline and budget checks

  **What to do**:
  - Establish baseline metrics for critical API latency and key frontend routes.
  - Add automated checks to detect severe regressions.

  **Must NOT do**:
  - Do not optimize non-critical paths preemptively.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F3
  - **Blocked By**: T14

  **References**:
  - `client/src/pages/Home.tsx` - high-cost visual route baseline.
  - `server/_core/index.ts` and `server/routers.ts` - API latency measurement points.

  **Acceptance Criteria**:
  - [ ] Baseline report generated for API and critical routes.
  - [ ] Budget checks fail build when major regression threshold exceeded.

  **QA Scenarios**:

  ```
  Scenario: API latency benchmark produced
    Tool: Bash
    Steps:
      1. Run benchmark script against health/content endpoints.
      2. Assert report contains p50/p95 metrics.
    Evidence: .sisyphus/evidence/task-17-api-benchmark.txt

  Scenario: Frontend route performance snapshot captured
    Tool: Playwright
    Steps:
      1. Open key public/admin routes with trace enabled.
      2. Assert no severe runtime error and collect timing evidence.
    Evidence: .sisyphus/evidence/task-17-route-perf.json
  ```

- [ ] 18. Deployment checklist and rollback runbook validation

  **What to do**:
  - Produce executable release checklist and rollback commands for staged rollout.
  - Validate checklist in staging-like environment.

  **Must NOT do**:
  - Do not leave rollback procedure as prose-only without executable commands.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1,F4
  - **Blocked By**: T1,T4,T5,T9

  **References**:
  - `package.json` - build/start/check/test commands for release gates.
  - `server/_core/index.ts` - runtime startup verification.

  **Acceptance Criteria**:
  - [ ] Release checklist command sequence runs cleanly.
  - [ ] Rollback path is tested and verified.

  **QA Scenarios**:

  ```
  Scenario: Release checklist passes end-to-end
    Tool: Bash
    Steps:
      1. Run build/test/check sequence in release order.
      2. Assert all commands pass.
    Evidence: .sisyphus/evidence/task-18-release-checklist.txt

  Scenario: Rollback sequence restores prior state
    Tool: Bash
    Steps:
      1. Simulate failed deploy marker.
      2. Execute rollback commands.
      3. Re-run smoke checks.
    Evidence: .sisyphus/evidence/task-18-rollback-check.txt
  ```

- [ ] 19. Integration E2E for publish/unpublish lifecycle

  **What to do**:
  - Verify end-to-end content lifecycle from admin mutation to public rendering behavior.
  - Cover both blog and portfolio domains.

  **Must NOT do**:
  - Do not test routes in isolation only; must validate cross-layer integration.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: F3,F4
  - **Blocked By**: T6,T7,T8,T10,T12,T13,T14

  **References**:
  - `client/src/lib/trpc.ts` - client API bridge.
  - `server/routers.ts` - integrated router surface.
  - `server/db.ts` - data source verification points.

  **Acceptance Criteria**:
  - [ ] E2E suite proves publish/unpublish impacts public output correctly.
  - [ ] Failure paths preserve data integrity and return actionable errors.

  **QA Scenarios**:

  ```
  Scenario: Publish flow visible on public page
    Tool: Playwright
    Steps:
      1. Publish item from admin UI/API.
      2. Navigate to public route.
      3. Assert item is visible.
    Evidence: .sisyphus/evidence/task-19-publish-visible.png

  Scenario: Unpublish flow removes from public page
    Tool: Playwright
    Steps:
      1. Unpublish same item.
      2. Refresh public route.
      3. Assert item absent while retained in admin listing.
    Evidence: .sisyphus/evidence/task-19-unpublish-hidden.png
  ```

- [ ] 20. Dead/demo reference cleanup and scope fidelity prep

  **What to do**:
  - Remove or isolate demo-only admin/chat references that can confuse production behavior.
  - Ensure route/menu naming reflects real features.

  **Must NOT do**:
  - Do not delete active production behavior without replacement.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F4
  - **Blocked By**: T14

  **References**:
  - `client/src/components/DashboardLayout.tsx` - placeholder menu labels/paths.
  - `client/src/pages/ComponentShowcase.tsx` - demo references to non-wired APIs.
  - `client/src/components/AIChatBox.tsx` - demo guidance references.

  **Acceptance Criteria**:
  - [ ] Placeholder/demo-only references no longer misrepresent production capability.
  - [ ] Admin navigation labels/routes align with implemented scope.

  **QA Scenarios**:

  ```
  Scenario: Admin nav reflects real routes only
    Tool: Playwright
    Steps:
      1. Open admin shell.
      2. Assert menu labels map to implemented routes.
    Evidence: .sisyphus/evidence/task-20-nav-alignment.png

  Scenario: Demo-only API hints do not break runtime flows
    Tool: Playwright
    Steps:
      1. Visit showcase/demo-related routes.
      2. Assert no broken links or false production affordances.
    Evidence: .sisyphus/evidence/task-20-demo-cleanup.png
  ```

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  - Verify all Must Have/Must NOT Have against produced implementation and evidence.
  - Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  - Run typecheck/lint/tests and inspect changed files for unsafe shortcuts/slop.
  - Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [PASS/FAIL] | VERDICT`

- [ ] F3. **Real QA Execution** — `unspecified-high` (+ `playwright`)
  - Execute all task QA scenarios and capture evidence into `.sisyphus/evidence/final-qa/`.
  - Output: `Scenarios [N/N pass] | Integration [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  - Ensure implementation matches plan 1:1 and flag scope creep/unaccounted changes.
  - Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/ISSUES] | VERDICT`

---

## Commit Strategy

- Security/auth changes isolated in dedicated commits.
- Schema/migration changes isolated from feature/UI commits.
- Admin API and admin UI commits separated for traceability.

---

## Success Criteria

### Verification Commands

```bash
npm run check
npm test
npm run build
```

### Final Checklist

- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Security and admin critical-path tests pass
- [ ] Final verification wave approved

---

## Defaults Applied (Override if needed)

- Assume single-admin (owner/admin) model for this roadmap.
- Assume current deployment remains single-service (no architecture split).
- Assume performance target for key public/admin views: no severe regression from baseline.
