## 06 · Interfaces — CLI & FastAPI Service

> **Goal:** Provide user‑facing entry points for simulation runs and live
> position estimation over HTTP.

### Scope / Deliverables

* `qmag_nav.cli` with sub‑commands:
  * `simulate --steps N` → prints JSON trajectory.
  * `estimate --lat --lon` → prints EKF estimate vs ground truth.
* `qmag_nav.service.api` (FastAPI):
  * `GET /healthz` → `{status:"ok"}`.
  * `POST /estimate` JSON `{"bx":..,"by":..,"bz":..}` → `{lat,lon,quality}`.
  * Automatic OpenAPI docs (`/docs`).
* Async test‑client (`httpx.AsyncClient`) tests endpoints.
* CLI tests using `subprocess.run` / `typer.testing`.
* Example Jupyter notebook (`docs/notebooks/demo.ipynb`) calling the API.

### Tasks

1. Implement CLI with `argparse` or `typer`.
2. Plug EKF (Phase 05) into API – keep singleton filter in app state.
3. Add middleware for latency logging & CORS.
4. Write tests & docs.

### Acceptance Criteria

* End‑to‑end test: `pytest tests/test_integration_api.py` passes & hits 100 %.
* `uvicorn qmag_nav.service.api:app --reload` serves `/docs` locally.

### Links & Dependencies

* Consumes EKF (Phase 05) — the public face of the system.
