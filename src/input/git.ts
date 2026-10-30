// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Reads the checked-out revision directly from the .git directory (HEAD, loose refs, packed-refs) so the blueprint
 * can name its snapshot without running git. Worktrees, submodules and unusual layouts degrade to null, never to a
 * guess. Dirty state cannot be known without git and is always reported as not determined.
 */
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Revision of the analyzed repository. */
export interface Snapshot {
  commit: string | null;
  branch: string | null;
}

const SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

/** Locates the git directory: `.git` as a directory, or a `gitdir:` file (worktrees, submodules). */
function gitDir(root: string): string | null {
  const dotGit = join(root, ".git");
  if (!existsSync(dotGit)) return null;
  const stat = lstatSync(dotGit);
  if (stat.isDirectory()) return dotGit;
  if (!stat.isFile()) return null;
  const match = /^gitdir:\s*(.+)\s*$/m.exec(readFileSync(dotGit, "utf8"));
  return match?.[1] ? resolve(root, match[1]) : null;
}

/** Resolves a ref name to a commit through loose refs, then packed-refs. */
function resolveRef(dir: string, commonDir: string, ref: string): string | null {
  for (const base of [dir, commonDir]) {
    const loose = join(base, ref);
    if (existsSync(loose) && lstatSync(loose).isFile()) {
      const value = readFileSync(loose, "utf8").trim();
      if (SHA.test(value)) return value;
    }
  }
  const packed = join(commonDir, "packed-refs");
  if (existsSync(packed)) {
    for (const line of readFileSync(packed, "utf8").split("\n")) {
      const [sha, name] = line.trim().split(" ");
      if (name === ref && sha && SHA.test(sha)) return sha;
    }
  }
  return null;
}

/** Reads the snapshot of the repository at `root`. */
export function readSnapshot(root: string): Snapshot {
  try {
    const dir = gitDir(root);
    if (dir === null) return { commit: null, branch: null };
    const commonFile = join(dir, "commondir");
    const commonDir = existsSync(commonFile) ? resolve(dir, readFileSync(commonFile, "utf8").trim()) : dir;
    const head = readFileSync(join(dir, "HEAD"), "utf8").trim();
    if (SHA.test(head)) return { commit: head, branch: null };
    const ref = /^ref:\s*(refs\/\S+)$/.exec(head)?.[1];
    if (!ref) return { commit: null, branch: null };
    return {
      commit: resolveRef(dir, commonDir, ref),
      branch: ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref,
    };
  } catch {
    return { commit: null, branch: null };
  }
}
