// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * The blueprint package as files, and writing it. Only the output directory is touched: stale `diagrams/D*.mmd`
 * files from an earlier run are removed so the folder always matches the model.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { usageError } from "../errors.js";
import type { Blueprint } from "../types.js";
import { renderDossier, renderOpenQuestions, renderReadme, type MarkdownOptions } from "./markdown.js";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Every file of the package, keyed by path relative to the output directory. */
export function blueprintFiles(bp: Blueprint, options: MarkdownOptions): Record<string, string> {
  const files: Record<string, string> = {
    "README.md": renderReadme(bp, options),
    "ARCHITECTURE_BLUEPRINT.md": renderDossier(bp, options),
    "OPEN_QUESTIONS.md": renderOpenQuestions(bp, options),
    "architecture-model.json": json(bp.model),
    "evidence-register.json": json(bp.evidence),
    "coverage-ledger.json": json(bp.coverage),
    "validation-report.json": json(bp.validation),
    "workspace.dsl": bp.dsl,
  };
  for (const d of bp.diagrams) files[d.artifact_path] = d.mermaid;
  return files;
}

/** Writes the package to `outDir`; returns the written paths (relative to `outDir`). */
export function writeBlueprint(bp: Blueprint, outDir: string, options: MarkdownOptions): string[] {
  if (existsSync(outDir) && !lstatSync(outDir).isDirectory())
    throw usageError(`Output path exists and is not a directory: ${outDir}`);
  const diagramsDir = join(outDir, "diagrams");
  if (existsSync(diagramsDir) && lstatSync(diagramsDir).isDirectory())
    for (const name of readdirSync(diagramsDir))
      if (/^D[0-9A-Za-z-]+\.mmd$/.test(name)) rmSync(join(diagramsDir, name), { force: true });
  const files = blueprintFiles(bp, options);
  for (const [path, content] of Object.entries(files)) {
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return Object.keys(files).sort();
}
