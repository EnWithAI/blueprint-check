import * as architectureCheck from "@enwithai/architecture-check";
import type { InputInfo } from "../types.js";
/** Architecture Check's derive report. */
export type AsBuiltReport = architectureCheck.Report;
/** One entry of the product surface (pages, endpoints, entities, integrations, auth boundaries). */
export interface SurfaceEntry {
    id: string;
    kind: "page" | "endpoint" | "entity" | "config" | "integration" | "auth-boundary" | "test";
    name: string;
    method: string | null;
    area: string;
    detail: string;
    path: string;
    line: number | null;
    certainty: "observed" | "inferred";
    auth_hint: boolean;
}
/** Everything the model builder needs. */
export interface Sources {
    asBuilt: AsBuiltReport;
    architectureConfig: string;
    graph: InputInfo | null;
    surface: SurfaceEntry[];
    product: InputInfo | null;
}
/** Options for reading the sources. */
export interface SourceOptions {
    cwd: string;
    graphPath: string | null;
    productCheckPath: string | null;
    architectureConfigPath: string | null;
    now: () => Date;
}
/** Reads a Product Check results file (with an embedded as-built spec) or an as-built spec file. */
export declare function readProductSurface(path: string, display: string): {
    surface: SurfaceEntry[];
    info: InputInfo;
};
/** Reads every source. Architecture Check runs in-process in derive mode and writes nothing. */
export declare function readSources(options: SourceOptions): Sources;
