# CLAUDE.md — Blueprint Check repository conventions

These conventions apply inside this repository. They never override the EnWithAI Engineering Commons launch pack
(internal workspace) (`../START_HERE.md`, `../MASTER_PROMPT.md`, `../PHASE_GATES.md`) or the user's explicit
instructions.

## Commands

- Install: `npm ci --ignore-scripts`
- Full gate: `npm run check:all` (typecheck → lint → format check → build → tests with coverage ≥ 80% lines)
- Licenses: `node scripts/license-audit.mjs` (production: `@enwithai/architecture-check`, `yaml`) and `--all`
- Sample output: `npm run build && node scripts/generate-demo-output.mjs` (commit when output changes)

## Scope

Deterministic, offline generation of an as-built architecture blueprint (master prompt v2 catalog, model, evidence,
coverage, validation, Mermaid, Structurizr DSL) from Architecture Check derive, the Impact Check graph and the Product
Check surface; and drift checks of a committed blueprint. Out of scope for 0.1: journeys, trust enforcement, runtime
observation, multi-repository estates, CI/config/observability views, rendering, scores, any AI model.

## Invariants (tests enforce most of these)

- No network modules, `child_process`, `vm`, `eval` or dynamic `import()` in `src/` (`test/security.test.ts`).
- Every claim cites evidence; heuristics are `INFERRED`; judgment views are `blocked`, never filled.
- Output is deterministic except `generated_at`; ids follow sorted source ids.
- Repository-derived strings are redacted and escaped (Markdown) or entity-encoded (Mermaid) before rendering.
- Fixtures are synthetic only.

## Permission gates

Local commits on the work branch are fine. **Pushing, creating remotes/repos, publishing to npm, opening external
issues/PRs, or enabling third-party services requires explicit user approval for that specific action.**
