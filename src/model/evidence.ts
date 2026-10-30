// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Evidence register under construction: deduplicates locations, numbers them in insertion order (callers iterate in
 * sorted order, so numbering is deterministic) and hashes the cited lines for later drift checks.
 */
import { excerptHash } from "../input/files.js";
import type { EvidenceRecord, EvidenceType, SourceTool } from "../types.js";

/** A location to register. */
export interface EvidenceInput {
  path: string;
  line_start: number | null;
  line_end: number | null;
  key: string;
  type: EvidenceType;
  observation: string;
  source: SourceTool;
  limitations?: string | null;
}

/** Collects evidence records for one blueprint. */
export class EvidenceRegistry {
  readonly records: EvidenceRecord[] = [];
  private readonly byKey = new Map<string, string>();

  constructor(
    private readonly root: string,
    private readonly snapshot: string | null
  ) {}

  /** Registers a location (or returns the id of an identical one) and returns its evidence id. */
  add(input: EvidenceInput): string {
    const key = [input.path, input.line_start, input.line_end, input.key, input.source].join("\u0000");
    const existing = this.byKey.get(key);
    if (existing) return existing;
    const id = `E${String(this.records.length + 1).padStart(3, "0")}`;
    this.records.push({
      evidence_id: id,
      repo_id: "R1",
      snapshot_ref: this.snapshot,
      relative_path: input.path,
      line_start: input.line_start,
      line_end: input.line_end ?? input.line_start,
      symbol_or_config_key: input.key,
      evidence_type: input.type,
      concise_observation: input.observation,
      source_tool: input.source,
      excerpt_sha256: excerptHash(this.root, input.path, input.line_start, input.line_end),
      supports_claim_ids: [],
      limitations: input.limitations ?? null,
    });
    this.byKey.set(key, id);
    return id;
  }

  /** Back-links each record to the claims that cite it. */
  link(claims: { id: string; evidence_ids: string[] }[]): void {
    const index = new Map<string, Set<string>>();
    for (const claim of claims)
      for (const e of claim.evidence_ids) {
        const set = index.get(e) ?? new Set<string>();
        set.add(claim.id);
        index.set(e, set);
      }
    for (const record of this.records)
      record.supports_claim_ids = [...(index.get(record.evidence_id) ?? [])].sort();
  }
}

/** Maps Architecture Check evidence kinds to the blueprint's evidence types. */
export function typeOfArchitectureEvidence(kind: string): EvidenceType {
  if (kind === "interface-file") return "schema_or_migration";
  if (kind === "import" || kind === "external-import" || kind === "component-directory")
    return "implementation";
  return "registration_or_configuration";
}
