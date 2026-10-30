// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * The evidence sources a blueprint is built from: Architecture Check's as-built model (run in-process, with the
 * optional Impact Check module graph) and, optionally, the product surface from a Product Check results or as-built
 * spec file. Each input is version-checked; unknown versions are refused instead of guessed.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import * as architectureCheck from "@enwithai/architecture-check";
import { inputError } from "../errors.js";
import type { InputInfo } from "../types.js";
import { readJsonInput } from "./files.js";

/** Architecture Check's derive report. */
export type AsBuiltReport = architectureCheck.Report;

/** One entry of the product surface (pages, endpoints, entities, integrations, auth boundaries). */
export interface SurfaceEntry {
  id: string;
  kind: "page" | "endpoint" | "entity" | "config" | "integration" | "auth-boundary" | "test";
  name: string;
  method: string | null;
  area: string;
  detail: string;
  path: string;
  line: number | null;
  certainty: "observed" | "inferred";
  auth_hint: boolean;
}

/** Everything the model builder needs. */
export interface Sources {
  asBuilt: AsBuiltReport;
  architectureConfig: string;
  graph: InputInfo | null;
  surface: SurfaceEntry[];
  product: InputInfo | null;
}

/** Options for reading the sources. */
export interface SourceOptions {
  cwd: string;
  graphPath: string | null;
  productCheckPath: string | null;
  architectureConfigPath: string | null;
  now: () => Date;
}

const PRODUCT_SCHEMA = "0.1.0";
const SURFACE_KINDS = new Set([
  "page",
  "endpoint",
  "entity",
  "config",
  "integration",
  "auth-boundary",
  "test",
]);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Validates and narrows the surface array of a Product Check document. */
function parseSurface(raw: unknown, source: string): SurfaceEntry[] {
  if (!Array.isArray(raw)) throw inputError(`${source} has no surface array.`);
  return raw.map((entry, index) => {
    const location = isObj(entry) ? entry["location"] : undefined;
    if (
      !isObj(entry) ||
      typeof entry["id"] !== "string" ||
      typeof entry["name"] !== "string" ||
      !SURFACE_KINDS.has(String(entry["kind"])) ||
      !isObj(location) ||
      typeof location["path"] !== "string"
    )
      throw inputError(`${source}: surface entry ${index} is malformed.`);
    return {
      id: entry["id"],
      kind: entry["kind"] as SurfaceEntry["kind"],
      name: entry["name"],
      method: typeof entry["method"] === "string" ? entry["method"] : null,
      area: typeof entry["area"] === "string" ? entry["area"] : "",
      detail: typeof entry["detail"] === "string" ? entry["detail"] : "",
      path: location["path"],
      line: typeof location["line"] === "number" ? location["line"] : null,
      certainty: entry["certainty"] === "observed" ? "observed" : "inferred",
      auth_hint: entry["auth_hint"] === true,
    };
  });
}

/** Reads a Product Check results file (with an embedded as-built spec) or an as-built spec file. */
export function readProductSurface(
  path: string,
  display: string
): { surface: SurfaceEntry[]; info: InputInfo } {
  const { data, sha } = readJsonInput(path, "Product Check input");
  if (!isObj(data) || data["schema_version"] !== PRODUCT_SCHEMA)
    throw inputError(
      `${display} is not a Product Check document with schema_version ${PRODUCT_SCHEMA}.`,
      "Pass product-check-results.json from `product-check run`, or the JSON from `product-check spec --format json`."
    );
  if (data["kind"] === "as-built-spec")
    return {
      surface: parseSurface(data["surface"], display),
      info: { kind: "product-check-as-built-spec", path: display, sha256: sha },
    };
  if (data["kind"] === "product-check-results") {
    const blueprint = data["blueprint"];
    const asIs = isObj(blueprint) ? blueprint["as_is"] : undefined;
    const asBuilt = isObj(asIs) ? asIs["as_built"] : undefined;
    return {
      // Results without source inspection carry no as-built body: an empty surface, not an error.
      surface: isObj(asBuilt) ? parseSurface(asBuilt["surface"], display) : [],
      info: { kind: "product-check-results", path: display, sha256: sha },
    };
  }
  throw inputError(
    `${display} has kind ${JSON.stringify(data["kind"])}; expected product-check-results or as-built-spec.`
  );
}

/** Reads every source. Architecture Check runs in-process in derive mode and writes nothing. */
export function readSources(options: SourceOptions): Sources {
  const cwd = resolve(options.cwd);
  const configFile = options.architectureConfigPath
    ? resolve(cwd, options.architectureConfigPath)
    : join(cwd, ".architecture-check.json");
  const explicitConfig = options.architectureConfigPath !== null;
  if (explicitConfig && !existsSync(configFile))
    throw inputError(`Architecture Check config not found: ${options.architectureConfigPath}`);
  const useFile = existsSync(configFile);
  const config = useFile ? architectureCheck.loadConfigFile(configFile) : architectureCheck.DEFAULT_CONFIG;

  let graph: InputInfo | null = null;
  if (options.graphPath !== null) {
    const abs = resolve(cwd, options.graphPath);
    graph = { kind: "impact-check-graph", path: options.graphPath, sha256: readJsonInput(abs, "Graph").sha };
  }
  const asBuilt = architectureCheck.analyze({
    cwd,
    command: "derive",
    config,
    graphPath: options.graphPath === null ? null : resolve(cwd, options.graphPath),
    now: options.now,
  });

  let surface: SurfaceEntry[] = [];
  let product: InputInfo | null = null;
  if (options.productCheckPath !== null) {
    const read = readProductSurface(resolve(cwd, options.productCheckPath), options.productCheckPath);
    surface = read.surface;
    product = read.info;
  }
  return {
    asBuilt,
    architectureConfig: useFile ? (options.architectureConfigPath ?? ".architecture-check.json") : "defaults",
    graph,
    surface,
    product,
  };
}
