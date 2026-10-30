// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * GitHub Action runner: inputs from INPUT_* variables, outputs, job summary, fail-open and fail-closed behaviour.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAction } from "../src/action/run.js";
import { demoRepo } from "./helpers.js";

function action(
  workspace: string,
  inputs: Record<string, string>
): { code: number; outputs: string; summary: string; log: string } {
  const outputs = join(workspace, "outputs.txt");
  const summary = join(workspace, "summary.md");
  writeFileSync(outputs, "");
  writeFileSync(summary, "");
  let log = "";
  const env: Record<string, string> = {
    GITHUB_WORKSPACE: workspace,
    GITHUB_OUTPUT: outputs,
    GITHUB_STEP_SUMMARY: summary,
  };
  for (const [k, v] of Object.entries(inputs)) env[`INPUT_${k}`] = v;
  const code = runAction({ env, log: (t) => (log += `${t}\n`) });
  return { code, outputs: readFileSync(outputs, "utf8"), summary: readFileSync(summary, "utf8"), log };
}

describe("GitHub Action", () => {
  it("generate writes the blueprint, outputs and job summary", () => {
    const dir = demoRepo();
    const r = action(dir, { GRAPH: "graph.json", PRODUCT_CHECK: "product-results.json" });
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, "architecture-blueprint", "ARCHITECTURE_BLUEPRINT.md"))).toBe(true);
    expect(r.outputs).toContain("overall-status=PROVISIONAL");
    expect(r.outputs).toContain("result=generated");
    expect(r.summary).toContain("# Architecture blueprint: shop");
  });

  it("check reports current, then stale; fail-on-stale decides the exit code", () => {
    const dir = demoRepo();
    expect(action(dir, { GRAPH: "graph.json" }).code).toBe(0);
    const current = action(dir, { MODE: "check", OUTPUT_DIR: "drift" });
    expect(current.outputs).toContain("result=current");
    const file = join(dir, "api", "src", "payments", "stripe.ts");
    writeFileSync(file, `// moved\n${readFileSync(file, "utf8")}`);
    const soft = action(dir, { MODE: "check", OUTPUT_DIR: "drift" });
    expect(soft.code).toBe(0);
    expect(soft.log).toContain("::warning::");
    expect(existsSync(join(dir, "drift", "blueprint-drift.json"))).toBe(true);
    const hard = action(dir, { MODE: "check", OUTPUT_DIR: "drift", FAIL_ON_STALE: "true" });
    expect(hard.code).toBe(4);
    expect(hard.log).toContain("::error::");
  });

  it("rejects bad inputs (exit 2) and fails open on tool errors by default", () => {
    const dir = demoRepo();
    expect(action(dir, { MODE: "publish" }).code).toBe(2);
    expect(action(dir, { OUTPUT_DIR: "../x" }).code).toBe(2);
    expect(action(dir, { ON_ERROR: "never" }).code).toBe(2);
    expect(action(dir, { FAIL_ON_STALE: "yes" }).code).toBe(2);
    const open = action(dir, { MODE: "check", BLUEPRINT: "missing" });
    expect(open.code).toBe(0);
    expect(open.outputs).toContain("status=error");
    expect(action(dir, { MODE: "check", BLUEPRINT: "missing", ON_ERROR: "fail" }).code).toBe(3);
  });
});
