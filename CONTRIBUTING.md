# Contributing to Blueprint Check

Thanks for helping! Blueprint Check aims to stay **small, deterministic and honest** about what it knows.

## Ground rules

- Every claim in a blueprint cites evidence (path and line, or a directory) and carries a confidence. Heuristics are
  `INFERRED`; an SDK import is `CORROBORATED`, never a proven call. Missing evidence is a gap, never "absent".
- Views that need judgment (journeys, trust enforcement, operations) stay `blocked` with a reason. Do not fill them
  with plausible content.
- Derive through the other Commons tools (Architecture Check, the Impact Check graph, Product Check) instead of
  re-implementing their detection. New detection belongs in those tools first.
- Never execute or fetch anything named in a repository. No network access, telemetry or child processes. New runtime
  dependencies need an issue first (one is allowed today: `@enwithai/architecture-check`, which brings `yaml`).
- Fixtures must be **synthetic**. Never commit real or client architectures, secrets or personal data.
- Schema changes must bump `schema_version` and update `schema/`, `src/types.ts` and the tests together.

## Development

```bash
npm ci --ignore-scripts
npm run check:all                     # typecheck, lint, format check, build, tests with coverage
node scripts/license-audit.mjs --all
npm run build && node scripts/generate-demo-output.mjs   # after changing output; commit the updated sample
```

## Pull requests

- Keep PRs focused; include tests that assert behavior.
- Describe user-visible changes in `CHANGELOG.md` under "Unreleased".
- By contributing you agree your contribution is licensed under the MIT License.

## Licensing of contributions and attribution

- Contributions are accepted under this repository's MIT License, inbound = outbound. By opening a pull request you
  confirm you have the right to submit the work under that license.
- Do not paste code, text or diagrams from other projects or publications. If third-party material is genuinely
  needed, open an issue first; it must keep its original license notice and be listed in [NOTICE.md](NOTICE.md).
- New source files start with `// SPDX-License-Identifier: MIT` (or `#` for YAML and shell).
- Do not add framework (CLEAR/TRACE) or product (CrewPE) claims unless
  [commons-provenance.yaml](commons-provenance.yaml) records an evidenced relationship. See
  [ATTRIBUTION.md](ATTRIBUTION.md).
- AI-assisted contributions are welcome. You are responsible for reviewing them and for their licensing; mention
  significant AI assistance in the PR description.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
