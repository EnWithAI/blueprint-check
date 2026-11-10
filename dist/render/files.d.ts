import type { Blueprint } from "../types.js";
import { type MarkdownOptions } from "./markdown.js";
/** Every file of the package, keyed by path relative to the output directory. */
export declare function blueprintFiles(bp: Blueprint, options: MarkdownOptions): Record<string, string>;
/** Writes the package to `outDir`; returns the written paths (relative to `outDir`). */
export declare function writeBlueprint(bp: Blueprint, outDir: string, options: MarkdownOptions): string[];
