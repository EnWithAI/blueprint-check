// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Assessment of a built model (docs/SPEC.md §5): the status of every catalog view (D00-D18), the coverage ledger
 * with reproducible metrics, and the validation gates. Views that need judgment are `blocked` with the reason and
 * what would unblock them; they are never filled with invented content.
 */
import { lintMermaid } from "../render/mermaid.js";
import type { CatalogEntry, CoverageUnit, Diagram, Gate, Metric } from "../types.js";
import type { CoreModel } from "./build.js";

/** Catalog view names (Software Architecture Blueprint master prompt v2). */
export const CATALOG: Record<string, string> = {
  D00: "Master software blueprint",
  D01: "Repository and deployable map",
  D02: "Application floor plan",
  D03: "User and request flow",
  D04: "Data plumbing",
  D05: "API and event wiring",
  D06: "Authentication and security flow",
  D07: "Database and storage blueprint",
  D08: "Background processing",
  D09: "External integrations site plan",
  D10: "Deployment and runtime blueprint",
  D11: "Domain and component detail",
  D12: "Critical journey sequences",
  D13: "Build, release and supply path",
  D14: "Configuration, environments and feature variants",
  D15: "Observability and operational control",
  D16: "Resilience and failure paths",
  D17: "AI, agent and retrieval blueprint",
  D18: "Tenancy and data isolation",
};

const NEEDS_JUDGMENT =
  "Needs a person or an agent: static derivation cannot select or trace this without inventing it. Gap recorded.";

/** Assigns a justified status to every catalog view. */
export function assessCatalog(model: CoreModel, diagrams: Diagram[]): CatalogEntry[] {
  const of = (id: string): string[] => diagrams.filter((d) => d.catalog_id === id).map((d) => d.id);
  const containers = model.components.filter((c) => c.kind === "container");
  const hasAi = model.components.some(
    (c) =>
      c.kind === "external_system" &&
      /openai|anthropic|gemini|vertex|bedrock|mistral|cohere|hugging ?face|replicate|groq/i.test(c.name)
  );
  const entry = (id: string, status: CatalogEntry["status"], reason: string): CatalogEntry => ({
    catalog_id: id,
    name: CATALOG[id] ?? id,
    status: of(id).length === 0 && (status === "produced" || status === "partial") ? "blocked" : status,
    diagram_ids: of(id),
    reason,
  });
  return [
    entry(
      "D00",
      containers.length > 0 ? "produced" : "partial",
      containers.length > 0
        ? "From the as-built model."
        : "No containers derived; the view shows an empty system boundary."
    ),
    entry(
      "D01",
      "produced",
      "Containers grouped by how they are declared (compose, Kubernetes, Dockerfile, package)."
    ),
    entry(
      "D02",
      model.hasGraph ? "produced" : "partial",
      model.hasGraph
        ? "Containers with module-graph components."
        : "No module graph: containers only, no components."
    ),
    entry("D03", "blocked", `Request flows need traced journeys. ${NEEDS_JUDGMENT}`),
    entry(
      "D04",
      of("D04").length ? "partial" : "blocked",
      of("D04").length
        ? "Store and integration edges are shown; reads versus writes and transformations are not derived."
        : "No data stores or external systems found in inspected scope."
    ),
    entry(
      "D05",
      "produced",
      "Derived relationships plus API descriptions and discovered endpoints. Queues, pub/sub and webhooks are not detected by the inputs."
    ),
    entry(
      "D06",
      model.authBoundaries.size > 0 ? "partial" : "blocked",
      model.authBoundaries.size > 0
        ? "Auth boundaries found in source; enforcement order, identity provider and token storage are not traced."
        : `No auth surface in the inputs. ${NEEDS_JUDGMENT}`
    ),
    entry(
      "D07",
      model.data_stores.length > 0 ? "produced" : "not_applicable",
      model.data_stores.length > 0
        ? "Database containers and declared entities."
        : "No database container or entity found in inspected scope (not proof that none exists)."
    ),
    entry(
      "D08",
      "blocked",
      `Schedulers, queues and workers are not detected by the inputs. ${NEEDS_JUDGMENT}`
    ),
    entry(
      "D09",
      of("D09").length ? "produced" : "not_applicable",
      of("D09").length
        ? "External systems from SDK imports and Product Check integrations."
        : "No external system found in inspected scope."
    ),
    entry(
      "D10",
      of("D10").length ? "produced" : "blocked",
      of("D10").length
        ? "Compose, Kubernetes and Dockerfile declarations; not proof of production deployment."
        : "No deployment descriptor found in inspected scope."
    ),
    entry(
      "D11",
      of("D11").length ? "produced" : model.hasGraph ? "not_applicable" : "blocked",
      of("D11").length
        ? "One view per container with components."
        : model.hasGraph
          ? "No container has components."
          : "Needs the Impact Check module graph (--graph)."
    ),
    entry("D12", "blocked", `Critical journeys are not derived. ${NEEDS_JUDGMENT}`),
    entry("D13", "blocked", `CI and release definitions are not modelled by the inputs. ${NEEDS_JUDGMENT}`),
    entry("D14", "blocked", `Configuration precedence is not derived. ${NEEDS_JUDGMENT}`),
    entry("D15", "blocked", `Telemetry wiring is not derived. ${NEEDS_JUDGMENT}`),
    entry("D16", "blocked", `Timeouts, retries and recovery are not derived. ${NEEDS_JUDGMENT}`),
    entry(
      "D17",
      hasAi ? "blocked" : "not_applicable",
      hasAi
        ? `AI SDK imports found; model calls, prompts and guardrails need tracing. ${NEEDS_JUDGMENT}`
        : "No AI SDK import found by Architecture Check's vendor map (not proof of absence)."
    ),
    entry("D18", "blocked", `Tenancy is not evidenced or refuted by the inputs. ${NEEDS_JUDGMENT}`),
  ];
}

/** Builds the coverage units: containers, stores and API description sets, plus excluded paths. */
export function coverageUnits(model: CoreModel, diagrams: Diagram[]): CoverageUnit[] {
  const units: CoverageUnit[] = [];
  let u = 0;
  const id = (): string => `U${String(++u).padStart(2, "0")}`;
  const diagramsOf = (key: string): string[] =>
    diagrams.filter((d) => d.component_ids.includes(key)).map((d) => d.id);
  for (const c of model.components.filter((k) => k.kind === "container")) {
    const hasSource = c.implementation_paths.length > 0;
    units.push({
      scope_item_id: id(),
      repo_id: "R1",
      category: "runnable or deployable unit",
      path_or_unit_id: `${c.id} ${c.name}`,
      inspection_status: !hasSource
        ? "enumerated_only"
        : model.hasGraph
          ? "inspected"
          : "partially_inspected",
      inspection_depth: !hasSource
        ? "declared only (image or descriptor without source paths)"
        : model.hasGraph
          ? "declaration, source paths and module-graph components"
          : "declaration and source paths; no module graph",
      evidence_ids: c.evidence_ids,
      related_diagram_ids: diagramsOf(c.id),
      exclusion_or_gap_reason: !hasSource
        ? "No source paths to inspect"
        : model.hasGraph
          ? null
          : "No module graph",
    });
  }
  for (const s of model.data_stores)
    units.push({
      scope_item_id: id(),
      repo_id: "R1",
      category: "data schema or store",
      path_or_unit_id: `${s.id} ${s.name}`,
      inspection_status: s.schema_paths.length > 0 ? "partially_inspected" : "enumerated_only",
      inspection_depth: s.schema_paths.length > 0 ? "entity declarations located" : "declared container only",
      evidence_ids: s.evidence_ids,
      related_diagram_ids: diagramsOf(s.id),
      exclusion_or_gap_reason: "Schemas and migrations are not read",
    });
  for (const ct of model.contracts.filter((k) => k.kind === "openapi" || k.kind === "asyncapi"))
    units.push({
      scope_item_id: id(),
      repo_id: "R1",
      category: "contract definition",
      path_or_unit_id: `${ct.id} ${ct.definition_paths[0] ?? ct.key}`,
      inspection_status: "partially_inspected",
      inspection_depth: "format and version identified; operations not compared",
      evidence_ids: ct.evidence_ids,
      related_diagram_ids: diagramsOf(ct.id),
      exclusion_or_gap_reason: "Operations are not modelled",
    });
  for (const g of model.gaps.filter((k) => k.code.startsWith("architecture-check:") && k.paths.length > 0))
    units.push({
      scope_item_id: id(),
      repo_id: "R1",
      category: "excluded paths",
      path_or_unit_id: g.paths.slice(0, 5).join(", "),
      inspection_status: "excluded",
      inspection_depth: "not read",
      evidence_ids: [],
      related_diagram_ids: [],
      exclusion_or_gap_reason: g.description,
    });
  return units;
}

const metric = (name: string, numerator: number, denominator: number, note: string): Metric => ({
  name,
  numerator,
  denominator,
  percent: denominator === 0 ? null : Math.round((1000 * numerator) / denominator) / 10,
  note,
});

/** Computes the coverage metrics from the ledger and model. */
export function coverageMetrics(
  model: CoreModel,
  units: CoverageUnit[],
  diagrams: Diagram[],
  catalog: CatalogEntry[]
): Metric[] {
  const inScope = units.filter((u) => u.inspection_status !== "excluded");
  const drawn = new Set(diagrams.flatMap((d) => d.component_ids));
  const material = [...model.components.map((c) => c.id), ...model.data_stores.map((s) => s.id)];
  return [
    metric("repository_access", 1, 1, "One repository per run."),
    metric(
      "architectural_unit_inspection",
      inScope.filter((u) => u.inspection_status === "inspected").length,
      inScope.length,
      `partially_inspected=${inScope.filter((u) => u.inspection_status === "partially_inspected").length}, enumerated_only=${inScope.filter((u) => u.inspection_status === "enumerated_only").length}, excluded=${units.length - inScope.length}`
    ),
    metric(
      "component_representation",
      material.filter((i) => drawn.has(i)).length,
      material.length,
      "Elements beyond a view's node budget count only if another view draws them."
    ),
    metric(
      "material_edge_verification",
      model.relationships.filter((r) => r.confidence === "CONFIRMED").length,
      model.relationships.length,
      `CORROBORATED=${model.relationships.filter((r) => r.confidence === "CORROBORATED").length}, INFERRED=${model.relationships.filter((r) => r.confidence === "INFERRED").length}`
    ),
    metric(
      "critical_journey_tracing",
      0,
      0,
      "Not derived; journeys need a person or an agent (gap journeys-not-derived)."
    ),
    metric(
      "blueprint_view_assessment",
      catalog.length,
      Object.keys(CATALOG).length,
      "Every view has produced, partial, blocked or not_applicable with a reason."
    ),
    metric(
      "diagram_parser_validation",
      0,
      0,
      "Not run: Blueprint Check bundles no Mermaid parser (structural lint only; see V09)."
    ),
  ];
}

/** Integrity of the model: unique ids and resolvable references. Returns problems (empty when sound). */
export function integrity(model: CoreModel, diagrams: Diagram[]): string[] {
  const problems: string[] = [];
  const ids = [
    model.repository.id,
    ...model.components.map((c) => c.id),
    ...model.relationships.map((r) => r.id),
    ...model.data_stores.map((s) => s.id),
    ...model.contracts.map((c) => c.id),
    ...model.findings.map((f) => f.id),
    ...model.gaps.map((g) => g.id),
    ...diagrams.map((d) => d.id),
  ];
  const seen = new Set<string>();
  for (const i of ids) {
    if (seen.has(i)) problems.push(`duplicate id ${i}`);
    seen.add(i);
  }
  const evidence = new Set(model.registry.records.map((e) => e.evidence_id));
  const ends = new Set([...model.components.map((c) => c.id), ...model.data_stores.map((s) => s.id)]);
  for (const r of model.relationships) {
    if (!ends.has(r.source_id) || !ends.has(r.target_id)) problems.push(`${r.id} has an unknown endpoint`);
  }
  for (const claim of [
    ...model.components,
    ...model.relationships,
    ...model.data_stores,
    ...model.contracts,
    ...model.findings,
  ])
    for (const e of claim.evidence_ids) if (!evidence.has(e)) problems.push(`${claim.id} cites unknown ${e}`);
  for (const d of diagrams)
    for (const c of d.component_ids) if (!seen.has(c)) problems.push(`${d.id} draws unknown ${c}`);
  return problems;
}

/** Validation gates V01-V13 for one generated blueprint. */
export function validationGates(
  model: CoreModel,
  diagrams: Diagram[],
  catalog: CatalogEntry[],
  problems: string[]
): Gate[] {
  const records = model.registry.records;
  const lint = diagrams.map((d) => ({ id: d.id, problems: lintMermaid(d.mermaid) }));
  const lintFailures = lint.filter((l) => l.problems.length > 0);
  const unhashed = records.filter((e) => e.line_start !== null && e.excerpt_sha256 === null).length;
  const claims = [
    ...model.components.filter((c) => c.kind !== "actor"),
    ...model.relationships,
    ...model.data_stores,
    ...model.contracts,
  ];
  const uncited = claims.filter((c) => c.evidence_ids.length === 0).map((c) => c.id);
  return [
    {
      id: "V01",
      check: "Scope integrity",
      status: "pass",
      method: "Repository root and .git snapshot read directly",
      evidence: `R1 at ${model.repository.actual_ref ?? "unknown commit"}; dirty state not determined`,
    },
    {
      id: "V02",
      check: "Inventory completeness",
      status: "pass",
      method: "Every container, store and API description is a coverage unit with an explicit status",
      evidence: "Enumeration is never counted as inspection",
    },
    {
      id: "V03",
      check: "Source traceability",
      status: uncited.length === 0 ? "pass" : "partial",
      method: "Every evidence record is a location reported by an input tool; cited lines are hashed",
      evidence: `${records.length} records, ${unhashed} with a line that could not be hashed${uncited.length ? `; uncited: ${uncited.join(", ")}` : ""}`,
    },
    {
      id: "V04",
      check: "Critical journeys",
      status: "not_run",
      method: "Journeys are not derived",
      evidence: "Gap journeys-not-derived",
    },
    {
      id: "V05",
      check: "Cross-repository contracts",
      status: "not_run",
      method: "Single repository per run",
      evidence: "Generate one blueprint per repository; cross-repository bindings need a person or an agent",
    },
    {
      id: "V06",
      check: "As-built accuracy",
      status: "pass",
      method:
        "Heuristic edges are INFERRED; SDK imports are CORROBORATED, not proven calls; deployment descriptors are not called production",
      evidence: `${model.relationships.filter((r) => r.confidence === "INFERRED").length} INFERRED relationships labelled in views`,
    },
    {
      id: "V07",
      check: "Cross-view consistency",
      status: problems.length === 0 ? "pass" : "fail",
      method: "Views are generated from the model; node ids carry model ids",
      evidence: problems.length === 0 ? "All references resolve" : problems.slice(0, 10).join("; "),
    },
    {
      id: "V08",
      check: "Catalog coverage",
      status: catalog.length === 19 ? "pass" : "fail",
      method: "All 19 catalog views assigned a status",
      evidence: catalog.map((c) => `${c.catalog_id}=${c.status}`).join(", "),
    },
    {
      id: "V09",
      check: "Mermaid validation",
      status: "not_run",
      method: "No Mermaid parser bundled; structural lint only",
      evidence:
        lintFailures.length === 0
          ? `Structural lint clean for ${lint.length} diagrams`
          : `Lint problems: ${lintFailures.map((l) => `${l.id}: ${l.problems.join("; ")}`).join(" | ")}`,
    },
    {
      id: "V10",
      check: "Rendered readability",
      status: "not_run",
      method: "No renderer bundled",
      evidence: `Node budget ${22} per view; omitted elements are counted`,
    },
    {
      id: "V11",
      check: "Machine-readable integrity",
      status: problems.length === 0 ? "pass" : "fail",
      method:
        "Unique ids and reference resolution; JSON validated against schema/blueprint-check.schema.json in tests",
      evidence: problems.length === 0 ? "No problems" : `${problems.length} problems`,
    },
    {
      id: "V12",
      check: "Coverage honesty",
      status: "pass",
      method: "Metrics computed from the ledger; zero denominators are null, never 100%",
      evidence: "See coverage-ledger.json",
    },
    {
      id: "V13",
      check: "Sensitive data and source preservation",
      status: "pass",
      method:
        "Every output string is token-redacted; environment values never kept; nothing written outside the output directory",
      evidence: "Redaction applied to all documents and labels",
    },
  ];
}
