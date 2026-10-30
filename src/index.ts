// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Library entry point: generation, writing, drift checks, renderers and the Mermaid lint.
 */
export { generate, type GenerateOptions } from "./generate.js";
export { checkBlueprint, type CheckOptions } from "./check/drift.js";
export { blueprintFiles, writeBlueprint } from "./render/files.js";
export { renderDossier, renderDriftMarkdown, renderOpenQuestions, renderReadme } from "./render/markdown.js";
export { lintMermaid } from "./render/mermaid.js";
export { CATALOG } from "./model/assess.js";
export { BlueprintCheckError, ExitCode } from "./errors.js";
export { run as runCli, DECLARED_MODEL_PATHS } from "./cli/run.js";
export type * from "./types.js";
export { SCHEMA_VERSION } from "./types.js";
export { TOOL_VERSION } from "./version.js";
