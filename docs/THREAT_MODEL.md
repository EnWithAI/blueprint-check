# Threat model

| Threat                                  | Control                                                                                                                                                   | Test                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Code execution from repository content  | No `child_process`, `vm`, `eval`, dynamic `import()` in `src/` (ESLint and a source scan); Architecture Check refuses `!script`/`!plugin`                 | `test/security.test.ts`                                       |
| Network access                          | No network modules or `fetch` in `src/`; the only network contact is the Action's `npm ci` of pinned dependencies                                         | `test/security.test.ts`                                       |
| Mermaid or HTML injection through names | Generated node ids; labels redacted, single-line and entity-encoded (quotes, angle brackets, the pipe character, brackets); structural lint on every view | crafted compose service name test                             |
| Markdown injection in the dossier       | Every repository string escaped (`code` spans or `text`), control and bidi characters made visible                                                        | crafted name test                                             |
| Secret leakage                          | Token-like strings redacted in every document and label; environment values reduced to host names by Architecture Check; inputs never echoed              | fake token in Product Check input; URL credentials in compose |
| Reading outside the repository          | Evidence hashing refuses `..`, absolute escapes, symbolic links and files over 50 MiB                                                                     | symlink and traversal test                                    |
| Writing outside the output              | Only `--out-dir` (and `architecture/workspace.dsl` with `--write-model`, never overwriting a declared model)                                              | write-set test                                                |
| Malicious input files                   | Kind and schema version checked; malformed surface entries refused with exit 3; size cap                                                                  | input refusal tests                                           |
| Stale blueprint presented as current    | `check` re-hashes every cited line and re-derives the model; CI can block on it                                                                           | drift tests                                                   |
| A PR weakening a blocking check         | Documented: protect the blueprint directory and `.github/` with CODEOWNERS                                                                                | docs/ACTION.md                                                |

Out of scope: runtime behaviour, correctness of the detections in Architecture Check and Product Check (their own threat
models apply), and whether a person accepts a `workspace.dsl` without review.
