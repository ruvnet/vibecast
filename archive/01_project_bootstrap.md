## 01 · Project Bootstrap

> **Goal:** Skeleton repository that builds, tests, and lints cleanly with a
> one‑line command.

### Scope / Deliverables

1. `git init` + main branch renamed to `main`.
2. `pyproject.toml` with metadata (`name=qmag_nav`, semver `0.1.0`).
3. Minimal package layout:
   ```text
   src/qmag_nav/__init__.py
   tests/test_sanity.py
   ```
4. Pre‑commit running `ruff`, `black --check`, `mypy --strict`, and
   `pytest --quiet`.
5. GitHub Actions workflow `ci.yml`:
   * Strategy matrix: `python 3.11` on `ubuntu-latest` and `macos-latest`.
   * Steps: checkout → hatch env → pre‑commit → pytest (`--cov --cov-report=xml`).
6. Coveralls / Codecov upload (optional but recommended).
7. `README.md` updated with build badge.

### Tasks

| # | Task | Command Hint |
|---|------|--------------|
| 1 | Install Hatch | `pipx install hatch` |
| 2 | Create project | `hatch new qmag_nav` |
| 3 | Add dev deps | `hatch env create default` → edit toml |
| 4 | Configure hooks | `pre-commit install` |
| 5 | Write action file | `.github/workflows/ci.yml` |
| 6 | Push & observe | CI must be green |

### Acceptance Criteria

* `make test` (or `hatch run +cov`) exits 0 and shows 100 % coverage (trivial).
* Pre‑commit shows **no warnings** on a clean checkout.
* `docker build -t qmag-nav:dev .` completes (even if container does nothing yet).

### Links & Dependencies

* Depends on **Phase 00** for chosen tooling versions.
