// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * `check` (docs/SPEC.md §7): is a committed blueprint still true? Two independent signals:
 * 1. evidence drift: every cited location is re-hashed; changed or missing lines make the blueprint stale;
 * 2. model drift: the model is derived again from the same kinds of input and its component and relationship keys are
 *    compared with the blueprint's.
 */
import { join, relative, resolve, sep } from "node:path";
import { inputError } from "../errors.js";
import { locationState, readJsonInput } from "../input/files.js";
import { generate } from "../generate.js";
import type { ArchitectureModel, DriftItem, DriftReport, EvidenceRecord } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
import { TOOL_VERSION } from "../version.js";

/** Options for one check run. */
export interface CheckOptions {
  cwd: string;
  blueprintDir: string;
  graphPath?: string | null;
  productCheckPath?: string | null;
  architectureConfigPath?: string | null;
  policy: boolean;
  now?: () => Date;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads one blueprint JSON file and checks its kind and schema version. */
function readDoc<T>(dir: string, file: string, kind: string): T {
  const { data } = readJsonInput(join(dir, file), `Blueprint file ${file}`);
  if (!isObj(data) || data["kind"] !== kind || data["schema_version"] !== SCHEMA_VERSION)
    throw inputError(
      `${file} is not a Blueprint Check ${kind} with schema_version ${SCHEMA_VERSION}.`,
      "Generate the blueprint with `blueprint-check generate` first."
    );
  return data as T;
}

const diff = (before: string[], after: string[]): { added: string[]; removed: string[] } => {
  const a = new Set(after);
  const b = new Set(before);
  return { added: [...a].filter((k) => !b.has(k)).sort(), removed: [...b].filter((k) => !a.has(k)).sort() };
};

/** Checks the blueprint in `blueprintDir` against the repository in `cwd`. */
export function checkBlueprint(options: CheckOptions): DriftReport {
  const cwd = resolve(options.cwd);
  const dir = resolve(cwd, options.blueprintDir);
  const model = readDoc<ArchitectureModel>(dir, "architecture-model.json", "blueprint-architecture-model");
  const register = readDoc<{ evidence: EvidenceRecord[] }>(
    dir,
    "evidence-register.json",
    "blueprint-evidence-register"
  );
  if (
    !Array.isArray(register.evidence) ||
    !Array.isArray(model.components) ||
    !Array.isArray(model.relationships)
  )
    throw inputError("The blueprint files are incomplete (missing evidence, components or relationships).");

  const items: DriftItem[] = [];
  let unchanged = 0;
  for (const e of register.evidence) {
    const state = locationState(cwd, e.relative_path, e.line_start, e.line_end, e.excerpt_sha256);
    if (state === "unchanged") unchanged++;
    else
      items.push({
        evidence_id: e.evidence_id,
        path: e.relative_path,
        line_start: e.line_start,
        line_end: e.line_end,
        state,
      });
  }

  // Re-derive with the inputs the blueprint recorded, unless the caller names others.
  const fresh = generate({
    cwd,
    graphPath: options.graphPath !== undefined ? options.graphPath : (model.inputs.graph?.path ?? null),
    productCheckPath:
      options.productCheckPath !== undefined
        ? options.productCheckPath
        : (model.inputs.product_check?.path ?? null),
    architectureConfigPath: options.architectureConfigPath ?? null,
    ...(options.now ? { now: options.now } : {}),
  });
  // Data stores count as components here: a new database or cache is an architectural change.
  const keys = (m: ArchitectureModel): string[] => [
    ...m.components.map((c) => c.key),
    ...(m.data_stores ?? []).map((s) => s.key),
  ];
  const components = diff(keys(model), keys(fresh.model));
  const relationships = diff(
    model.relationships.map((r) => r.key),
    fresh.model.relationships.map((r) => r.key)
  );

  const stale =
    items.length > 0 ||
    components.added.length +
      components.removed.length +
      relationships.added.length +
      relationships.removed.length >
      0;
  const rel = relative(cwd, dir).split(sep).join("/") || ".";
  return {
    schema_version: SCHEMA_VERSION,
    kind: "blueprint-check-drift",
    tool: { name: "blueprint-check", version: TOOL_VERSION },
    generated_at: (options.now ?? ((): Date => new Date()))().toISOString(),
    blueprint: { path: rel, generated_at: model.generated_at, tool_version: model.tool.version },
    evidence: {
      total: register.evidence.length,
      unchanged,
      changed: items.filter((i) => i.state === "changed").length,
      missing: items.filter((i) => i.state === "missing").length,
      items,
    },
    model: {
      added_components: components.added,
      removed_components: components.removed,
      added_relationships: relationships.added,
      removed_relationships: relationships.removed,
    },
    result: stale ? "stale" : "current",
    policy: options.policy
      ? { evaluated: true, result: stale ? "fail" : "pass" }
      : { evaluated: false, result: "not_evaluated" },
  };
}
