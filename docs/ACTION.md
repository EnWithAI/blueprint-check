# Blueprint Check GitHub Action

Composite action in [`action.yml`](../action.yml). Pin a release tag or SHA: `dist/` exists only on release commits,
and the action fails fast without it.

## Inputs

| Input               | Default                  | Meaning                                                                                    |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `mode`              | `generate`               | `generate` writes the blueprint; `check` compares a committed blueprint with the code      |
| `working-directory` | `.`                      | Repository root, relative to the workspace                                                 |
| `graph`             |                          | Impact Check graph JSON, relative to `working-directory`                                   |
| `product-check`     |                          | Product Check results or as-built spec JSON, relative to `working-directory`               |
| `blueprint`         | `architecture-blueprint` | `check`: committed blueprint directory                                                     |
| `output-dir`        | `architecture-blueprint` | Blueprint (`generate`) or `blueprint-drift.{json,md}` (`check`), relative to the workspace |
| `fail-on-stale`     | `false`                  | `check`: fail the step when the blueprint is stale                                         |
| `on-error`          | `auto`                   | Tool errors: `auto` (fail when `fail-on-stale`, else warn), `fail` or `warn`               |

Outputs: `blueprint-dir`, `overall-status` (`generate`), `result` (`generated`, `current`, `stale`), `status` (`ok` or
`error`). The README (`generate`) or the drift report (`check`) is appended to the job summary.

## Security model

- Use `pull_request` or `push` with `permissions: contents: read`. Never `pull_request_target`.
- The first step runs `npm ci --omit=dev --ignore-scripts` in the action directory (contacts the npm registry); the
  analysis itself makes no network access and starts no process.
- Inputs reach the code through environment variables, never through shell interpolation. Relative paths with `..`
  or absolute paths are rejected.
- A pull request can edit its own committed blueprint. When `check` is blocking, protect `architecture-blueprint/`
  (and `.github/`) with CODEOWNERS.

## Example: keep a committed blueprint current

```yaml
on: pull_request
permissions:
  contents: read
jobs:
  blueprint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: EnWithAI/blueprint-check@v0.1.0
        with:
          mode: check
          fail-on-stale: "true"
```
