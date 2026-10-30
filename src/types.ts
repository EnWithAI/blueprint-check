// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Blueprint types. The four JSON files of a blueprint (architecture-model.json, evidence-register.json,
 * coverage-ledger.json, validation-report.json) and the drift report of `check` are direct serializations of these
 * types (schema/blueprint-check.schema.json, schema 1.0). Markdown, Mermaid and DSL outputs are renderings of them.
 */

/** Schema version of every JSON document Blueprint Check writes. */
export const SCHEMA_VERSION = "1.0" as const;

/** Per-claim confidence (no probabilities). */
export type Confidence = "CONFIRMED" | "CORROBORATED" | "INFERRED" | "UNKNOWN" | "CONFLICTED";

/** What kind of artifact a piece of evidence is. */
export type EvidenceType =
  | "implementation"
  | "registration_or_configuration"
  | "schema_or_migration"
  | "test_definition"
  | "documentation_intent"
  | "runtime_observation";

/** Which Commons tool observed a piece of evidence. */
export type SourceTool = "architecture-check" | "impact-check-graph" | "product-check" | "blueprint-check";

/** One evidence record: a repository location plus a hash of the cited lines for later drift checks. */
export interface EvidenceRecord {
  evidence_id: string;
  repo_id: string;
  snapshot_ref: string | null;
  relative_path: string;
  line_start: number | null;
  line_end: number | null;
  symbol_or_config_key: string;
  evidence_type: EvidenceType;
  concise_observation: string;
  source_tool: SourceTool;
  /** sha256 of the cited lines (joined with "\n"), or null for directories and unreadable files. */
  excerpt_sha256: string | null;
  supports_claim_ids: string[];
  limitations: string | null;
}

/** The analyzed repository. */
export interface Repository {
  id: string;
  label: string;
  actual_ref: string | null;
  branch: string | null;
  dirty_state: "not_determined";
  access_status: "accessible";
  scope_paths: string[];
  limitations: string[];
}

/** A component of the model (container, component, external system or actor). */
export interface Component {
  id: string;
  /** Stable key from the source tool (as-built id, surface id); used to compare blueprints. */
  key: string;
  name: string;
  kind: "actor" | "container" | "component" | "external_system";
  responsibility: string;
  repo_ids: string[];
  implementation_paths: string[];
  technology: string | null;
  origins: string[];
  descriptors: string[];
  parent_id: string | null;
  implementation_status: "wired" | "unknown";
  confidence: Confidence;
  evidence_ids: string[];
}

/** A relationship between two model ids. */
export interface Relationship {
  id: string;
  key: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  purpose: string;
  sync_or_async: "sync" | "async" | "unknown";
  contract_ids: string[];
  confidence: Confidence;
  evidence_ids: string[];
  unresolved_questions: string[];
}

/** A data store. */
export interface DataStore {
  id: string;
  key: string;
  name: string;
  technology_if_proven: string | null;
  writers: string[];
  readers: string[];
  schema_paths: string[];
  confidence: Confidence;
  evidence_ids: string[];
}

/** An interface contract (API description or a group of discovered endpoints). */
export interface Contract {
  id: string;
  key: string;
  kind: "openapi" | "asyncapi" | "http-endpoints" | "pages";
  version_if_proven: string | null;
  producer_ids: string[];
  definition_paths: string[];
  items: number;
  confidence: Confidence;
  evidence_ids: string[];
}

/** A rule-based observation. */
export interface Finding {
  id: string;
  rule_id: string;
  observation: string;
  impact: string;
  affected_ids: string[];
  evidence_ids: string[];
  confidence: Confidence;
  optional_recommendation: string | null;
}

/** Something the blueprint cannot claim, and what would resolve it. */
export interface Gap {
  id: string;
  code: string;
  description: string;
  affected_ids: string[];
  criticality: "high" | "medium" | "low";
  confirmation_needed: string;
  paths: string[];
}

/** Applicability status of a blueprint catalog view. */
export type ViewStatus = "produced" | "partial" | "not_applicable" | "blocked";

/** One catalog view (D00-D18) and what was produced for it. */
export interface CatalogEntry {
  catalog_id: string;
  name: string;
  status: ViewStatus;
  diagram_ids: string[];
  reason: string;
}

/** One produced Mermaid diagram. */
export interface Diagram {
  id: string;
  catalog_id: string;
  title: string;
  status: ViewStatus;
  component_ids: string[];
  relationship_ids: string[];
  artifact_path: string;
  mermaid: string;
  omitted_nodes: number;
}

/** An input file that contributed to the blueprint. */
export interface InputInfo {
  kind: "impact-check-graph" | "product-check-results" | "product-check-as-built-spec";
  path: string;
  sha256: string;
}

/** architecture-model.json */
export interface ArchitectureModel {
  schema_version: typeof SCHEMA_VERSION;
  kind: "blueprint-architecture-model";
  tool: { name: "blueprint-check"; version: string };
  generated_at: string;
  system_name: string;
  overall_status: "PROVISIONAL" | "BLOCKED";
  inputs: {
    architecture_check: { version: string; config: string };
    graph: InputInfo | null;
    product_check: InputInfo | null;
  };
  repositories: Repository[];
  components: Component[];
  relationships: Relationship[];
  data_stores: DataStore[];
  contracts: Contract[];
  journeys: never[];
  diagrams: Omit<Diagram, "mermaid">[];
  findings: Finding[];
  gaps: Gap[];
  catalog: CatalogEntry[];
}

/** evidence-register.json */
export interface EvidenceRegister {
  schema_version: typeof SCHEMA_VERSION;
  kind: "blueprint-evidence-register";
  citation_format: string;
  evidence: EvidenceRecord[];
}

/** One coverage unit. */
export interface CoverageUnit {
  scope_item_id: string;
  repo_id: string;
  category: string;
  path_or_unit_id: string;
  inspection_status: "enumerated_only" | "inspected" | "partially_inspected" | "excluded" | "inaccessible";
  inspection_depth: string;
  evidence_ids: string[];
  related_diagram_ids: string[];
  exclusion_or_gap_reason: string | null;
}

/** One coverage metric (never combined into a score). */
export interface Metric {
  name: string;
  numerator: number;
  denominator: number;
  percent: number | null;
  note: string;
}

/** coverage-ledger.json */
export interface CoverageLedger {
  schema_version: typeof SCHEMA_VERSION;
  kind: "blueprint-coverage-ledger";
  units: CoverageUnit[];
  metrics: Metric[];
  denominator_note: string;
}

/** One validation gate result. */
export interface Gate {
  id: string;
  check: string;
  status: "pass" | "fail" | "partial" | "not_run";
  method: string;
  evidence: string;
}

/** validation-report.json */
export interface ValidationReport {
  schema_version: typeof SCHEMA_VERSION;
  kind: "blueprint-validation-report";
  gates: Gate[];
}

/** Everything one `generate` run produced, in memory. */
export interface Blueprint {
  model: ArchitectureModel;
  evidence: EvidenceRegister;
  coverage: CoverageLedger;
  validation: ValidationReport;
  diagrams: Diagram[];
  /** Structurizr DSL of the as-built model, for Architecture Check. */
  dsl: string;
}

/** One evidence record whose cited lines no longer match. */
export interface DriftItem {
  evidence_id: string;
  path: string;
  line_start: number | null;
  line_end: number | null;
  state: "changed" | "missing";
}

/** Drift report of `blueprint-check check`. */
export interface DriftReport {
  schema_version: typeof SCHEMA_VERSION;
  kind: "blueprint-check-drift";
  tool: { name: "blueprint-check"; version: string };
  generated_at: string;
  blueprint: { path: string; generated_at: string; tool_version: string };
  evidence: { total: number; unchanged: number; changed: number; missing: number; items: DriftItem[] };
  model: {
    added_components: string[];
    removed_components: string[];
    added_relationships: string[];
    removed_relationships: string[];
  };
  result: "current" | "stale";
  policy: { evaluated: boolean; result: "pass" | "fail" | "not_evaluated" };
}
