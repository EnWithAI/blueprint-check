import type { EvidenceRecord, EvidenceType, SourceTool } from "../types.js";
/** A location to register. */
export interface EvidenceInput {
    path: string;
    line_start: number | null;
    line_end: number | null;
    key: string;
    type: EvidenceType;
    observation: string;
    source: SourceTool;
    limitations?: string | null;
}
/** Collects evidence records for one blueprint. */
export declare class EvidenceRegistry {
    private readonly root;
    private readonly snapshot;
    readonly records: EvidenceRecord[];
    private readonly byKey;
    constructor(root: string, snapshot: string | null);
    /** Registers a location (or returns the id of an identical one) and returns its evidence id. */
    add(input: EvidenceInput): string;
    /** Back-links each record to the claims that cite it. */
    link(claims: {
        id: string;
        evidence_ids: string[];
    }[]): void;
}
/** Maps Architecture Check evidence kinds to the blueprint's evidence types. */
export declare function typeOfArchitectureEvidence(kind: string): EvidenceType;
