/**
 * Markdown renderings (docs/SPEC.md §6): the dossier (ARCHITECTURE_BLUEPRINT.md), the package README, the open
 * questions and the drift report of `check`. Every repository-derived string is escaped (`code` or `text`).
 */
import type { Blueprint, DriftReport } from "../types.js";
/** Rendering options. */
export interface MarkdownOptions {
    branding: boolean;
}
/** The dossier. */
export declare function renderDossier(bp: Blueprint, options: MarkdownOptions): string;
/** The package README. */
export declare function renderReadme(bp: Blueprint, options: MarkdownOptions): string;
/** The open questions: gaps ranked by criticality, then observations to confirm. */
export declare function renderOpenQuestions(bp: Blueprint, options: MarkdownOptions): string;
/** The drift report of `check`. */
export declare function renderDriftMarkdown(report: DriftReport, options: MarkdownOptions): string;
