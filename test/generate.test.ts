// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * generate: model contents, evidence, catalog, coverage, determinism, schema validity and the inputs' effects.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { generate } from "../src/generate.js";
import { lintMermaid } from "../src/render/mermaid.js";
import type { ArchitectureModel, CoverageLedger, EvidenceRegister, ValidationReport } from "../src/types.js";
import { cli, demoRepo, NOW, readBlueprintJson, tempRepo, tree } from "./helpers.js";

const schema = JSON.parse(
  readFileSync(new URL("../schema/blueprint-check.schema.json", import.meta.url), "utf8")
) as object;
const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const validate = ajv.compile(schema);

describe("generate on the demo repository", () => {
  it("derives containers, components, stores, externals and relationships with evidence", () => {
    const bp = generate({ cwd: demoRepo(), graphPath: "graph.json", now: NOW });
    const m = bp.model;
    expect(m.system_name).toBe("shop");
    expect(m.overall_status).toBe("PROVISIONAL");
    expect(m.components.map((c) => [c.id, c.name, c.kind])).toEqual([
      ["C01", "api", "container"],
      ["C02", "@shop/shared", "container"],
      ["C03", "web", "container"],
      ["C04", "orders", "component"],
      ["C05", "payments", "component"],
      ["C06", "cart", "component"],
      ["X01", "Stripe", "external_system"],
    ]);
    expect(m.components.find((c) => c.id === "C04")?.parent_id).toBe("C01");
    expect(m.data_stores.map((s) => [s.id, s.name, s.technology_if_proven])).toEqual([
      ["DS01", "db", "PostgreSQL"],
    ]);
    expect(m.relationships).toHaveLength(6);
    expect(m.components.find((c) => c.id === "X01")?.confidence).toBe("CORROBORATED");
    for (const claim of [...m.components, ...m.relationships, ...m.data_stores])
      expect(claim.evidence_ids.length, claim.id).toBeGreaterThan(0);
    const ids = new Set(bp.evidence.evidence.map((e) => e.evidence_id));
    for (const claim of [...m.components, ...m.relationships])
      for (const e of claim.evidence_ids) expect(ids.has(e)).toBe(true);
    expect(
      bp.evidence.evidence
        .filter((e) => e.line_start !== null)
        .every((e) => /^[0-9a-f]{64}$/.test(e.excerpt_sha256 ?? ""))
    ).toBe(true);
    expect(bp.evidence.evidence.every((e) => e.supports_claim_ids.length > 0)).toBe(true);
  });

  it("assesses all 19 catalog views and never fills judgment views", () => {
    const bp = generate({ cwd: demoRepo(), graphPath: "graph.json", now: NOW });
    const status = Object.fromEntries(bp.model.catalog.map((c) => [c.catalog_id, c.status]));
    expect(Object.keys(status)).toHaveLength(19);
    expect(status).toMatchObject({
      D00: "produced",
      D01: "produced",
      D02: "produced",
      D05: "produced",
      D07: "produced",
      D10: "produced",
      D11: "produced",
    });
    for (const id of ["D03", "D08", "D12", "D13", "D14", "D15", "D16", "D18"])
      expect(status[id]).toBe("blocked");
    expect(status["D17"]).toBe("not_applicable");
    expect(bp.model.journeys).toEqual([]);
    expect(bp.model.gaps.map((g) => g.code)).toEqual(
      expect.arrayContaining(["journeys-not-derived", "trust-enforcement-not-traced", "no-product-surface"])
    );
    for (const d of bp.diagrams) expect(lintMermaid(d.mermaid), d.id).toEqual([]);
  });

  it("computes coverage from the ledger and reports zero denominators as n/a", () => {
    const bp = generate({ cwd: demoRepo(), graphPath: "graph.json", now: NOW });
    const metric = Object.fromEntries(bp.coverage.metrics.map((m) => [m.name, m]));
    expect(metric["architectural_unit_inspection"]).toMatchObject({ numerator: 3, denominator: 4 });
    expect(metric["component_representation"]?.percent).toBe(100);
    expect(metric["critical_journey_tracing"]).toMatchObject({ denominator: 0, percent: null });
    expect(metric["diagram_parser_validation"]?.percent).toBeNull();
    expect(bp.validation.gates.map((g) => g.id)).toEqual([
      "V01",
      "V02",
      "V03",
      "V04",
      "V05",
      "V06",
      "V07",
      "V08",
      "V09",
      "V10",
      "V11",
      "V12",
      "V13",
    ]);
    expect(bp.validation.gates.filter((g) => g.status === "fail")).toEqual([]);
  });

  it("is deterministic apart from generated_at", () => {
    const dir = demoRepo();
    const a = generate({ cwd: dir, graphPath: "graph.json", now: NOW });
    const b = generate({
      cwd: dir,
      graphPath: "graph.json",
      now: () => new Date("2027-01-01T00:00:00.000Z"),
    });
    expect({ ...b.model, generated_at: a.model.generated_at }).toEqual(a.model);
    expect(b.evidence).toEqual(a.evidence);
    expect(b.diagrams).toEqual(a.diagrams);
  });

  it("writes schema-valid JSON documents, Markdown, Mermaid and the Structurizr model", async () => {
    const dir = demoRepo();
    const result = await cli(["generate", "--graph", "graph.json"], dir);
    expect(result.code).toBe(0);
    expect(result.stderr).toMatch(/PROVISIONAL: 8 element\(s\)|PROVISIONAL: 7 element\(s\)/);
    expect(tree(join(dir, "architecture-blueprint"))).toEqual([
      "ARCHITECTURE_BLUEPRINT.md",
      "OPEN_QUESTIONS.md",
      "README.md",
      "architecture-model.json",
      "coverage-ledger.json",
      "diagrams/D00.mmd",
      "diagrams/D01.mmd",
      "diagrams/D02.mmd",
      "diagrams/D04.mmd",
      "diagrams/D05.mmd",
      "diagrams/D07.mmd",
      "diagrams/D09.mmd",
      "diagrams/D10.mmd",
      "diagrams/D11-C01.mmd",
      "diagrams/D11-C03.mmd",
      "evidence-register.json",
      "validation-report.json",
      "workspace.dsl",
    ]);
    for (const file of [
      "architecture-model.json",
      "evidence-register.json",
      "coverage-ledger.json",
      "validation-report.json",
    ]) {
      const doc = readBlueprintJson(dir, file);
      expect(validate(doc), `${file}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
    const dossier = readFileSync(join(dir, "architecture-blueprint", "ARCHITECTURE_BLUEPRINT.md"), "utf8");
    expect(dossier).toContain("```mermaid");
    expect(dossier).toContain("### D12 Critical journey sequences");
    expect(dossier).toContain("Hand-off to Architecture Check");
    const dsl = readFileSync(join(dir, "architecture-blueprint", "workspace.dsl"), "utf8");
    expect(dsl).toMatch(/^\/\/ Generated by Blueprint Check/);
    expect(dsl).toContain('workspace "');
  });

  it("without a module graph: containers only, D02 partial, gap recorded", () => {
    const bp = generate({ cwd: demoRepo(), now: NOW });
    expect(bp.model.components.some((c) => c.kind === "component")).toBe(false);
    expect(bp.model.catalog.find((c) => c.catalog_id === "D02")?.status).toBe("partial");
    expect(bp.model.catalog.find((c) => c.catalog_id === "D11")?.status).toBe("blocked");
    expect(bp.model.gaps.some((g) => g.code === "no-module-graph")).toBe(true);
    expect(bp.coverage.metrics.find((m) => m.name === "architectural_unit_inspection")?.numerator).toBe(0);
  });

  it("with Product Check results: endpoints, pages, entities, integrations and auth boundaries", () => {
    const bp = generate({
      cwd: demoRepo(),
      graphPath: "graph.json",
      productCheckPath: "product-results.json",
      now: NOW,
    });
    const m = bp.model;
    expect(m.inputs.product_check?.kind).toBe("product-check-results");
    expect(m.components[0]).toMatchObject({ id: "U01", kind: "actor" });
    // stripe merges into the Stripe external system; SendGrid is new and inferred.
    expect(
      m.components.filter((c) => c.kind === "external_system").map((c) => [c.name, c.confidence])
    ).toEqual([
      ["Stripe", "CORROBORATED"],
      ["SendGrid", "INFERRED"],
    ]);
    expect(m.contracts.map((c) => [c.kind, c.producer_ids, c.items])).toEqual([
      ["http-endpoints", ["C01"], 2],
      ["pages", ["C03"], 1],
    ]);
    expect(m.data_stores.map((s) => s.name)).toContain("Declared entities (1)");
    expect(m.relationships.filter((r) => r.source_id === "U01").map((r) => [r.target_id, r.purpose])).toEqual(
      [
        ["C01", "2 HTTP endpoints"],
        ["C03", "1 page"],
      ]
    );
    expect(m.catalog.find((c) => c.catalog_id === "D06")?.status).toBe("partial");
    expect(m.findings.map((f) => f.rule_id)).toContain("endpoints-without-auth-reference");
    expect(m.gaps.some((g) => g.code === "no-product-surface")).toBe(false);
    for (const d of bp.diagrams) expect(lintMermaid(d.mermaid), d.id).toEqual([]);
  });

  it("accepts a Product Check as-built spec and an empty results surface", () => {
    const dir = tempRepo({
      "package.json": '{"name":"tiny"}',
      "spec.json": JSON.stringify({
        schema_version: "0.1.0",
        kind: "as-built-spec",
        surface: [{ id: "S1", kind: "endpoint", name: "/x", location: { path: "package.json", line: 1 } }],
      }),
      "results.json": JSON.stringify({
        schema_version: "0.1.0",
        kind: "product-check-results",
        blueprint: { as_is: {} },
      }),
    });
    expect(
      generate({ cwd: dir, productCheckPath: "spec.json", now: NOW }).model.inputs.product_check?.kind
    ).toBe("product-check-as-built-spec");
    expect(generate({ cwd: dir, productCheckPath: "results.json", now: NOW }).model.contracts).toEqual([]);
  });

  it("refuses unknown or malformed inputs with exit 3", async () => {
    const dir = tempRepo({
      "package.json": '{"name":"tiny"}',
      "bad.json": '{"schema_version":"9.9","kind":"product-check-results"}',
      "wrongkind.json": '{"schema_version":"0.1.0","kind":"other"}',
      "malformed.json": '{"schema_version":"0.1.0","kind":"as-built-spec","surface":[{"id":1}]}',
      "notjson.json": "{",
    });
    for (const file of ["bad.json", "wrongkind.json", "malformed.json", "notjson.json", "missing.json"])
      expect((await cli(["generate", "--product-check", file, "--quiet"], dir)).code, file).toBe(3);
    expect((await cli(["generate", "--graph", "missing.json", "--quiet"], dir)).code).toBe(3);
    expect((await cli(["generate", "--architecture-config", "missing.json", "--quiet"], dir)).code).toBe(3);
  });

  it("an empty repository yields a BLOCKED blueprint, not an invented one", () => {
    const bp = generate({ cwd: tempRepo({ "README.md": "# empty\n" }), now: NOW });
    expect(bp.model.overall_status).toBe("BLOCKED");
    expect(bp.model.catalog.find((c) => c.catalog_id === "D00")?.status).toBe("partial");
    expect(bp.model.system_name).toMatch(/^blueprint-check-/);
  });

  it("typed documents carry their kinds", () => {
    const dir = demoRepo();
    const bp = generate({ cwd: dir, now: NOW });
    const kinds: [
      ArchitectureModel["kind"],
      EvidenceRegister["kind"],
      CoverageLedger["kind"],
      ValidationReport["kind"],
    ] = [bp.model.kind, bp.evidence.kind, bp.coverage.kind, bp.validation.kind];
    expect(kinds).toEqual([
      "blueprint-architecture-model",
      "blueprint-evidence-register",
      "blueprint-coverage-ledger",
      "blueprint-validation-report",
    ]);
  });
});
