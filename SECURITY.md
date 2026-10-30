# Security policy

## Supported versions

Only the latest `0.x` alpha receives fixes.

## Reporting a vulnerability

Security contact: **Koushik Ramani** ([@aiwithrk](https://github.com/aiwithrk)), maintainer, EnWithAI Technologies ·
[hello@enwithai.com](mailto:hello@enwithai.com) (if you cannot use GitHub's private reporting).

Please **do not open a public issue**. Use GitHub's private vulnerability reporting ("Report a vulnerability" on the
Security tab). Include the Blueprint Check version, the command and a minimal synthetic repository. Never include
real secrets or proprietary code. We aim to acknowledge within 5 business days.

## Security properties Blueprint Check is designed to keep

- It never executes anything: no child processes, no `eval`, no dynamic imports, no JS config.
- It never uses the network and has no telemetry. No model or paid API is used.
- It reads files under `--cwd` without following symbolic links, plus the graph and Product Check files you name, and
  writes only `--out-dir` (and `architecture/workspace.dsl` with `--write-model`, never over an existing model).
- Every output string is token-redacted. Names from the repository are escaped in Markdown and entity-encoded in
  Mermaid; Mermaid node ids are generated, never copied.
- The GitHub Action needs only `contents: read` and must not be used with `pull_request_target`.

A violation of any of these is a security bug. See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
