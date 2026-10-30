# Blueprint Check

**Generate the as-built architecture blueprint of a repository, then keep it true.**

Blueprint Check (`@enwithai/blueprint-check`) turns what the other EnWithAI Engineering Commons tools can prove about a
repository into an architecture dossier people can read: a master plan, repository and deployable map, floor plan,
data plumbing, API wiring, storage, site plan, deployment and per-container detail, all as Mermaid diagrams, with
every element and connector linked to the file and line that proves it. It also writes a Structurizr model that
Architecture Check can guard from then on, and a `check` command that tells you when the blueprint has gone stale.

> **Deterministic** · **offline** · **no account, token or telemetry** · **never executes your code** · **no AI model
> in the loop** · MIT licensed

```bash
npx @enwithai/blueprint-check generate
```

## What you get

`generate` writes `architecture-blueprint/`:

| File                             | Contents                                                                                                                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE_BLUEPRINT.md`      | The dossier: all 19 catalog views with status and reason, Mermaid diagrams inline, element, relationship and contract tables with citations, observations, coverage and validation                          |
| `diagrams/*.mmd`                 | One Mermaid source per view (D00 master plan, D01 repository map, D02 floor plan, D04 data plumbing, D05 wiring, D06 trust (partial), D07 storage, D09 site plan, D10 deployment, D11 per-container detail) |
| `architecture-model.json`        | Canonical model: repository, components, relationships, data stores, contracts, findings, gaps, catalog                                                                                                     |
| `evidence-register.json`         | Every cited location with a sha256 of the cited lines                                                                                                                                                       |
| `coverage-ledger.json`           | Units, exclusions and metrics (never combined into a score)                                                                                                                                                 |
| `validation-report.json`         | Gates V01-V13 with status and method                                                                                                                                                                        |
| `workspace.dsl`                  | The as-built model in Structurizr DSL, ready to become Architecture Check's declared model                                                                                                                  |
| `README.md`, `OPEN_QUESTIONS.md` | Navigation, and gaps ranked by criticality with what would resolve them                                                                                                                                     |

## Honest by construction

- **Evidence or nothing.** Containers come from compose, Dockerfiles, Kubernetes and package manifests; components and
  imports from the Impact Check module graph; endpoints, pages, entities and auth boundaries from Product Check.
  Each claim carries `CONFIRMED`, `CORROBORATED` or `INFERRED`. An SDK import is corroboration, not proof of a call.
- **No invented architecture.** Request flows, critical journeys, trust enforcement, background processing,
  configuration, observability and resilience need judgment. They are marked **blocked** with a reason and recorded
  as gaps, so the overall status is **PROVISIONAL** until a person (or an agent run of the Software Architecture
  Blueprint prompt) adds them.
- **Coverage you can reproduce.** Metrics are computed from the ledger; a zero denominator is `n/a`, never 100%.

## Better with the other Commons tools

```bash
npx @enwithai/impact-check graph --format json --output graph.json    # components and imports
npx @enwithai/product-check run --repo .                              # endpoints, pages, entities, auth
npx @enwithai/blueprint-check generate --graph graph.json \
  --product-check .product-check/product-check-results.json --write-model
npx @enwithai/architecture-check check --graph graph.json             # guards the model from now on
```

`--write-model` writes `architecture/workspace.dsl` when the repository has no declared model yet (an existing model is
never touched). Review and commit it: from then on Architecture Check reports every change the model does not
describe. [Commons Check](https://github.com/enwithai/commons-check) runs all of this in one command.

## Keep it current

```bash
npx @enwithai/blueprint-check check        # exit 4 when the blueprint is stale
```

`check` re-hashes every cited line and derives the model again. It reports changed or missing evidence and components,
stores or relationships that appeared or disappeared. `drift` reports the same with exit 0.

## Commands and options

```
blueprint-check generate [--cwd <dir>] [--out-dir <dir>] [--graph <file>] [--product-check <file>]
                         [--architecture-config <file>] [--write-model] [--no-branding] [--quiet]
blueprint-check drift|check [--blueprint <dir>] [--graph <file>] [--product-check <file>] [--format markdown|json]
                         [--output <file>]
blueprint-check schema
```

Exit codes: 0 ok · 1 internal error · 2 usage error · 3 input error · 4 stale blueprint (`check`). `--on-error pass`
turns internal and input errors into warnings. `SOURCE_DATE_EPOCH` fixes `generated_at` for reproducible output.

## GitHub Action

```yaml
on: pull_request
permissions:
  contents: read
jobs:
  blueprint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: EnWithAI/blueprint-check@v0.1.0 # pin a release tag or SHA
        with:
          mode: check # or generate
          fail-on-stale: "false" # report only
```

See [docs/ACTION.md](docs/ACTION.md). A sample blueprint of the bundled demo is in
[examples/demo/output/](examples/demo/output/).

## Scope

0.1 derives one repository per run, from the inputs above. It does not trace runtime behaviour, cross-repository
bindings, CI pipelines or configuration precedence; those views stay blocked. See [docs/SPEC.md](docs/SPEC.md) and
[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## License

MIT © EnWithAI Technologies. See [LICENSE](LICENSE), [NOTICE.md](NOTICE.md), [ATTRIBUTION.md](ATTRIBUTION.md) and
[TRADEMARKS.md](TRADEMARKS.md). Part of the EnWithAI Engineering Commons: _check the spec, the impact, the
architecture, the outcome and the product, and now draw the blueprint._
