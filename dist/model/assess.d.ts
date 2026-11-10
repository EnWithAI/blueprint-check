import type { CatalogEntry, CoverageUnit, Diagram, Gate, Metric } from "../types.js";
import type { CoreModel } from "./build.js";
/** Catalog view names (Software Architecture Blueprint master prompt v2). */
export declare const CATALOG: Record<string, string>;
/** Assigns a justified status to every catalog view. */
export declare function assessCatalog(model: CoreModel, diagrams: Diagram[]): CatalogEntry[];
/** Builds the coverage units: containers, stores and API description sets, plus excluded paths. */
export declare function coverageUnits(model: CoreModel, diagrams: Diagram[]): CoverageUnit[];
/** Computes the coverage metrics from the ledger and model. */
export declare function coverageMetrics(model: CoreModel, units: CoverageUnit[], diagrams: Diagram[], catalog: CatalogEntry[]): Metric[];
/** Integrity of the model: unique ids and resolvable references. Returns problems (empty when sound). */
export declare function integrity(model: CoreModel, diagrams: Diagram[]): string[];
/** Validation gates V01-V13 for one generated blueprint. */
export declare function validationGates(model: CoreModel, diagrams: Diagram[], catalog: CatalogEntry[], problems: string[]): Gate[];
