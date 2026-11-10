import type { Blueprint } from "./types.js";
/** Options for one generate run. Paths are relative to `cwd` or absolute. */
export interface GenerateOptions {
    cwd: string;
    graphPath?: string | null;
    productCheckPath?: string | null;
    architectureConfigPath?: string | null;
    now?: () => Date;
}
/** Generates a blueprint for the repository at `options.cwd`. */
export declare function generate(options: GenerateOptions): Blueprint;
