// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * GitHub Action runner (docs/ACTION.md). Reads inputs from INPUT_* environment variables (never from shell
 * interpolation). `generate` writes the blueprint to output-dir; `check` compares a committed blueprint with the code
 * and writes the drift report. Both write the job summary and step outputs.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { checkBlueprint } from "../check/drift.js";
import { BlueprintCheckError, ExitCode } from "../errors.js";
import { generate } from "../generate.js";
import { writeBlueprint } from "../render/files.js";
import { renderDriftMarkdown, renderReadme } from "../render/markdown.js";

/** Environment and output seams for tests. */
export interface ActionIO {
  env: Record<string, string | undefined>;
  log: (text: string) => void;
}

/** Rejects absolute paths and `..` segments in workspace-relative inputs. */
function relativeInput(value: string, name: string): string {
  const normalized = value.trim().replace(/\\/g, "/");
  if (normalized === "" || isAbsolute(normalized) || normalized.split("/").includes(".."))
    throw new BlueprintCheckError(
      `Input ${name} must be a relative path inside the workspace`,
      ExitCode.Usage
    );
  return normalized;
}

/** Appends `name=value` to the step outputs file when available. */
function setOutput(io: ActionIO, name: string, value: string): void {
  const file = io.env["GITHUB_OUTPUT"];
  if (file) appendFileSync(file, `${name}=${value.replace(/[\r\n]/g, " ")}\n`);
}

/** Runs the action; returns the process exit code. */
export function runAction(io: ActionIO): number {
  const input = (name: string, fallback: string): string => io.env[`INPUT_${name}`]?.trim() || fallback;
  const mode = input("MODE", "generate");
  const failOnStale = input("FAIL_ON_STALE", "false") === "true";
  const onErrorInput = input("ON_ERROR", "auto");
  const failClosed = onErrorInput === "fail" || (onErrorInput === "auto" && failOnStale);
  try {
    if (!["generate", "check"].includes(mode))
      throw new BlueprintCheckError("Input mode must be generate or check", ExitCode.Usage);
    if (!["auto", "fail", "warn"].includes(onErrorInput))
      throw new BlueprintCheckError("Input on-error must be auto, fail or warn", ExitCode.Usage);
    if (!["true", "false"].includes(input("FAIL_ON_STALE", "false")))
      throw new BlueprintCheckError("Input fail-on-stale must be true or false", ExitCode.Usage);
    const workspace = io.env["GITHUB_WORKSPACE"] ?? process.cwd();
    const cwd = resolve(workspace, relativeInput(input("WORKING_DIRECTORY", "."), "working-directory"));
    const optional = (name: string, label: string): string | null => {
      const value = input(name, "");
      return value === "" ? null : join(cwd, relativeInput(value, label));
    };
    const rel = relativeInput(input("OUTPUT_DIR", "architecture-blueprint"), "output-dir");
    const summary = io.env["GITHUB_STEP_SUMMARY"];

    if (mode === "generate") {
      const bp = generate({
        cwd,
        graphPath: optional("GRAPH", "graph"),
        productCheckPath: optional("PRODUCT_CHECK", "product-check"),
      });
      const outDir = resolve(workspace, rel);
      mkdirSync(outDir, { recursive: true });
      writeBlueprint(bp, outDir, { branding: true });
      if (summary) appendFileSync(summary, renderReadme(bp, { branding: true }));
      setOutput(io, "blueprint-dir", rel);
      setOutput(io, "overall-status", bp.model.overall_status);
      setOutput(io, "result", "generated");
      setOutput(io, "status", "ok");
      io.log(`blueprint-check: ${bp.model.overall_status}, ${bp.diagrams.length} view(s) in ${rel}`);
      return ExitCode.Ok;
    }

    const report = checkBlueprint({
      cwd,
      blueprintDir: relativeInput(input("BLUEPRINT", "architecture-blueprint"), "blueprint"),
      ...(input("GRAPH", "") !== "" ? { graphPath: optional("GRAPH", "graph") } : {}),
      ...(input("PRODUCT_CHECK", "") !== ""
        ? { productCheckPath: optional("PRODUCT_CHECK", "product-check") }
        : {}),
      policy: true,
    });
    const outDir = resolve(workspace, rel);
    mkdirSync(outDir, { recursive: true });
    const markdown = renderDriftMarkdown(report, { branding: true });
    writeFileSync(join(outDir, "blueprint-drift.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(outDir, "blueprint-drift.md"), markdown);
    if (summary) appendFileSync(summary, markdown);
    setOutput(io, "blueprint-dir", rel);
    setOutput(io, "result", report.result);
    setOutput(io, "status", "ok");
    io.log(`blueprint-check: blueprint ${report.result}`);
    if (report.result === "stale") {
      io.log(
        `::${failOnStale ? "error" : "warning"}::The architecture blueprint is stale; regenerate it with blueprint-check generate`
      );
      return failOnStale ? ExitCode.Policy : ExitCode.Ok;
    }
    return ExitCode.Ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const usage = error instanceof BlueprintCheckError && error.exitCode === ExitCode.Usage;
    setOutput(io, "status", "error");
    if (usage || failClosed) {
      io.log(`::error::Blueprint Check failed: ${message.replace(/[\r\n]/g, " ")}`);
      return error instanceof BlueprintCheckError ? error.exitCode : ExitCode.Internal;
    }
    io.log(
      `::warning::Blueprint Check could not run (fail-open, on-error=${onErrorInput}): ${message.replace(/[\r\n]/g, " ")}`
    );
    return ExitCode.Ok;
  }
}
