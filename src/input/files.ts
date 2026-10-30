// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Bounded, link-free file access: hashing the lines an evidence record cites, and reading the JSON inputs. Paths
 * that leave the repository, symbolic links and oversized files are refused.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { inputError } from "../errors.js";

/** Largest file Blueprint Check reads (inputs and cited sources). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** sha256 of a string, hex. */
export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** True when `path` (relative to `root`) stays inside `root`. */
export function inside(root: string, path: string): boolean {
  const rel = relative(root, resolve(root, path));
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Reads a regular file under `root` (no symbolic links, size-capped), or null when that is not possible. */
function readRegular(root: string, path: string): string | null {
  if (!inside(root, path)) return null;
  const abs = resolve(root, path);
  if (!existsSync(abs)) return null;
  const stat = lstatSync(abs);
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
  return readFileSync(abs, "utf8");
}

/**
 * Hash of the cited lines of a file, or null when the evidence names a directory, has no line, or the file cannot be
 * read. Line numbers are 1-based and inclusive.
 */
export function excerptHash(
  root: string,
  path: string,
  start: number | null,
  end: number | null
): string | null {
  if (start === null) return null;
  const text = readRegular(root, path);
  if (text === null) return null;
  const lines = text.split(/\r?\n/);
  const last = Math.max(start, end ?? start);
  if (start < 1 || last > lines.length) return null;
  return sha256(lines.slice(start - 1, last).join("\n"));
}

/** State of a cited location now: the same hash, a different one, or gone. */
export function locationState(
  root: string,
  path: string,
  start: number | null,
  end: number | null,
  hash: string | null
): "unchanged" | "changed" | "missing" {
  if (!inside(root, path) || !existsSync(resolve(root, path))) return "missing";
  if (hash === null) return "unchanged";
  const now = excerptHash(root, path, start, end);
  if (now === null) return "missing";
  return now === hash ? "unchanged" : "changed";
}

/** Reads and parses a JSON input file; returns its data and sha256. */
export function readJsonInput(path: string, label: string): { data: unknown; sha: string } {
  if (!existsSync(path)) throw inputError(`${label} not found: ${path}`);
  const stat = lstatSync(path);
  if (!stat.isFile()) throw inputError(`${label} is not a regular file: ${path}`);
  if (stat.size > MAX_FILE_BYTES)
    throw inputError(`${label} is larger than ${MAX_FILE_BYTES} bytes: ${path}`);
  const text = readFileSync(path, "utf8");
  try {
    return { data: JSON.parse(text) as unknown, sha: sha256(text) };
  } catch (error) {
    throw inputError(`${label} is not valid JSON: ${path} (${(error as Error).message})`);
  }
}
