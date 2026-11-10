/** I/O seams for the CLI so it can run in-process in tests. */
export interface CliIO {
    stdout: (text: string) => void;
    stderr: (text: string) => void;
    cwd: string;
    now?: () => Date;
}
/** Architecture Check's default declared-model locations (a declared model is never overwritten). */
export declare const DECLARED_MODEL_PATHS: string[];
/** Text printed by `blueprint-check --help`. */
export declare const HELP: string;
/** Returns the bundled JSON Schema (works from both src/ and dist/). */
export declare function readSchema(): string;
/** Runs the CLI and returns the process exit code. Never throws. */
export declare function run(argv: string[], io: CliIO): Promise<number>;
