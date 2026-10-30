// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Mermaid views of the model (docs/SPEC.md §4). Node ids are generated (`n_<model id>`), never copied from the
 * repository; every label is redacted, made single-line and entity-encoded, so repository names cannot inject Mermaid
 * syntax or HTML. Views stay within a node budget; omitted nodes are counted and named in the dossier.
 */
import type { CoreModel } from "../model/build.js";
import { redact } from "../redact.js";
import type { Component, Diagram, Relationship } from "../types.js";
import { visible } from "./escape.js";

/** Most nodes drawn in one view (the master prompt splits views above 20-25). */
export const NODE_BUDGET = 22;
/** Most component detail views (D11) generated. */
export const MAX_DETAIL_VIEWS = 10;

const LEGEND =
  'LEGEND["Legend: arrow = derived relationship | label prefix INFERRED = heuristic | cylinder = data store | hexagon = contract"]';

/** Encodes a repository-derived string for use inside a quoted Mermaid label. */
export function label(text: string, max = 80): string {
  let out = visible(redact(text)).replace(/\s+/g, " ").trim();
  if (out.length > max) out = `${out.slice(0, max - 1)}…`;
  return out
    .replace(/&/g, "#amp;")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .replace(/\|/g, "#124;")
    .replace(/[[\]{}]/g, (ch) => `#${ch.charCodeAt(0)};`);
}

const nid = (id: string): string => `n_${id.replace(/[^A-Za-z0-9]/g, "_")}`;

/** Node declaration with a shape by element type. */
function node(id: string, text: string, shape: "box" | "store" | "contract" | "actor" | "external"): string {
  const t = `"${label(text)}"`;
  if (shape === "store") return `${nid(id)}[(${t})]`;
  if (shape === "contract") return `${nid(id)}{{${t}}}`;
  if (shape === "actor") return `${nid(id)}([${t}])`;
  if (shape === "external") return `${nid(id)}[/${t}/]`;
  return `${nid(id)}[${t}]`;
}

/** Edge with a label; heuristic edges say so in text, not only in style. */
function edge(rel: { source_id: string; target_id: string; purpose: string; confidence: string }): string {
  const prefix = rel.confidence === "INFERRED" ? "INFERRED: " : "";
  return `${nid(rel.source_id)} -->|"${label(prefix + rel.purpose, 60)}"| ${nid(rel.target_id)}`;
}

/** Label of a component node: id, name and technology. */
const title = (c: Component): string => `${c.id} ${c.name}${c.technology ? ` (${c.technology})` : ""}`;

/** Ranks ids by relationship degree (most connected first), then id, and keeps `budget` of them. */
function budget(
  ids: string[],
  rels: Relationship[],
  limit = NODE_BUDGET
): { kept: Set<string>; omitted: number } {
  const degree = new Map<string, number>();
  for (const r of rels) {
    degree.set(r.source_id, (degree.get(r.source_id) ?? 0) + 1);
    degree.set(r.target_id, (degree.get(r.target_id) ?? 0) + 1);
  }
  const sorted = [...ids].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || (a < b ? -1 : 1));
  return { kept: new Set(sorted.slice(0, limit)), omitted: Math.max(0, sorted.length - limit) };
}

/** Lifts component-level relationships to their top-level parents, dropping self-loops and duplicates. */
function lift(model: CoreModel): Relationship[] {
  const top = (id: string): string => {
    let current = model.components.find((c) => c.id === id);
    while (current?.parent_id) current = model.components.find((c) => c.id === current?.parent_id);
    return current?.id ?? id;
  };
  const seen = new Map<string, Relationship>();
  for (const r of model.relationships) {
    const source = top(r.source_id);
    const target = top(r.target_id);
    if (source === target) continue;
    const key = `${source}>${target}`;
    const prior = seen.get(key);
    if (prior) {
      if (!prior.purpose.split(", ").includes(r.purpose)) prior.purpose = `${prior.purpose}, ${r.purpose}`;
      if (r.confidence === "CONFIRMED") prior.confidence = "CONFIRMED";
      prior.evidence_ids = [...new Set([...prior.evidence_ids, ...r.evidence_ids])];
      continue;
    }
    seen.set(key, { ...r, source_id: source, target_id: target, evidence_ids: [...r.evidence_ids] });
  }
  return [...seen.values()];
}

/** Shared assembly: header, nodes, edges, legend; returns the Diagram. */
function view(
  id: string,
  catalog: string,
  titleText: string,
  header: string,
  body: string[],
  componentIds: string[],
  rels: Relationship[],
  omitted: number
): Diagram {
  const lines = [header, ...body.map((l) => `    ${l}`)];
  if (omitted > 0) lines.push(`    MORE["${omitted} more elements: see architecture-model.json"]`);
  lines.push(`    ${LEGEND}`);
  return {
    id,
    catalog_id: catalog,
    title: titleText,
    status: "produced",
    component_ids: [...new Set(componentIds)].sort(),
    relationship_ids: [...new Set(rels.map((r) => r.id))].sort(),
    artifact_path: `diagrams/${id}.mmd`,
    mermaid: `${lines.join("\n")}\n`,
    omitted_nodes: omitted,
  };
}

/** Builds every view the evidence supports. */
export function buildDiagrams(model: CoreModel): Diagram[] {
  const comps = model.components;
  const containers = comps.filter((c) => c.kind === "container");
  const externals = comps.filter((c) => c.kind === "external_system");
  const actors = comps.filter((c) => c.kind === "actor");
  const stores = model.data_stores;
  const lifted = lift(model);
  const diagrams: Diagram[] = [];
  const shapeOf = (id: string): "box" | "store" | "actor" | "external" =>
    stores.some((s) => s.id === id)
      ? "store"
      : actors.some((a) => a.id === id)
        ? "actor"
        : externals.some((e) => e.id === id)
          ? "external"
          : "box";
  const nameOf = (id: string): string => {
    const c = comps.find((k) => k.id === id);
    if (c) return title(c);
    const s = stores.find((k) => k.id === id);
    return s ? `${s.id} ${s.name}${s.technology_if_proven ? ` (${s.technology_if_proven})` : ""}` : id;
  };

  // D00 master blueprint: actor, the system boundary with containers and stores, externals outside.
  {
    const inner = [...containers.map((c) => c.id), ...stores.map((s) => s.id)];
    const outer = [...actors.map((a) => a.id), ...externals.map((e) => e.id)];
    const rels = lifted.filter(
      (r) => [...inner, ...outer].includes(r.source_id) && [...inner, ...outer].includes(r.target_id)
    );
    const { kept, omitted } = budget([...inner, ...outer], rels);
    const body = [
      ...outer.filter((i) => kept.has(i)).map((i) => node(i, nameOf(i), shapeOf(i))),
      `subgraph SYS["System boundary: ${label(model.repository.label)}"]`,
      ...inner.filter((i) => kept.has(i)).map((i) => `    ${node(i, nameOf(i), shapeOf(i))}`),
      ...(inner.length === 0 ? ['    EMPTY["No containers derived"]'] : []),
      "end",
      ...rels.filter((r) => kept.has(r.source_id) && kept.has(r.target_id)).map(edge),
    ];
    diagrams.push(
      view(
        "D00",
        "D00",
        "Master software blueprint",
        "flowchart TB",
        body,
        [...kept],
        rels.filter((r) => kept.has(r.source_id) && kept.has(r.target_id)),
        omitted
      )
    );
  }

  // D01 repository and deployable map: containers grouped by how they are declared.
  {
    const group = (c: Component): string => {
      const o = c.origins.join(" ");
      if (/compose/.test(o)) return "Compose services";
      if (/kubernetes|k8s/.test(o)) return "Kubernetes workloads";
      if (/dockerfile/i.test(o)) return "Dockerfile images";
      return "Packages and source directories";
    };
    const groups = new Map<string, Component[]>();
    for (const c of containers) groups.set(group(c), [...(groups.get(group(c)) ?? []), c]);
    const { kept, omitted } = budget(
      containers.map((c) => c.id),
      lifted
    );
    const body = [
      `subgraph R1["Repository R1: ${label(model.repository.label)}${model.repository.actual_ref ? ` @${model.repository.actual_ref.slice(0, 7)}` : ""}"]`,
    ];
    let gi = 0;
    for (const [name, members] of [...groups.entries()].sort()) {
      body.push(`    subgraph G${++gi}["Deployable boundary: ${label(name)}"]`);
      for (const c of members.filter((m) => kept.has(m.id)))
        body.push(
          `        ${node(c.id, `${title(c)}${c.implementation_paths[0] ? ` at ${c.implementation_paths[0]}` : ""}`, "box")}`
        );
      body.push("    end");
    }
    if (containers.length === 0) body.push('    EMPTY["No containers derived"]');
    body.push("end");
    const rels = lifted.filter((r) => kept.has(r.source_id) && kept.has(r.target_id));
    body.push(...rels.map(edge));
    diagrams.push(
      view("D01", "D01", "Repository and deployable map", "flowchart TB", body, [...kept], rels, omitted)
    );
  }

  // D02 application floor plan: containers with their source components.
  {
    const children = (id: string): Component[] => comps.filter((c) => c.parent_id === id);
    const ids = [
      ...containers.map((c) => c.id),
      ...containers.flatMap((c) => children(c.id).map((k) => k.id)),
      ...stores.map((s) => s.id),
    ];
    const rels = model.relationships.filter((r) => ids.includes(r.source_id) && ids.includes(r.target_id));
    const { kept, omitted } = budget(ids, rels);
    const body: string[] = [];
    for (const c of containers.filter(
      (k) => kept.has(k.id) || children(k.id).some((ch) => kept.has(ch.id))
    )) {
      const kids = children(c.id).filter((k) => kept.has(k.id));
      if (kids.length === 0) {
        body.push(node(c.id, title(c), "box"));
        continue;
      }
      body.push(`subgraph ${nid(c.id)}["Container: ${label(title(c))}"]`);
      for (const k of kids) body.push(`    ${node(k.id, title(k), "box")}`);
      body.push("end");
    }
    for (const s of stores.filter((k) => kept.has(k.id))) body.push(node(s.id, nameOf(s.id), "store"));
    const drawn = rels.filter((r) => kept.has(r.source_id) && kept.has(r.target_id));
    body.push(...drawn.map(edge));
    if (body.length === 0) body.push('EMPTY["No containers derived"]');
    diagrams.push(
      view("D02", "D02", "Application floor plan", "flowchart TB", body, [...kept], drawn, omitted)
    );
  }

  // D04 data plumbing: edges that touch stores or external systems.
  {
    const ends = new Set([...stores.map((s) => s.id), ...externals.map((e) => e.id)]);
    const rels = lifted.filter((r) => ends.has(r.source_id) || ends.has(r.target_id));
    for (const s of stores)
      for (const reader of s.readers)
        if (!rels.some((r) => r.source_id === reader && r.target_id === s.id))
          rels.push({
            id: "",
            key: "",
            source_id: reader,
            target_id: s.id,
            relationship_type: "reads",
            purpose: "declares or reads",
            sync_or_async: "unknown",
            contract_ids: [],
            confidence: "INFERRED",
            evidence_ids: s.evidence_ids,
            unresolved_questions: [],
          });
    const ids = [
      ...new Set([...rels.flatMap((r) => [r.source_id, r.target_id]), ...stores.map((s) => s.id)]),
    ];
    if (ids.length > 0) {
      const { kept, omitted } = budget(ids, rels);
      const body = [
        ...ids.filter((i) => kept.has(i)).map((i) => node(i, nameOf(i), shapeOf(i))),
        ...rels.filter((r) => kept.has(r.source_id) && kept.has(r.target_id)).map(edge),
      ];
      diagrams.push(
        view(
          "D04",
          "D04",
          "Data plumbing",
          "flowchart LR",
          body,
          [...kept],
          rels.filter((r) => r.id !== ""),
          omitted
        )
      );
    }
  }

  // D05 API and event wiring: top-level relationships plus contracts and their producers.
  {
    const ids = [...actors, ...containers, ...externals].map((c) => c.id).concat(stores.map((s) => s.id));
    const rels = lifted.filter((r) => ids.includes(r.source_id) && ids.includes(r.target_id));
    const { kept, omitted } = budget(ids, rels, NODE_BUDGET - Math.min(model.contracts.length, 8));
    const body = ids.filter((i) => kept.has(i)).map((i) => node(i, nameOf(i), shapeOf(i)));
    const shownContracts = model.contracts.slice(0, 8);
    for (const ct of shownContracts) {
      body.push(
        node(
          ct.id,
          `${ct.id} ${ct.kind}${ct.version_if_proven ? ` ${ct.version_if_proven}` : ""}: ${ct.items > 1 ? `${ct.items} items` : (ct.definition_paths[0] ?? "")}`,
          "contract"
        )
      );
      for (const p of ct.producer_ids.filter((i) => kept.has(i)))
        body.push(`${nid(p)} -.->|"provides"| ${nid(ct.id)}`);
    }
    body.push(...rels.filter((r) => kept.has(r.source_id) && kept.has(r.target_id)).map(edge));
    diagrams.push(
      view(
        "D05",
        "D05",
        "API and event wiring",
        "flowchart TB",
        body,
        [...kept, ...shownContracts.map((c) => c.id)],
        rels.filter((r) => kept.has(r.source_id) && kept.has(r.target_id)),
        omitted + Math.max(0, model.contracts.length - 8)
      )
    );
  }

  // D06 trust view (partial): auth boundaries found in the surface, by container.
  if (model.authBoundaries.size > 0) {
    const body: string[] = [];
    if (actors[0]) body.push(node(actors[0].id, title(actors[0]), "actor"));
    body.push('subgraph TB1["Trust boundary: deployed system (enforcement not traced)"]');
    let i = 0;
    for (const [owner, count] of [...model.authBoundaries.entries()].sort()) {
      const auth = `AUTH${++i}`;
      if (owner) body.push(`    ${node(owner, nameOf(owner), "box")}`);
      body.push(`    ${auth}{"${label(`${count} auth boundar${count === 1 ? "y" : "ies"} in source`)}"}`);
      if (owner) body.push(`    ${auth} --> ${nid(owner)}`);
      if (actors[0]) body.push(`    ${nid(actors[0].id)} -->|"request"| ${auth}`);
    }
    body.push("end");
    const d = view(
      "D06",
      "D06",
      "Authentication and security flow (partial)",
      "flowchart TB",
      body,
      [...model.authBoundaries.keys()].filter((k) => k !== ""),
      [],
      0
    );
    d.status = "partial";
    diagrams.push(d);
  }

  // D07 storage blueprint.
  if (stores.length > 0) {
    const body = [
      'subgraph STORES["Data stores found in inspected scope"]',
      ...stores.map(
        (s) =>
          `    ${node(s.id, `${nameOf(s.id)}${s.schema_paths.length ? `, ${s.schema_paths.length} schema files` : ""}`, "store")}`
      ),
      "end",
    ];
    diagrams.push(
      view(
        "D07",
        "D07",
        "Database and storage blueprint",
        "flowchart TB",
        body,
        stores.map((s) => s.id),
        [],
        0
      )
    );
  }

  // D09 site plan: the system in the middle, externals and actors around it.
  if (externals.length > 0 || actors.length > 0) {
    const rels = lifted.filter((r) =>
      [...externals, ...actors].some((e) => e.id === r.source_id || e.id === r.target_id)
    );
    const { kept, omitted } = budget(
      [...actors, ...externals].map((e) => e.id),
      rels
    );
    const body = [`SYSTEM["${label(model.repository.label)}: ${containers.length} containers"]`];
    for (const e of [...actors, ...externals].filter((k) => kept.has(k.id))) {
      body.push(node(e.id, title(e), e.kind === "actor" ? "actor" : "external"));
      const purposes = [
        ...new Set(
          rels
            .filter((r) => r.source_id === e.id || r.target_id === e.id)
            .map((r) => (r.confidence === "INFERRED" ? `INFERRED: ${r.purpose}` : r.purpose))
        ),
      ];
      const text = label(purposes.join(", ") || "referenced", 60);
      body.push(
        e.kind === "actor" ? `${nid(e.id)} -->|"${text}"| SYSTEM` : `SYSTEM -->|"${text}"| ${nid(e.id)}`
      );
    }
    diagrams.push(
      view("D09", "D09", "External integrations site plan", "flowchart LR", body, [...kept], rels, omitted)
    );
  }

  // D10 deployment and runtime: containers by deployment descriptor.
  {
    const declared = containers.filter(
      (c) => c.descriptors.length > 0 || /compose|kubernetes|dockerfile/i.test(c.origins.join(" "))
    );
    if (declared.length > 0) {
      const { kept, omitted } = budget(
        declared.map((c) => c.id),
        lifted
      );
      const files = new Map<string, Component[]>();
      for (const c of declared.filter((k) => kept.has(k.id))) {
        const where = c.descriptors[0] ?? c.origins[0] ?? "declared";
        files.set(where, [...(files.get(where) ?? []), c]);
      }
      const body: string[] = [];
      let i = 0;
      for (const [file, members] of [...files.entries()].sort()) {
        body.push(`subgraph DEP${++i}["Runtime boundary: ${label(file)}"]`);
        for (const c of members) body.push(`    ${node(c.id, title(c), "box")}`);
        body.push("end");
      }
      for (const s of stores) body.push(node(s.id, nameOf(s.id), "store"));
      const rels = lifted.filter(
        (r) => kept.has(r.source_id) && (kept.has(r.target_id) || stores.some((s) => s.id === r.target_id))
      );
      body.push(...rels.map(edge));
      diagrams.push(
        view(
          "D10",
          "D10",
          "Deployment and runtime blueprint",
          "flowchart TB",
          body,
          [...kept, ...stores.map((s) => s.id)],
          rels,
          omitted
        )
      );
    }
  }

  // D11 detail per container with components.
  let detail = 0;
  for (const c of containers) {
    const kids = comps.filter((k) => k.parent_id === c.id);
    if (kids.length === 0 || detail >= MAX_DETAIL_VIEWS) continue;
    const ids = kids.map((k) => k.id);
    const rels = model.relationships.filter((r) => ids.includes(r.source_id) || ids.includes(r.target_id));
    const others = [
      ...new Set(rels.flatMap((r) => [r.source_id, r.target_id]).filter((i) => !ids.includes(i))),
    ];
    const { kept, omitted } = budget([...ids, ...others], rels);
    const body = [
      `subgraph ${nid(c.id)}["Container: ${label(title(c))}"]`,
      ...ids.filter((i) => kept.has(i)).map((i) => `    ${node(i, nameOf(i), "box")}`),
      "end",
      ...others.filter((i) => kept.has(i)).map((i) => node(i, nameOf(i), shapeOf(i))),
      ...rels.filter((r) => kept.has(r.source_id) && kept.has(r.target_id)).map(edge),
    ];
    diagrams.push(
      view(
        `D11-${c.id}`,
        "D11",
        `Component detail: ${c.name}`,
        "flowchart TB",
        body,
        [c.id, ...kept],
        rels.filter((r) => kept.has(r.source_id) && kept.has(r.target_id)),
        omitted
      )
    );
    detail++;
  }
  return diagrams;
}

/** Structural lint of a Mermaid source (not a parser): header, balanced blocks, quotes, portable syntax. */
export function lintMermaid(source: string): string[] {
  const problems: string[] = [];
  const lines = source.split("\n").filter((l) => l.trim() !== "");
  const head = lines[0]?.trim() ?? "";
  if (!/^flowchart (TB|LR)$/.test(head)) problems.push(`unexpected header ${JSON.stringify(head)}`);
  let depth = 0;
  for (const raw of lines.slice(1)) {
    const l = raw.trim();
    if (/^subgraph\b/.test(l)) depth++;
    else if (l === "end") depth--;
    if (depth < 0) problems.push("unbalanced end");
    if ((l.match(/"/g) ?? []).length % 2 !== 0) problems.push(`odd quotes: ${l}`);
    if (/<br|^click\b|%%\{/.test(l)) problems.push(`non-portable: ${l}`);
  }
  if (depth !== 0) problems.push(`unbalanced subgraph blocks (${depth})`);
  return problems;
}
