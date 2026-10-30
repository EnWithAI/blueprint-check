// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Blueprint Check version, read from package.json (works from both src/ and dist/: package.json is one level up).
 */
import { readFileSync } from "node:fs";

const parsed = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version?: unknown;
};

/** Blueprint Check package version. */
export const TOOL_VERSION: string = typeof parsed.version === "string" ? parsed.version : "0.0.0";
