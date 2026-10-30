# Changelog

All notable changes are listed here. Versions follow semantic versioning; `0.x` releases may change outputs.

## Unreleased

## 0.1.0 (unreleased, 2026-10-30)

First version.

- `generate`: evidence-linked architecture blueprint of one repository from Architecture Check 0.2.1 derive, the
  optional Impact Check graph and optional Product Check surface. Writes the dossier, Mermaid views for D00, D01, D02,
  D04, D05, D06 (partial), D07, D09, D10 and D11, the model, evidence register with hashed citations, coverage ledger,
  validation report, open questions and `workspace.dsl`. All 19 catalog views get a status; judgment views stay
  blocked.
- `--write-model`: writes `architecture/workspace.dsl` for Architecture Check when no declared model exists.
- `drift` / `check`: evidence staleness and model drift; `check` exits 4 when stale.
- GitHub Action (`generate` and `check` modes), JSON Schema 1.0, `SOURCE_DATE_EPOCH` support.
