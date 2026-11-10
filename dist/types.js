// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Blueprint types. The four JSON files of a blueprint (architecture-model.json, evidence-register.json,
 * coverage-ledger.json, validation-report.json) and the drift report of `check` are direct serializations of these
 * types (schema/blueprint-check.schema.json, schema 1.0). Markdown, Mermaid and DSL outputs are renderings of them.
 */
/** Schema version of every JSON document Blueprint Check writes. */
export const SCHEMA_VERSION = "1.0";
