// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Regenerates the committed sample blueprint in examples/demo/output/ with the built CLI. SOURCE_DATE_EPOCH fixes
 * generated_at so the sample is byte-reproducible.
 * Usage: npm run build && node scripts/generate-demo-output.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const result = spawnSync(
  process.execPath,
  [`${root}dist/cli/main.js`, "generate", "--graph", "graph.json", "--out-dir", "output", "--quiet"],
  { cwd: `${root}examples/demo`, encoding: "utf8", env: { ...process.env, SOURCE_DATE_EPOCH: "1767225600" } }
);
if (result.status !== 0) throw new Error(result.stderr);
