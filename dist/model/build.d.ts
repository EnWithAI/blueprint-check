import type { Sources } from "../input/sources.js";
import type { Snapshot } from "../input/git.js";
import type { Component, Contract, DataStore, Finding, Gap, Relationship, Repository } from "../types.js";
import { EvidenceRegistry } from "./evidence.js";
/** The model before views, coverage and validation are added. */
export interface CoreModel {
    repository: Repository;
    components: Component[];
    relationships: Relationship[];
    data_stores: DataStore[];
    contracts: Contract[];
    findings: Finding[];
    gaps: Gap[];
    /** Surface entries that mark auth boundaries, by owning component id (for the trust view). */
    authBoundaries: Map<string, number>;
    registry: EvidenceRegistry;
    hasGraph: boolean;
    hasSurface: boolean;
}
/** Builds the core model. `root` is the repository directory (for evidence hashing). */
export declare function buildModel(root: string, sources: Sources, snapshot: Snapshot): CoreModel;
