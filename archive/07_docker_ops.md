## 07 · Docker & Operationalisation

> **Goal:** Package the entire stack into a lightweight, reproducible Docker
> image and deploy continuously via GitHub Actions.

### Scope / Deliverables

* Multi‑stage `Dockerfile`:
  1. **builder** stage: install dev tools, run tests, produce wheel.
  2. **runtime** stage: copy wheel + `uvicorn` only (slim).
* `docker-compose.yml`:
  * `api` service (exposes port 8000).
  * `locust` service (optional) for load testing.
* `scripts/run-api.sh` helper mirroring compose command.
* GH Actions workflow `docker.yml`:
  * Build & push `ghcr.io/<org>/qmag-nav:sha` + `:latest` on main.
  * Scan with Trivy for vulnerabilities.
* Make‑target `make docker-run` for local smoke.
* Upgrade docs with deployment instructions (K8s YAML snippet, helm chart TBD).

### Tasks

1. Write `Dockerfile` + .dockerignore.
2. Wire compose file; mount `mag_data/` volume.
3. Configure GH Actions secrets (`GHCR_TOKEN`).
4. Add badge to README.

### Acceptance Criteria

* `docker build .` succeeds offline.
* Running container answers `GET /healthz` in < 100 ms.
* CI publishes image + SBOM attestation.

### Links & Dependencies

* Finalises previous phases into a shippable artefact.
