// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * drift and check: evidence staleness, model drift, policy and exit codes, schema validity of the drift report.
 */
import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import type { DriftReport } from "../src/types.js";
import { cli, demoRepo, tempRepo } from "./helpers.js";

const schema = JSON.parse(
  readFileSync(new URL("../schema/blueprint-check.schema.json", import.meta.url), "utf8")
) as object;
const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const validate = ajv.compile(schema);

async function generated(): Promise<string> {
  const dir = demoRepo();
  expect((await cli(["generate", "--graph", "graph.json", "--quiet"], dir)).code).toBe(0);
  return dir;
}

async function drift(
  dir: string,
  command: "drift" | "check" = "drift"
): Promise<{ code: number; report: DriftReport }> {
  const result = await cli([command, "--format", "json", "--quiet"], dir);
  return { code: result.code, report: JSON.parse(result.stdout) as DriftReport };
}

describe("drift and check", () => {
  it("a fresh blueprint is current (exit 0) and the report is schema-valid", async () => {
    const dir = await generated();
    const { code, report } = await drift(dir, "check");
    expect(code).toBe(0);
    expect(report.result).toBe("current");
    expect(report.policy).toEqual({ evaluated: true, result: "pass" });
    expect(report.evidence.unchanged).toBe(report.evidence.total);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  });

  it("an edited cited line makes it stale: drift exits 0, check exits 4", async () => {
    const dir = await generated();
    const file = join(dir, "api", "src", "payments", "stripe.ts");
    writeFileSync(file, `// moved\n${readFileSync(file, "utf8")}`);
    const soft = await drift(dir, "drift");
    expect(soft.code).toBe(0);
    expect(soft.report.result).toBe("stale");
    expect(soft.report.policy.evaluated).toBe(false);
    expect(soft.report.evidence.items.map((i) => [i.path, i.state])).toContainEqual([
      "api/src/payments/stripe.ts",
      "changed",
    ]);
    const hard = await cli(["check", "--quiet"], dir);
    expect(hard.code).toBe(4);
    expect(hard.stdout).toContain("**stale**");
  });

  it("a deleted file is reported missing", async () => {
    const dir = await generated();
    rmSync(join(dir, "api", "src", "payments", "stripe.ts"));
    const { report } = await drift(dir);
    expect(report.evidence.missing).toBeGreaterThan(0);
  });

  it("a new compose service is reported as an added component", async () => {
    const dir = await generated();
    appendFileSync(join(dir, "docker-compose.yml"), "  cache:\n    image: redis:7\n");
    const { report } = await drift(dir);
    expect(report.result).toBe("stale");
    expect(report.model.added_components.length + report.model.added_relationships.length).toBeGreaterThan(0);
  });

  it("an unchanged repository after unrelated edits stays current", async () => {
    const dir = await generated();
    writeFileSync(join(dir, "NOTES.md"), "unrelated\n");
    expect((await drift(dir)).report.result).toBe("current");
  });

  it("missing or foreign blueprint files are input errors (exit 3)", async () => {
    expect((await cli(["check", "--quiet"], tempRepo({ "a.txt": "x" }))).code).toBe(3);
    const dir = tempRepo({
      "architecture-blueprint/architecture-model.json": '{"kind":"other"}',
      "architecture-blueprint/evidence-register.json": "{}",
    });
    expect((await cli(["check", "--quiet"], dir)).code).toBe(3);
  });

  it("--output writes the report; --on-error pass turns input errors into exit 0", async () => {
    const dir = await generated();
    const result = await cli(["drift", "--output", "drift.md", "--quiet"], dir);
    expect(result.code).toBe(0);
    expect(readFileSync(join(dir, "drift.md"), "utf8")).toContain("Blueprint Check: drift");
    expect((await cli(["check", "--on-error", "pass", "--quiet"], tempRepo({ "a.txt": "x" }))).code).toBe(0);
  });
});
