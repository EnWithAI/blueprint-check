// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Security invariants: no network, process or eval primitives in src/; repository names cannot inject Mermaid or
 * HTML; secrets and environment values reach no output; symbolic links are not followed; only the output directory
 * is written.
 */
import { readdirSync, readFileSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { excerptHash, inside } from "../src/input/files.js";
import { readSnapshot } from "../src/input/git.js";
import { label, lintMermaid } from "../src/render/mermaid.js";
import { cli, demoRepo, FAKE_GITHUB_TOKEN, tempRepo, tree } from "./helpers.js";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "fixtures") return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("security invariants", () => {
  it("source code contains no network, process or eval primitives", () => {
    for (const file of sourceFiles(fileURLToPath(new URL("../src", import.meta.url)))) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(
        /from "node:(http|https|net|tls|dgram|http2|child_process|worker_threads|vm)"/
      );
      expect(text, file).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|\beval\(|new Function\(|\bimport\(/);
    }
  });

  it("source and tests contain no invisible or bidirectional control characters", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    for (const file of [...sourceFiles(join(root, "src")), ...sourceFiles(join(root, "test"))])
      expect(readFileSync(file, "utf8"), file).not.toMatch(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/);
  });

  it("Mermaid labels cannot break out of quotes or carry HTML", () => {
    const evil = 'x"] --> PWN["<img src=x onerror=alert(1)>" | click PWN call(1)';
    const out = label(evil);
    expect(out).not.toMatch(/["<>|[\]]/);
    expect(lintMermaid(`flowchart TB\n    A["${out}"]\n`)).toEqual([]);
  });

  it("a crafted compose service name stays inert in every view", async () => {
    const dir = tempRepo({
      "docker-compose.yml":
        'services:\n  "evil\\"] --> X[<img src=x onerror=alert(1)>":\n    image: node:22\n  api:\n    image: node:22\n',
    });
    expect((await cli(["generate", "--quiet"], dir)).code).toBe(0);
    for (const file of tree(join(dir, "architecture-blueprint")).filter((f) => f.endsWith(".mmd"))) {
      const text = readFileSync(join(dir, "architecture-blueprint", file), "utf8");
      expect(text, file).not.toContain("<img");
      expect(lintMermaid(text), file).toEqual([]);
    }
    expect(
      readFileSync(join(dir, "architecture-blueprint", "ARCHITECTURE_BLUEPRINT.md"), "utf8")
    ).not.toMatch(/(?<!\\)<img src=x/);
  });

  it("tokens in inputs and credentials in environment values reach no output", async () => {
    const dir = demoRepo();
    expect((await cli(["generate", "--product-check", "product-results.json", "--quiet"], dir)).code).toBe(0);
    for (const file of tree(join(dir, "architecture-blueprint"))) {
      const text = readFileSync(join(dir, "architecture-blueprint", file), "utf8");
      expect(text, file).not.toContain(FAKE_GITHUB_TOKEN);
      expect(text, file).not.toContain("app:secret");
    }
  });

  it("writes only the output directory", async () => {
    const dir = demoRepo();
    const before = tree(dir);
    await cli(["generate", "--graph", "graph.json", "--quiet"], dir);
    expect(
      tree(dir)
        .filter((f) => !before.includes(f))
        .every((f) => f.startsWith("architecture-blueprint/"))
    ).toBe(true);
  });

  it("does not follow symbolic links or leave the repository when hashing evidence", () => {
    const outside = tempRepo({ "secret.txt": "top secret\n" });
    const dir = tempRepo({ "a.txt": "a\n" });
    symlinkSync(join(outside, "secret.txt"), join(dir, "link.txt"));
    expect(excerptHash(dir, "link.txt", 1, 1)).toBeNull();
    expect(excerptHash(dir, "../secret.txt", 1, 1)).toBeNull();
    expect(excerptHash(dir, "a.txt", 5, 5)).toBeNull();
    expect(excerptHash(dir, "a.txt", 1, 1)).toMatch(/^[0-9a-f]{64}$/);
    expect(inside(dir, "../x")).toBe(false);
  });

  it("reads the snapshot from .git without running git", () => {
    const sha = "a".repeat(40);
    expect(
      readSnapshot(tempRepo({ ".git/HEAD": "ref: refs/heads/main\n", ".git/refs/heads/main": `${sha}\n` }))
    ).toEqual({ commit: sha, branch: "main" });
    expect(
      readSnapshot(
        tempRepo({
          ".git/HEAD": "ref: refs/heads/dev\n",
          ".git/packed-refs": `# pack\n${sha} refs/heads/dev\n`,
        })
      )
    ).toEqual({ commit: sha, branch: "dev" });
    expect(readSnapshot(tempRepo({ ".git/HEAD": `${sha}\n` }))).toEqual({ commit: sha, branch: null });
    const wt = tempRepo({
      "gitdir/HEAD": "ref: refs/heads/wt\n",
      "gitdir/commondir": "../common\n",
      "common/refs/heads/wt": `${sha}\n`,
    });
    expect(readSnapshot(tempRepo({ ".git": `gitdir: ${join(wt, "gitdir")}\n` }))).toEqual({
      commit: sha,
      branch: "wt",
    });
    expect(readSnapshot(tempRepo({ "a.txt": "x" }))).toEqual({ commit: null, branch: null });
    expect(readSnapshot(tempRepo({ ".git/HEAD": "garbage\n" }))).toEqual({ commit: null, branch: null });
  });
});
