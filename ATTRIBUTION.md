# Attribution and provenance

## Publisher

- **Project:** Blueprint Check (`@enwithai/blueprint-check`), the seventh EnWithAI Engineering Commons tool.
- **Commons:** EnWithAI Engineering Commons. _Check the spec. Check the impact. Check the outcome._ Blueprint Check
  adds: draw the as-built blueprint and keep it true.
- **Copyright holder:** EnWithAI Technologies (as stated in [LICENSE](LICENSE)).
- **License:** MIT. It applies to all code, documentation, schemas and examples in this repository, with the
  third-party notes in [NOTICE.md](NOTICE.md).
- **Maintainer:** Koushik Ramani ([@aiwithrk](https://github.com/aiwithrk)), EnWithAI Technologies.
- **Contact:** [hello@enwithai.com](mailto:hello@enwithai.com)
- **Security issues:** see [SECURITY.md](SECURITY.md).

## Development provenance

Blueprint Check was written for this repository, spec first (`docs/SPEC.md`). It was developed with substantial AI assistance (Claude Code). Commits carry a
`Co-Authored-By` trailer, and changes were directed and accepted by the project's human sponsor. Test fixtures and
demo data are synthetic.

## Built on

| Upstream                                                             | Version          | License   | How Blueprint Check uses it                                                             |
| -------------------------------------------------------------------- | ---------------- | --------- | --------------------------------------------------------------------------------------- |
| [Node.js](https://nodejs.org)                                        | 22 / 24 / ≥ 26   | MIT       | Runtime only                                                                            |
| [Architecture Check](https://github.com/enwithai/architecture-check) | 0.2.1            | MIT       | Runtime dependency: in-process `derive` (as-built model) and its Structurizr DSL writer |
| [yaml](https://github.com/eemeli/yaml)                               | 2.9.1            | ISC       | Transitive runtime dependency of Architecture Check                                     |
| [Impact Check](https://github.com/enwithai/impact-check)             | graph schema 1.0 | MIT       | `impact-check graph` output, read as a file through Architecture Check                  |
| [Product Check](https://github.com/enwithai/product-check)           | schema 0.1.0     | MIT       | Results or as-built spec, read as a file                                                |
| [Mermaid](https://mermaid.js.org)                                    | flowchart syntax | MIT       | Views are written as Mermaid source; no Mermaid code is used                            |
| [C4 model](https://c4model.com)                                      | —                | CC BY 4.0 | Vocabulary (system, container, component)                                               |

Development tools (Vitest, ESLint, typescript-eslint, Prettier, Ajv, TypeScript) are not distributed. Research and
design influences are in [REFERENCES.md](REFERENCES.md). Listing a project does not mean its maintainers endorse
Blueprint Check.

## Frameworks

| Framework | Owner                  | Relationship   | Note                                                                                                                                                                                                           |
| --------- | ---------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLEAR     | NetworkGain Consulting | `inspired`     | The view catalog, confidence labels, coverage metrics and validation gates follow the CLEAR Software Architecture Blueprint master prompt v2.0.0 (user-supplied); the implementation is Blueprint Check's own. |
| TRACE     | EnWithAI Technologies  | `not-assessed` | Blueprint Check ties every claim to hashed evidence. Alignment with TRACE cannot be stated until it is published.                                                                                              |

## Ecosystem

Blueprint Check is independently usable. It has no dependency on CrewPE, any EnWithAI service or NetworkGain, and it
never uses the network. CrewPE is EnWithAI's enterprise engineering-lifecycle product; an enterprise-wide, continuously
updated architecture view is CrewPE's scope, not this tool's, and no integration exists today.

## Not affiliated

Blueprint Check is not affiliated with, endorsed by or certified by the Mermaid project, Structurizr Limited, the C4
model's author, Anthropic or Google.
