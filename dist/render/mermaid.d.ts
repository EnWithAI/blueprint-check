/**
 * Mermaid views of the model (docs/SPEC.md §4). Node ids are generated (`n_<model id>`), never copied from the
 * repository; every label is redacted, made single-line and entity-encoded, so repository names cannot inject Mermaid
 * syntax or HTML. Views stay within a node budget; omitted nodes are counted and named in the dossier.
 */
import type { CoreModel } from "../model/build.js";
import type { Diagram } from "../types.js";
/** Most nodes drawn in one view (the master prompt splits views above 20-25). */
export declare const NODE_BUDGET = 22;
/** Most component detail views (D11) generated. */
export declare const MAX_DETAIL_VIEWS = 10;
/** Encodes a repository-derived string for use inside a quoted Mermaid label. */
export declare function label(text: string, max?: number): string;
/** Builds every view the evidence supports. */
export declare function buildDiagrams(model: CoreModel): Diagram[];
/** Structural lint of a Mermaid source (not a parser): header, balanced blocks, quotes, portable syntax. */
export declare function lintMermaid(source: string): string[];
