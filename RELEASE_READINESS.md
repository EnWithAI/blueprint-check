# Release readiness — 0.3.261110 (version alignment)

Date: 2026-11-10 · Branch `release/0.3.261110` · **Verdict: RELEASE APPROVED** by the user on 2026-11-10. Every
Engineering Commons tool moves to `0.3.YYMMDD`; no functional change. Pins Architecture Check 0.3.261110 from the
registry (same code as 0.2.1); `npm audit --omit=dev` 0. `npm run check:all` exit 0 (37 tests); demo output
regenerated.

---

# Release readiness — Blueprint Check 0.1.0

Date: 2026-11-10 · Branch `main` on GitHub (EnWithAI/blueprint-check, CI green) · **Verdict: RELEASE APPROVED** by the
user on 2026-11-10 (tag, GitHub release, npm publish by the user with 2FA).

## Release check (2026-11-10, Node v25.9.0)

| Check     | Command                          | Result                                                           |
| --------- | -------------------------------- | ---------------------------------------------------------------- |
| Full gate | `npm run check:all`              | exit 0; 5 files / 37 tests passed; lines 97.46%, branches 81.61% |
| Licenses  | `node scripts/license-audit.mjs` | production: 2 packages (MIT 1, ISC 1); disallowed 0              |
| Package   | `npm pack --dry-run`             | 51 files, 50.0 kB                                                |
| CI        | GitHub Actions on `main`         | success                                                          |
| Pins      | `@enwithai/architecture-check`   | 0.2.1, published on npm                                          |

## 0.1.0 (2026-10-30, Node v25.9.0)

| Check     | Command                                                               | Result                                                                                                |
| --------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Full gate | `npm run check:all`                                                   | exit 0: typecheck, lint, format, build; 5 files / 36 tests passed; lines 97.09%, branches 81%         |
| Licenses  | `node scripts/license-audit.mjs` / `--all`                            | production: 2 packages (MIT 1, ISC 1); all: MIT 40, ISC 1, BSD-3-Clause 1, Apache-2.0 1; disallowed 0 |
| Package   | `npm pack --dry-run`                                                  | 51 files, 49.5 kB                                                                                     |
| Mermaid   | mermaid-cli 11.4.2 on every demo view                                 | 10/10 parse and render (outside the test suite; no parser is bundled)                                 |
| Hand-off  | `generate --write-model`, then Architecture Check `check` on the demo | declared model usable, policy pass, no verified non-info findings (test)                              |

Not done before release: registry install of the packed tarball, a consumer run on another repository.
