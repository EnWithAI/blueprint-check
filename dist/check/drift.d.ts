import type { DriftReport } from "../types.js";
/** Options for one check run. */
export interface CheckOptions {
    cwd: string;
    blueprintDir: string;
    graphPath?: string | null;
    productCheckPath?: string | null;
    architectureConfigPath?: string | null;
    policy: boolean;
    now?: () => Date;
}
/** Checks the blueprint in `blueprintDir` against the repository in `cwd`. */
export declare function checkBlueprint(options: CheckOptions): DriftReport;
