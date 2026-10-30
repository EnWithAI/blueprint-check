// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Command-line interface (docs/SPEC.md §8): argument parsing (node:util parseArgs), commands (generate, drift, check,
 * schema), output writing and the mapping of every error to a documented exit code.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { checkBlueprint } from "../check/drift.js";
import { BlueprintCheckError, ExitCode, usageError } from "../errors.js";
import { generate } from "../generate.js";
import { inside } from "../input/files.js";
import { writeBlueprint } from "../render/files.js";
import { renderDriftMarkdown } from "../render/markdown.js";
import { TOOL_VERSION } from "../version.js";

/** I/O seams for the CLI so it can run in-process in tests. */
export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
  now?: () => Date;
}

/** Architecture Check's default declared-model locations (a declared model is never overwritten). */
export const DECLARED_MODEL_PATHS = [
  "architecture/workspace.dsl",
  "architecture/calm.json",
  "architecture/architecture.json",
  "workspace.dsl",
  "docs/architecture/workspace.dsl",
  "docs/architecture/calm.json",
];

/** Text printed by `blueprint-check --help`. */
export const HELP = `Blueprint Check ${TOOL_VERSION} — generate the as-built architecture blueprint of a repository, then keep it true.

Usage:
  blueprint-check generate [options]   Write the blueprint package (dossier, Mermaid views, model, evidence,
                                       coverage, validation, workspace.dsl) to --out-dir
  blueprint-check drift    [options]   Compare a blueprint with the code (exit 0 unless an error occurs)
  blueprint-check check    [options]   Compare, then fail (exit 4) when the blueprint is stale
  blueprint-check schema               Print the JSON Schema of the blueprint documents
  blueprint-check --help | --version

Options:
  --cwd <dir>                   Repository root (default: current directory)
  --out-dir <dir>               generate: output directory, relative to --cwd (default: architecture-blueprint)
  --blueprint <dir>             drift/check: blueprint directory, relative to --cwd (default: architecture-blueprint)
  --graph <file>                Module graph from \`impact-check graph --format json\` (adds components and imports)
  --product-check <file>        product-check-results.json, or \`product-check spec --format json\` output
                                (adds endpoints, pages, entities, integrations, auth boundaries)
  --architecture-config <file>  Architecture Check config (default: .architecture-check.json in --cwd, if present)
  --write-model                 generate: also write architecture/workspace.dsl when no declared model exists,
                                so Architecture Check can guard it from then on (an existing model is never touched)
  --format <fmt>                drift/check: markdown (default) or json
  --output <file>               drift/check: write the report to a file instead of stdout
  --no-branding                 Omit footer links
  --on-error <fail|pass>        Internal/input errors: fail (default; exit 1/3) or pass (warn, exit 0)
  --quiet                       No progress messages on stderr
  -h, --help / -v, --version

Views that need judgment (journeys, trust enforcement, operations) are marked blocked, never invented.
Exit codes: 0 ok · 1 internal error · 2 usage error · 3 input error · 4 stale blueprint (check)
Privacy: offline; no network access, no telemetry, nothing executed, no model used.
`;

/** Writes a file atomically (temp file + rename); the parent directory must exist. */
function writeOutput(path: string, content: string): void {
  if (existsSync(path) && statSync(path).isDirectory())
    throw usageError(`--output points to a directory: ${path}`);
  if (!existsSync(dirname(path))) throw usageError(`Output directory does not exist: ${dirname(path)}`);
  const temp = join(dirname(path), `.blueprint-check-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(temp, content, { mode: 0o644 });
  renameSync(temp, path);
}

/** Returns the bundled JSON Schema (works from both src/ and dist/). */
export function readSchema(): string {
  return readFileSync(new URL("../../schema/blueprint-check.schema.json", import.meta.url), "utf8");
}

/** Set by --on-error pass: internal/input errors become warnings with exit 0 (fail-open). */
let failOpen = false;

/** Parses arguments and runs one command. Throws BlueprintCheckError for expected failures. */
async function main(argv: string[], io: CliIO): Promise<number> {
  const { values, positionals } = (() => {
    try {
      return parseArgs({
        args: argv,
        allowPositionals: true,
        strict: true,
        options: {
          cwd: { type: "string" },
          "out-dir": { type: "string" },
          blueprint: { type: "string" },
          graph: { type: "string" },
          "product-check": { type: "string" },
          "architecture-config": { type: "string" },
          "write-model": { type: "boolean" },
          format: { type: "string" },
          output: { type: "string" },
          "no-branding": { type: "boolean" },
          "on-error": { type: "string" },
          quiet: { type: "boolean" },
          help: { type: "boolean", short: "h" },
          version: { type: "boolean", short: "v" },
        },
      });
    } catch (error) {
      throw usageError((error as Error).message, "Run `blueprint-check --help` for usage.");
    }
  })();

  if (values.help) {
    io.stdout(HELP);
    return ExitCode.Ok;
  }
  if (values.version) {
    io.stdout(`${TOOL_VERSION}\n`);
    return ExitCode.Ok;
  }
  const [command, ...rest] = positionals;
  if (command === undefined) {
    io.stderr(HELP);
    return ExitCode.Usage;
  }
  if (rest.length > 0) throw usageError(`Unexpected argument: ${rest[0] as string}`);
  if (command === "schema") {
    io.stdout(readSchema());
    return ExitCode.Ok;
  }
  if (command !== "generate" && command !== "drift" && command !== "check")
    throw usageError(`Unknown command: ${command}`, "Commands: generate, drift, check, schema.");

  const onError = values["on-error"] ?? "fail";
  if (onError !== "fail" && onError !== "pass") throw usageError(`--on-error must be "fail" or "pass"`);
  failOpen = onError === "pass";
  const cwd = values.cwd ? resolve(io.cwd, values.cwd) : io.cwd;
  if (!existsSync(cwd) || !statSync(cwd).isDirectory())
    throw usageError(`--cwd is not a directory: ${values.cwd ?? cwd}`);
  const fromCwd = (p: string | undefined): string | null =>
    p === undefined ? null : isAbsolute(p) ? p : resolve(cwd, p);
  const branding = !values["no-branding"];
  const log = (message: string): void => {
    if (!values.quiet) io.stderr(`blueprint-check: ${message}\n`);
  };

  if (command === "generate") {
    for (const flag of ["format", "output", "blueprint"] as const)
      if (values[flag] !== undefined) throw usageError(`generate takes no --${flag}`);
    const outDir = resolve(cwd, values["out-dir"] ?? "architecture-blueprint");
    if (existsSync(outDir) && !statSync(outDir).isDirectory())
      throw usageError(
        `--out-dir exists and is not a directory: ${values["out-dir"] ?? "architecture-blueprint"}`
      );
    const bp = generate({
      cwd,
      graphPath: fromCwd(values.graph),
      productCheckPath: fromCwd(values["product-check"]),
      architectureConfigPath: fromCwd(values["architecture-config"]),
      ...(io.now ? { now: io.now } : {}),
    });
    mkdirSync(outDir, { recursive: true });
    const files = writeBlueprint(bp, outDir, { branding });
    const display = relative(cwd, outDir).split(sep).join("/") || ".";
    if (values["write-model"]) {
      const declared = DECLARED_MODEL_PATHS.find((p) => existsSync(join(cwd, p)));
      if (declared)
        log(`declared model ${declared} exists; not overwritten (compare with ${display}/workspace.dsl)`);
      else {
        mkdirSync(join(cwd, "architecture"), { recursive: true });
        writeOutput(join(cwd, "architecture", "workspace.dsl"), bp.dsl);
        log("wrote architecture/workspace.dsl: review it, commit it, then run `architecture-check check`");
      }
    }
    const m = bp.model;
    log(
      `${m.overall_status}: ${m.components.length} element(s), ${m.relationships.length} relationship(s), ` +
        `${bp.evidence.evidence.length} evidence record(s), ${bp.diagrams.length} view(s), ${files.length} file(s) in ${display}`
    );
    return ExitCode.Ok;
  }

  const format = values.format ?? "markdown";
  if (format !== "markdown" && format !== "json") throw usageError("--format must be markdown or json");
  if (values["out-dir"] !== undefined || values["write-model"])
    throw usageError(`${command} takes no --out-dir or --write-model`);
  const blueprintDir = values.blueprint ?? "architecture-blueprint";
  if (!inside(cwd, blueprintDir) && !isAbsolute(blueprintDir))
    throw usageError("--blueprint must be inside --cwd or absolute");
  const report = checkBlueprint({
    cwd,
    blueprintDir,
    ...(values.graph !== undefined ? { graphPath: fromCwd(values.graph) } : {}),
    ...(values["product-check"] !== undefined ? { productCheckPath: fromCwd(values["product-check"]) } : {}),
    architectureConfigPath: fromCwd(values["architecture-config"]),
    policy: command === "check",
    ...(io.now ? { now: io.now } : {}),
  });
  const rendered =
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : renderDriftMarkdown(report, { branding });
  if (values.output !== undefined) writeOutput(resolve(io.cwd, values.output), rendered);
  else io.stdout(rendered);
  log(
    `blueprint ${report.result}: ${report.evidence.changed} changed, ${report.evidence.missing} missing of ${report.evidence.total} evidence record(s)` +
      (report.policy.evaluated ? `, policy ${report.policy.result}` : "")
  );
  return report.policy.result === "fail" ? ExitCode.Policy : ExitCode.Ok;
}

/** Runs the CLI and returns the process exit code. Never throws. */
export async function run(argv: string[], io: CliIO): Promise<number> {
  failOpen = false;
  try {
    return await main(argv, io);
  } catch (error) {
    if (error instanceof BlueprintCheckError) {
      io.stderr(`blueprint-check: error: ${error.message}\n`);
      if (error.hint) io.stderr(`blueprint-check: hint: ${error.hint}\n`);
      if (failOpen && error.exitCode === ExitCode.Input) {
        io.stderr("blueprint-check: warning: --on-error pass: continuing with exit 0\n");
        return ExitCode.Ok;
      }
      return error.exitCode;
    }
    // Errors from Architecture Check keep their documented exit code (for example 3 for unreadable inputs).
    const code = (error as { exitCode?: unknown })?.exitCode;
    io.stderr(
      `blueprint-check: ${typeof code === "number" ? "error" : "internal error"}: ${(error as Error)?.message ?? String(error)}\n`
    );
    if (failOpen) {
      io.stderr("blueprint-check: warning: --on-error pass: continuing with exit 0\n");
      return ExitCode.Ok;
    }
    return typeof code === "number" && code >= 1 && code <= 3 ? code : ExitCode.Internal;
  }
}
