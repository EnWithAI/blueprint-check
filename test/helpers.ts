// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Test helpers: run the CLI in-process with a fixed clock, copy fixtures into temporary directories and load
 * generated blueprint files.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../src/cli/run.js";

/** Fixed clock used by every test run. */
export const NOW = (): Date => new Date("2026-10-30T00:00:00.000Z");

/** Absolute path of a fixture. */
export const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** Result of an in-process CLI run. */
export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs the CLI in-process. */
export async function cli(args: string[], cwd: string): Promise<CliResult> {
  let stdout = "";
  let stderr = "";
  const code = await run(args, { stdout: (t) => (stdout += t), stderr: (t) => (stderr += t), cwd, now: NOW });
  return { code, stdout, stderr };
}

/**
 * A fake token in GitHub's format, assembled at run time so that no token-shaped string is committed. Fixtures
 * reference it as __FAKE_GITHUB_TOKEN__.
 */
export const FAKE_GITHUB_TOKEN = ["ghp", "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].join("_");

function injectFakeToken(dir: string): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) injectFakeToken(path);
    else {
      const text = readFileSync(path, "utf8");
      if (text.includes("__FAKE_GITHUB_TOKEN__"))
        writeFileSync(path, text.replaceAll("__FAKE_GITHUB_TOKEN__", FAKE_GITHUB_TOKEN));
    }
  }
}

/** Copies the demo repository (plus the product results fixture) into a fresh temporary directory. */
export function demoRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "blueprint-check-"));
  cpSync(fixture("demo"), dir, { recursive: true });
  cpSync(fixture("product-results.json"), join(dir, "product-results.json"));
  injectFakeToken(dir);
  return dir;
}

/** Creates a temporary directory containing the given files. */
export function tempRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "blueprint-check-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

/** Reads and parses a JSON file of a generated blueprint. */
export function readBlueprintJson<T = Record<string, unknown>>(
  dir: string,
  file: string,
  out = "architecture-blueprint"
): T {
  return JSON.parse(readFileSync(join(dir, out, file), "utf8")) as T;
}

/** Every file under `dir`, relative and sorted. */
export function tree(dir: string, prefix = ""): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? tree(path, `${prefix}${name}/`) : [`${prefix}${name}`];
    })
    .sort();
}
