// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Builds the canonical model (docs/SPEC.md §3) from the sources: repository, components, relationships, data stores,
 * contracts, rule-based findings and gaps. Every claim cites evidence; confidence follows the evidence type
 * (configuration and structural facts are CONFIRMED, code references without a proven runtime path CORROBORATED,
 * heuristics INFERRED). Nothing that needs judgment (journeys, trust enforcement, runtime behaviour) is invented: it is
 * recorded as a gap.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { SurfaceEntry, Sources } from "../input/sources.js";
import type { Snapshot } from "../input/git.js";
import type {
  Component,
  Confidence,
  Contract,
  DataStore,
  EvidenceType,
  Finding,
  Gap,
  Relationship,
  Repository,
} from "../types.js";
import { EvidenceRegistry, typeOfArchitectureEvidence } from "./evidence.js";

/** The model before views, coverage and validation are added. */
export interface CoreModel {
  repository: Repository;
  components: Component[];
  relationships: Relationship[];
  data_stores: DataStore[];
  contracts: Contract[];
  findings: Finding[];
  gaps: Gap[];
  /** Surface entries that mark auth boundaries, by owning component id (for the trust view). */
  authBoundaries: Map<string, number>;
  registry: EvidenceRegistry;
  hasGraph: boolean;
  hasSurface: boolean;
}

/** Most evidence records kept per claim (the register stays readable; counts are kept in observations). */
const MAX_EVIDENCE_PER_CLAIM = 8;
/** Most surface entries cited per contract or store. */
const MAX_SURFACE_EVIDENCE = 20;

const pad = (n: number): string => String(n).padStart(2, "0");
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];

/** Type of a surface entry's evidence. */
function surfaceType(kind: SurfaceEntry["kind"]): EvidenceType {
  if (kind === "entity") return "schema_or_migration";
  if (kind === "config") return "registration_or_configuration";
  if (kind === "test") return "test_definition";
  return "implementation";
}

/** Longest implementation-path prefix match of `path` among `components`, or null. */
function ownerOf(path: string, components: Component[]): string | null {
  let best: { id: string; length: number } | null = null;
  for (const c of components)
    for (const p of c.implementation_paths) {
      const prefix = p === "." ? "" : `${p.replace(/\/$/, "")}/`;
      if ((prefix === "" || path.startsWith(prefix)) && (best === null || prefix.length > best.length))
        best = { id: c.id, length: prefix.length };
    }
  return best?.id ?? null;
}

/** Architecture Check's name for a system without a declared model. */
const PLACEHOLDER_NAME = "As-built system";

/** The system's name: the as-built name unless it is the placeholder, then package.json name, then the folder. */
function systemName(root: string, asBuiltName: string): string {
  if (asBuiltName !== PLACEHOLDER_NAME) return asBuiltName;
  try {
    const manifest = join(root, "package.json");
    if (existsSync(manifest)) {
      const name = (JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown }).name;
      if (typeof name === "string" && name.trim() !== "") return name.trim();
    }
  } catch {
    // An unreadable manifest falls back to the folder name.
  }
  return basename(root);
}

/** Builds the core model. `root` is the repository directory (for evidence hashing). */
export function buildModel(root: string, sources: Sources, snapshot: Snapshot): CoreModel {
  const registry = new EvidenceRegistry(root, snapshot.commit);
  const { asBuilt } = sources;
  const hasGraph = sources.graph !== null;
  const hasSurface = sources.surface.length > 0;

  const repository: Repository = {
    id: "R1",
    label: systemName(root, asBuilt.as_built.system_name),
    actual_ref: snapshot.commit,
    branch: snapshot.branch,
    dirty_state: "not_determined",
    access_status: "accessible",
    scope_paths: ["."],
    limitations: [
      "Dirty state is not determined: Blueprint Check reads .git directly and never runs git.",
      ...(snapshot.commit === null
        ? ["No commit could be read from .git; citations carry no snapshot ref."]
        : []),
    ],
  };

  const cite = (evidence: (typeof asBuilt.as_built.elements)[number]["evidence"]): string[] =>
    evidence.slice(0, MAX_EVIDENCE_PER_CLAIM).map((e) =>
      registry.add({
        path: e.path,
        line_start: e.line_start,
        line_end: e.line_end,
        key: e.kind,
        type: typeOfArchitectureEvidence(e.kind),
        observation: e.detail,
        source:
          e.kind === "import" || e.kind === "component-directory"
            ? "impact-check-graph"
            : "architecture-check",
      })
    );

  /** Fallback evidence for an element Architecture Check reports without any: its manifest, else its directory. */
  const sourceEvidence = (paths: string[]): string[] =>
    paths.slice(0, 1).map((p) => {
      const manifest = p === "." ? "package.json" : `${p.replace(/\/$/, "")}/package.json`;
      const hasManifest = existsSync(join(root, manifest));
      return registry.add({
        path: hasManifest ? manifest : p,
        line_start: hasManifest ? 1 : null,
        line_end: hasManifest ? 1 : null,
        key: hasManifest ? "package-manifest" : "source-directory",
        type: "registration_or_configuration",
        observation: hasManifest
          ? "Package manifest of the container's source path"
          : "Source directory of the container",
        source: "blueprint-check",
      });
    });

  // ---------------------------------------------------------------- elements
  const idOf = new Map<string, string>();
  const components: Component[] = [];
  const stores: DataStore[] = [];
  const elements = [...asBuilt.as_built.elements].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let c = 0;
  let x = 0;
  let ds = 0;
  for (const e of elements.filter((el) => el.kind === "container" && el.node_type === "database")) {
    const id = `DS${pad(++ds)}`;
    idOf.set(e.id, id);
    stores.push({
      id,
      key: e.id,
      name: e.name,
      technology_if_proven: e.technology,
      writers: [],
      readers: [],
      schema_paths: [],
      confidence: "CONFIRMED",
      evidence_ids: cite(e.evidence),
    });
  }
  for (const e of elements.filter((el) => el.kind === "container" && el.node_type !== "database")) {
    const id = `C${pad(++c)}`;
    idOf.set(e.id, id);
    components.push({
      id,
      key: e.id,
      name: e.name,
      kind: "container",
      responsibility: `Container derived from ${e.origins.join(", ") || "repository structure"}.`,
      repo_ids: ["R1"],
      implementation_paths: [...e.source_paths].sort(),
      technology: e.technology,
      origins: [...e.origins].sort(),
      descriptors: [...e.descriptors].sort(),
      parent_id: null,
      implementation_status: "wired",
      confidence: "CONFIRMED",
      evidence_ids: e.evidence.length > 0 ? cite(e.evidence) : sourceEvidence(e.source_paths),
    });
  }
  for (const e of elements.filter((el) => el.kind === "component")) {
    const id = `C${pad(++c)}`;
    idOf.set(e.id, id);
    components.push({
      id,
      key: e.id,
      name: e.name,
      kind: "component",
      responsibility: "Source directory component from the module graph.",
      repo_ids: ["R1"],
      implementation_paths: [...e.source_paths].sort(),
      technology: e.technology,
      origins: [...e.origins].sort(),
      descriptors: [],
      parent_id: e.parent === null ? null : (idOf.get(e.parent) ?? null),
      implementation_status: "wired",
      confidence: "CONFIRMED",
      evidence_ids: cite(e.evidence),
    });
  }
  for (const e of elements.filter((el) => el.kind === "external_system")) {
    const id = `X${pad(++x)}`;
    idOf.set(e.id, id);
    components.push({
      id,
      key: e.id,
      name: e.name,
      kind: "external_system",
      responsibility: "External system referenced by vendor SDK imports.",
      repo_ids: [],
      implementation_paths: [],
      technology: e.technology,
      origins: [...e.origins].sort(),
      descriptors: [],
      parent_id: null,
      implementation_status: "unknown",
      // An import shows the code references the SDK; a runtime call is not proven statically.
      confidence: "CORROBORATED",
      evidence_ids: cite(e.evidence),
    });
  }

  // ---------------------------------------------------------------- relationships
  const relationships: Relationship[] = [];
  let r = 0;
  const rels = [...asBuilt.as_built.relationships].sort((a, b) =>
    `${a.from}>${a.to}` < `${b.from}>${b.to}` ? -1 : `${a.from}>${a.to}` > `${b.from}>${b.to}` ? 1 : 0
  );
  for (const rel of rels) {
    const source = idOf.get(rel.from);
    const target = idOf.get(rel.to);
    if (!source || !target) continue;
    const confidence: Confidence = rel.status === "verified_static_fact" ? "CONFIRMED" : "INFERRED";
    relationships.push({
      id: `REL${pad(++r)}`,
      key: `${rel.from}->${rel.to}`,
      source_id: source,
      target_id: target,
      relationship_type: rel.labels[0] ?? "uses",
      purpose: rel.labels.join(", ") || "uses",
      sync_or_async: "unknown",
      contract_ids: [],
      confidence,
      evidence_ids: cite(rel.evidence),
      unresolved_questions:
        confidence === "INFERRED"
          ? ["Heuristic relationship (Architecture Check hypothesis); confirm in code."]
          : [],
    });
    const store = stores.find((s) => s.id === target);
    if (store && !store.readers.includes(source)) store.readers.push(source);
  }

  // ---------------------------------------------------------------- contracts from API descriptions
  const contracts: Contract[] = [];
  let ct = 0;
  for (const api of [...asBuilt.as_built.interfaces].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const owner = api.owner === null ? null : (idOf.get(api.owner) ?? null);
    contracts.push({
      id: `CT${pad(++ct)}`,
      key: `${api.format}:${api.path}`,
      kind: api.format,
      version_if_proven: api.version,
      producer_ids: owner ? [owner] : [],
      definition_paths: [api.path],
      items: 1,
      confidence: "CONFIRMED",
      evidence_ids: [
        registry.add({
          path: api.path,
          line_start: api.line,
          line_end: api.line,
          key: `${api.format} ${api.version}`,
          type: "schema_or_migration",
          observation: `${api.format} ${api.version} description`,
          source: "architecture-check",
        }),
      ],
    });
  }

  // ---------------------------------------------------------------- product surface
  const authBoundaries = new Map<string, number>();
  const containers = components.filter((k) => k.kind === "container");
  const citeSurface = (entries: SurfaceEntry[]): string[] =>
    entries.slice(0, MAX_SURFACE_EVIDENCE).map((s) =>
      registry.add({
        path: s.path,
        line_start: s.line,
        line_end: s.line,
        key: `${s.kind}${s.method ? ` ${s.method}` : ""} ${s.name}`,
        type: surfaceType(s.kind),
        observation: s.detail || `${s.kind} ${s.name}`,
        source: "product-check",
        limitations: s.certainty === "inferred" ? "Product Check marks this entry as inferred." : null,
      })
    );
  const surface = [...sources.surface].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // Integrations: merge into an existing external system of the same name, else add one.
  for (const s of surface.filter((e) => e.kind === "integration")) {
    const match = components.find((k) => k.kind === "external_system" && norm(k.name) === norm(s.name));
    const evidence = citeSurface([s]);
    if (match) match.evidence_ids = uniq([...match.evidence_ids, ...evidence]);
    else
      components.push({
        id: `X${pad(++x)}`,
        key: `surface:${s.id}`,
        name: s.name,
        kind: "external_system",
        responsibility: s.detail || "Integration found by Product Check.",
        repo_ids: [],
        implementation_paths: [],
        technology: null,
        origins: ["product-check surface"],
        descriptors: [],
        parent_id: null,
        implementation_status: "unknown",
        confidence: s.certainty === "observed" ? "CORROBORATED" : "INFERRED",
        evidence_ids: evidence,
      });
  }
  // Endpoints and pages: one contract per owning container and kind.
  const actorNeeded = surface.some((s) => s.kind === "endpoint" || s.kind === "page");
  if (actorNeeded)
    components.unshift({
      id: "U01",
      key: "actor:user",
      name: "User or API client",
      kind: "actor",
      responsibility: "Calls the endpoints and pages the product surface exposes.",
      repo_ids: [],
      implementation_paths: [],
      technology: null,
      origins: ["product-check surface"],
      descriptors: [],
      parent_id: null,
      implementation_status: "unknown",
      confidence: "INFERRED",
      evidence_ids: [],
    });
  for (const kind of ["endpoint", "page"] as const) {
    const byOwner = new Map<string, SurfaceEntry[]>();
    for (const s of surface.filter((e) => e.kind === kind)) {
      const owner = ownerOf(s.path, containers) ?? "";
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), s]);
    }
    for (const [owner, entries] of [...byOwner.entries()].sort()) {
      const id = `CT${pad(++ct)}`;
      const evidence = citeSurface(entries);
      contracts.push({
        id,
        key: `${kind}s:${owner ? (components.find((k) => k.id === owner)?.key ?? owner) : "unassigned"}`,
        kind: kind === "endpoint" ? "http-endpoints" : "pages",
        version_if_proven: null,
        producer_ids: owner ? [owner] : [],
        definition_paths: uniq(entries.map((e) => e.path)).sort(),
        items: entries.length,
        confidence: entries.every((e) => e.certainty === "observed") ? "CONFIRMED" : "CORROBORATED",
        evidence_ids: evidence,
      });
      if (owner)
        relationships.push({
          id: `REL${pad(++r)}`,
          key: `actor:user->${components.find((k) => k.id === owner)?.key ?? owner}:${kind}`,
          source_id: "U01",
          target_id: owner,
          relationship_type: kind === "endpoint" ? "calls" : "visits",
          purpose: `${entries.length} ${kind === "endpoint" ? "HTTP endpoint" : "page"}${entries.length === 1 ? "" : "s"}`,
          sync_or_async: "sync",
          contract_ids: [id],
          confidence: "CORROBORATED",
          evidence_ids: evidence.slice(0, MAX_EVIDENCE_PER_CLAIM),
          unresolved_questions: ["Routing is read from source; deployment exposure is not verified."],
        });
    }
  }
  const entities = surface.filter((e) => e.kind === "entity");
  if (entities.length > 0)
    stores.push({
      id: `DS${pad(ds + 1)}`,
      key: "surface:entities",
      name: `Declared entities (${entities.length})`,
      technology_if_proven: null,
      writers: [],
      readers: uniq(entities.map((e) => ownerOf(e.path, containers)).filter((o): o is string => o !== null)),
      schema_paths: uniq(entities.map((e) => e.path)).sort(),
      confidence: "CORROBORATED",
      evidence_ids: citeSurface(entities),
    });
  for (const s of surface.filter((e) => e.kind === "auth-boundary")) {
    const owner = ownerOf(s.path, containers) ?? "";
    authBoundaries.set(owner, (authBoundaries.get(owner) ?? 0) + 1);
    citeSurface([s]);
  }

  // ---------------------------------------------------------------- findings (rule-based observations)
  const findings: Finding[] = [];
  let f = 0;
  const touched = new Set(relationships.flatMap((rel) => [rel.source_id, rel.target_id]));
  const childOf = (id: string): boolean => components.some((k) => k.parent_id === id && touched.has(k.id));
  if (containers.length > 1)
    for (const k of containers.filter((k) => !touched.has(k.id) && !childOf(k.id)))
      findings.push({
        id: `F${pad(++f)}`,
        rule_id: "isolated-container",
        observation: `${k.name} has no relationship to any other element in the derived model.`,
        impact:
          "Either it really is independent, or its wiring is invisible to static analysis (runtime config, dynamic URLs).",
        affected_ids: [k.id],
        evidence_ids: k.evidence_ids.slice(0, 2),
        confidence: "INFERRED",
        optional_recommendation:
          "Confirm how it is reached; add the missing link to the declared model if one exists.",
      });
  for (const k of contracts.filter(
    (k) => (k.kind === "openapi" || k.kind === "asyncapi") && k.producer_ids.length === 0
  ))
    findings.push({
      id: `F${pad(++f)}`,
      rule_id: "interface-unowned",
      observation: `API description ${k.definition_paths[0] ?? k.key} is not inside any container's source paths.`,
      impact: "Consumers cannot tell which deployable implements the contract.",
      affected_ids: [k.id],
      evidence_ids: k.evidence_ids,
      confidence: "CONFIRMED",
      optional_recommendation: "Move the description next to its service, or declare the owner in the model.",
    });
  const endpoints = surface.filter((e) => e.kind === "endpoint");
  const unhinted = endpoints.filter((e) => !e.auth_hint);
  if (authBoundaries.size > 0 && unhinted.length > 0)
    findings.push({
      id: `F${pad(f + 1)}`,
      rule_id: "endpoints-without-auth-reference",
      observation: `${unhinted.length} of ${endpoints.length} endpoints reference no session or auth helper, although auth boundaries exist.`,
      impact: "Some may be public by design; others may be unprotected. Static source cannot tell which.",
      affected_ids: uniq(
        unhinted.map((e) => ownerOf(e.path, containers)).filter((o): o is string => o !== null)
      ).sort(),
      evidence_ids: citeSurface(unhinted).slice(0, MAX_EVIDENCE_PER_CLAIM),
      confidence: "INFERRED",
      optional_recommendation: "Review each listed endpoint and record which are intentionally public.",
    });

  // ---------------------------------------------------------------- gaps
  const gaps: Gap[] = [];
  let g = 0;
  const gap = (
    code: string,
    description: string,
    criticality: Gap["criticality"],
    confirmation: string,
    paths: string[] = [],
    affected: string[] = []
  ): void => {
    gaps.push({
      id: `G${pad(++g)}`,
      code,
      description,
      affected_ids: affected,
      criticality,
      confirmation_needed: confirmation,
      paths: paths.slice(0, 20),
    });
  };
  for (const limitation of [...asBuilt.coverage_limitations].sort((a, b) => (a.code < b.code ? -1 : 1)))
    gap(
      `architecture-check:${limitation.code}`,
      `${limitation.message} (${limitation.count})`,
      "low",
      "See Architecture Check's coverage limitations for this code.",
      limitation.paths
    );
  if (!hasGraph)
    gap(
      "no-module-graph",
      "No Impact Check module graph was given, so source components and import relationships are not derived.",
      "medium",
      "Run `impact-check graph --format json --output graph.json` and pass --graph graph.json."
    );
  if (!hasSurface)
    gap(
      "no-product-surface",
      "No Product Check surface was given, so endpoints, pages, entities and auth boundaries are not derived.",
      "low",
      "Run `product-check run` (or `product-check spec --format json`) and pass the JSON with --product-check."
    );
  gap(
    "journeys-not-derived",
    "Critical user journeys need a person or an agent to select and trace them; static derivation does not invent them.",
    "high",
    "Name the critical journeys and trace them (for example with the Software Architecture Blueprint master prompt)."
  );
  gap(
    "trust-enforcement-not-traced",
    "Authentication and authorization enforcement are not traced end to end.",
    "high",
    "Trace identity, permission checks and tenant isolation for each protected path."
  );
  gap(
    "runtime-not-observed",
    "Static inspection only: deployment exposure, environment overrides and runtime behaviour are not observed.",
    "medium",
    "Compare with deployment manifests per environment and authorized runtime telemetry."
  );
  gap(
    "operations-not-modelled",
    "Build and release, configuration precedence, observability and resilience are not derived.",
    "low",
    "Review CI workflows, configuration loading, telemetry and retry/timeout code."
  );

  return {
    repository,
    components,
    relationships,
    data_stores: stores,
    contracts,
    findings,
    gaps,
    authBoundaries,
    registry,
    hasGraph,
    hasSurface,
  };
}
