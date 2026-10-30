# Blueprint Check specification (0.1)

## 1. Purpose and position

Blueprint Check generates the as-built architecture blueprint of one repository and checks later that it is still
true. It is the documentation face of the Engineering Commons: Architecture Check detects as-built structure, the
Impact Check graph adds components and imports, Product Check adds the product surface, and Blueprint Check composes
them into a navigable, evidence-linked dossier following the Software Architecture Blueprint master prompt v2
(catalog D00-D18, confidence labels, coverage ledger, validation gates V01-V13).

Overlap audit: Architecture Check `derive` writes the as-built model as DSL/CALM but no dossier, views, coverage or
staleness check. Product Check `spec` writes an as-built requirements spec, not an architecture. Structurizr and CALM
tooling render and diff models but do not derive them from code. LLM-based discovery (for example the master prompt
run by an agent) produces richer judgment but is not deterministic; Blueprint Check is the deterministic floor such a
run can start from.

## 2. generate

1. Read the sources (§3). 2. Build the model (§3). 3. Draw the views (§4). 4. Assess catalog, coverage and validation
   (§5). 5. Render Markdown, JSON, Mermaid and DSL (§6). Nothing is written outside `--out-dir` (and
   `architecture/workspace.dsl` with `--write-model` when no declared model exists).

## 3. Sources and model

| Source                                          | How                                                                                         | Gives                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture Check 0.2.1 `derive`               | in-process library call; config from `.architecture-check.json` when present                | containers (compose, Dockerfile, Kubernetes, packages), databases, external systems from vendor SDK imports, API descriptions, relationships, coverage limitations |
| Impact Check graph (`--graph`, schema 1.0)      | passed to derive                                                                            | source components and import relationships                                                                                                                         |
| Product Check (`--product-check`, schema 0.1.0) | `product-check-results` (`blueprint.as_is.as_built.surface`) or `as-built-spec` (`surface`) | endpoints, pages, entities, integrations, auth boundaries                                                                                                          |
| `.git`                                          | read directly (HEAD, loose refs, packed-refs, `gitdir:` files)                              | snapshot commit and branch; dirty state is never determined                                                                                                        |

Model ids: `R1` repository, `C##` containers then components (sorted by as-built id), `X##` external systems, `U01`
actor (only with endpoints or pages), `DS##` stores, `CT##` contracts, `REL##` relationships, `F##` findings, `G##`
gaps, `E###` evidence. Each element keeps the source tool's stable `key` for drift comparison.

Confidence: configuration and structural facts `CONFIRMED`; SDK imports and actor edges `CORROBORATED`; Architecture
Check hypotheses and inferred surface entries `INFERRED`. Evidence: at most 8 locations per claim, 20 per surface
group; every location with a line is hashed (sha256 of the cited lines joined by `\n`). Containers without evidence
from Architecture Check cite their `package.json` or source directory.

Findings (rule-based, never scores): `isolated-container` (INFERRED), `interface-unowned` (CONFIRMED),
`endpoints-without-auth-reference` (INFERRED, only when auth boundaries exist). Gaps: every Architecture Check coverage
limitation, missing graph or surface, and the four judgment gaps (journeys, trust enforcement, runtime, operations).

## 4. Views

Node ids are generated (`n_<id>`); labels are redacted, single-line and entity-encoded (`"`, `<`, `>`, `|`, brackets),
so repository strings cannot inject Mermaid or HTML. Budget: 22 nodes per view (most connected first); omitted
elements are counted. Views: D00 master (system boundary with containers and stores, externals and actor outside),
D01 repository map (containers grouped by declaration kind), D02 floor plan (containers with components), D04 data
plumbing (edges touching stores or externals), D05 wiring (relationships plus up to 8 contracts), D06 trust (partial,
auth boundaries per container), D07 storage, D09 site plan, D10 deployment (by descriptor), D11 detail (up to 10
containers with components). Component-level edges are lifted to their containers in top-level views.

## 5. Catalog, coverage, validation

Every catalog view gets `produced`, `partial`, `blocked` or `not_applicable` with a reason; a view without a diagram
cannot be produced or partial. D03, D08, D12-D16 and D18 are always blocked (judgment). D17 is blocked when AI SDKs are
found, otherwise not applicable (not proof of absence). Coverage units: containers (inspected with source and graph,
partially without graph, enumerated without source), stores, API descriptions, excluded paths. Metrics follow the
master prompt; critical journey tracing and parser validation have zero denominators (`n/a`). Gates V01-V13; V04, V05,
V09 and V10 are `not_run` (no journeys, one repository, no bundled Mermaid parser or renderer; a structural lint runs).
Overall status: `PROVISIONAL` when any container or component exists, else `BLOCKED`.

## 6. Outputs

JSON documents (schema 1.0, `schema/blueprint-check.schema.json`): `blueprint-architecture-model`,
`blueprint-evidence-register`, `blueprint-coverage-ledger`, `blueprint-validation-report`; Markdown dossier, README and
open questions; `diagrams/*.mmd`; `workspace.dsl` from Architecture Check's own DSL writer with a header comment.
Deterministic apart from `generated_at` (fixed by `SOURCE_DATE_EPOCH`). Stale `diagrams/D*.mmd` files are removed.

## 7. drift and check

Reads `architecture-model.json` and `evidence-register.json` (kind and schema checked), re-hashes every cited location
(`unchanged`, `changed`, `missing`), derives the model again with the recorded inputs (or the ones given), and compares
component, store and relationship keys. Result `stale` if anything changed. `check` evaluates the policy (exit 4 when
stale); `drift` does not.

## 8. CLI and Action

See `blueprint-check --help` and [ACTION.md](ACTION.md). Exit codes 0/1/2/3/4 as in every Commons tool; errors thrown
by Architecture Check keep their exit code.
