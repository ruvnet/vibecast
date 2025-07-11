# Quantum‑Magnetic Navigation — Master Implementation Roadmap

This folder holds the **multi‑step execution plan** for building a complete
quantum‑magnetic navigation system, from an empty repository to a
container‑shippable service that supports all the **Applications** and
**Novel Uses** listed in the project README.

Each numbered markdown file represents a phase.  Finish a phase  merge to
`main`  start the next.  A phase is *done* only when **all acceptance
criteria pass automatically in CI**.

| Phase | File | High‑level Outcome |
|:----:|:----|:--|
| 00 | `00_global_tech_stack.md` | Unified language / tooling decisions |
| 01 | `01_project_bootstrap.md` | Skeleton repo, green CI, 100 % tests |
| 02 | `02_core_domain_models.md` | Validated geo & sensor DTOs |
| 03 | `03_sensor_package.md` | Calibrated magnetometer abstraction |
| 04 | `04_mapping_engine.md` | Magnetic map loader & interpolator |
| 05 | `05_navigation_filter.md` | Extended Kalman Filter fusion |
| 06 | `06_interfaces.md` | CLI + REST API, ready for integration |
| 07 | `07_docker_ops.md` | Multi‑stage Docker, GitHub Actions CD |

Later milestones (e.g. **Hardware‑in‑the‑Loop**, **Swarm Demo**) will follow
the same pattern as `08_*.md`, `09_*.md`, etc.

---

## Cross‑Cutting Principles

1. **Test‑Driven** Every code path must be hit by pytest; `--cov-fail-under=100`.
2. **Type‑Safe** `mypy --strict` in CI; treat warnings as errors.
3. **Formatting & Linting** `ruff` + `black --check` gate the pipeline.
4. **Incremental Delivery** A user can *run* and *benefit* from the software at
   the end of every phase.
5. **Docs as Code** MkDocs site updated per phase; each new public API gets an
   example snippet.
