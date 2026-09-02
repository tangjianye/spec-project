<!--
SYNC IMPACT REPORT
==================
Version Change: (new project) → v1.0.0
Modified Principles:
  - I. Spec-Driven Development (NEW)
  - II. Component-First Architecture (NEW)
  - III. Performance-First (NEW)
  - IV. Accessibility Compliance (NEW)
  - V. Type Safety & Code Quality (NEW)
Added Sections:
  - Technology Stack & Standards (NEW)
  - Development Workflow & Quality Gates (NEW)
Removed Sections: N/A
Deferred Items: N/A
-->

# Spec Project Constitution

## Core Principles

### I. Spec-Driven Development

Every feature MUST follow the linear verification flow:
User Requirements → Business Alignment → Information Architecture →
Interaction Design → Implementation Plan → Task Decomposition → Coding.

Each phase output MUST be documented and validated before proceeding.
Spec artifacts (spec.md, plan.md, tasks.md) are the single source of truth;
code MUST NOT diverge from the approved specification without a documented
amendment. Ambiguous requirements MUST be clarified and written down before
any implementation work begins.

Rationale: Prevents rework from hidden assumptions and ensures design intent
survives the transition from product thinking to engineering execution.

### II. Component-First Architecture

All UI code MUST be organized as reusable, self-contained components.
Components MUST expose a clear props contract and be independently testable
in isolation (e.g., via Storybook or equivalent). Visual consistency is
enforced through a shared design system; one-off inline styles are
prohibited unless explicitly justified in the spec.

Business logic MUST be separated from rendering concerns. State management
follows a single, project-wide pattern defined in the Technology Stack
section.

### III. Performance-First

All user-facing features MUST meet Core Web Vitals thresholds:
- LCP (Largest Contentful Paint): ≤ 2.5s
- FID (First Input Delay): ≤ 100ms
- CLS (Cumulative Layout Shift): ≤ 0.1
- INP (Interaction to Next Paint): ≤ 200ms

Bundle size increases MUST be justified during code review. Code-split
lazily-loaded routes and non-critical features. Avoid visual jitter and
layout thrashing; all dynamic height transitions MUST be smooth and
free of intermediate jumps.

Performance budgets are enforced at build time. Regressions fail the build.

### IV. Accessibility Compliance

The product MUST conform to WCAG 2.1 Level AA standards. Every interactive
element MUST have proper semantics and keyboard navigation support. Color
alone MUST NOT convey information. Focus states MUST be visible.

All new components undergo an accessibility checklist review before merge.
Screen-reader compatibility is verified for the critical user path.

Automated a11y linting runs at build time; violations are treated as
compile errors, not warnings.

### V. Type Safety & Code Quality

TypeScript strict mode is enabled globally. The `any` type is forbidden
except in explicitly documented edge cases. Type assertions (`as`) require
a code comment explaining why the cast is safe.

All code passes through ESLint + Prettier with zero warnings before merge.
Naming conventions, file structure, and module boundaries follow the
patterns established in the existing codebase — consistency beats cleverness.

Unused code, dead branches, and TODO comments without an owner ticket are
removed before merging.

## Technology Stack & Standards

### Frontend Framework
- React 18+ with modern Hooks API (no class components in new code)
- TypeScript in strict mode, latest stable version
- Build tool: Vite for development and production builds

### State Management
- Server state: React Query (TanStack Query) or equivalent data-fetching library
- Client state: Zustand for complex global stores; useState/useReducer for local state
- Cross-cutting concerns (toast, modal, theme) use a single, documented pattern

### Styling Strategy
- Primary approach: CSS Modules or CSS-in-JS (per project lock-in, consistent)
- Design token layer enforces spacing, color, typography, and motion scales
- Responsive breakpoints are standardized; ad-hoc media queries are discouraged

### Testing Standards
- Unit tests: Vitest + React Testing Library
- Integration tests cover critical user flows, not individual components in isolation
- E2E tests: Playwright for the happy path and regression-critical scenarios
- Minimum coverage gates: 80% for business logic; 60% for rendering code

## Development Workflow & Quality Gates

### Branching Strategy
- Trunk-based development with short-lived feature branches
- Branch naming: `feature/{spec-id}-{short-slug}`, `fix/{ticket}-{desc}`, `chore/{scope}`
- All changes arrive via Pull Request; direct commits to `main` are blocked

### Pull Request Requirements
Every PR MUST include:
1. A link to the originating spec, plan, or issue ticket
2. Screenshots or video for visual changes (before/after when fixing)
3. Test additions or updates covering the changed behavior
4. A self-review checklist confirming the change does not violate this constitution

### Code Review Standards
- Reviewers MUST verify constitutional compliance before approving
- At least one approval from a peer familiar with the affected domain
- Review comments are categorized: BLOCKER (fix before merge), COMMENT (address or explain), NIT (optional)
- Stale PRs (≥ 5 business days without activity) are closed with a comment

### Quality Gates (CI Pipeline)
1. Typecheck passes (`tsc --noEmit`)
2. Lint passes with zero errors or warnings
3. Unit + integration test suite passes
4. Build succeeds without bundle size regressions
5. Accessibility linting passes
6. Visual regression tests (if applicable) pass or are manually approved

## Governance

This Constitution supersedes all informal team practices. Any deviation MUST
be documented as a constitutional amendment, not bypassed.

### Amendment Process
1. Propose the change with a written rationale and impact analysis
2. Obtain approval from the project's technical decision-maker(s)
3. If the change affects existing code, include a migration plan with milestones
4. Update this document and increment the version per SemVer rules below
5. Announce the change to all active contributors

### Versioning Policy
- MAJOR: Removal or redefinition of an existing principle; backward-incompatible governance changes
- MINOR: New principle or section added; materially expanded guidance
- PATCH: Clarifications, wording improvements, typo fixes, non-semantic refinements

### Compliance Review
Before every release, the release checklist MUST include a step confirming
the release payload does not violate any Core Principle. Accumulated
technical debt that conflicts with this Constitution MUST have a tracked
remediation plan with a target date.

**Version**: 1.0.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-01
