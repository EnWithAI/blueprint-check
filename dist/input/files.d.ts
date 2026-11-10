/** Largest file Blueprint Check reads (inputs and cited sources). */
export declare const MAX_FILE_BYTES: number;
/** sha256 of a string, hex. */
export declare const sha256: (text: string) => string;
/** True when `path` (relative to `root`) stays inside `root`. */
export declare function inside(root: string, path: string): boolean;
/**
 * Hash of the cited lines of a file, or null when the evidence names a directory, has no line, or the file cannot be
 * read. Line numbers are 1-based and inclusive.
 */
export declare function excerptHash(root: string, path: string, start: number | null, end: number | null): string | null;
/** State of a cited location now: the same hash, a different one, or gone. */
export declare function locationState(root: string, path: string, start: number | null, end: number | null, hash: string | null): "unchanged" | "changed" | "missing";
/** Reads and parses a JSON input file; returns its data and sha256. */
export declare function readJsonInput(path: string, label: string): {
    data: unknown;
    sha: string;
};
