#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/** CLI entry point. */
import { run } from "./run.js";

// SOURCE_DATE_EPOCH (seconds) fixes generated_at, for reproducible blueprints.
const epoch = Number(process.env["SOURCE_DATE_EPOCH"]);
const code = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  cwd: process.cwd(),
  ...(Number.isFinite(epoch) && epoch > 0 ? { now: () => new Date(epoch * 1000) } : {}),
});
process.exitCode = code;
