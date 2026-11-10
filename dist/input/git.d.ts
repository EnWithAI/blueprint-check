/** Revision of the analyzed repository. */
export interface Snapshot {
    commit: string | null;
    branch: string | null;
}
/** Reads the snapshot of the repository at `root`. */
export declare function readSnapshot(root: string): Snapshot;
