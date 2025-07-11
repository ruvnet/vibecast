## 00 · Global Tech‑Stack Baseline

| Layer | Tooling | Rationale |
|-------|---------|-----------|
| Language | **Python 3.11** | Latest LTS, pattern‑matching, perf |
| Packaging | **Hatch** | PEP 621, virtual‑env mgmt built‑in |
| Static Typing | **mypy --strict** | Early bug catch, safer refactors |
| Tests | **pytest** + **pytest‑cov** + **hypothesis** | Property & unit tests |
| Lint | **ruff** | Fast, opinionated, replaces flake8+pylint |
| Format | **black** | Deterministic diffs |
| Docs | **MkDocs‑Material** | Dev‑friendly, MDX support |
| API | **FastAPI** (+ uvicorn) | Async, OpenAPI out‑of‑box |
| Containers | **Docker 23** | Multi‑stage, slim base |
| CI | **GitHub Actions** | Matrix build, artefact upload |

### Acceptance Criteria

* `pyproject.toml` lists all run‑time & dev dependencies.
* `pre‑commit` config installs ruff/black/mypy/pytest hooks.
* A blank repo with these configs passes CI (no code yet).
