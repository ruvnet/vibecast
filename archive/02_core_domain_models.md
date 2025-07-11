## 02 · Core Domain Models

> **Goal:** Strictly‑typed data layer shared by every subsequent phase.

### Scope / Deliverables

* Sub‑package `qmag_nav.models` with:
  * `geo.py` — `LatLon`, `ECEF`, `MagneticVector`, helper methods:
    * `to_ecef()` / `from_ecef()`
    * `distance_to()` (great‑circle — Haversine)
  * `sensor.py` — `SensorSpec`, `CalibrationParams` (`apply()`).
  * `map.py` — `MapHeader`, `TileMetadata(contains)`.
* All models inherit from **Pydantic v2** `BaseModel` for runtime validation.
* `hypothesis` property tests:
  * Round‑tripping `LatLon ↔ ECEF` within tolerance.
  * Applying calibration then inverse returns original.

### Tasks

1. Create `models` directory with `__init__.py` re‑exporting key classes.
2. Implement value‑range validation (`lat ∈ [-90,90]`, etc.).
3. Add `tests/test_models_geo.py` + sensor, map tests with 100 % branch coverage.

### Acceptance Criteria

* `pytest --cov=qmag_nav.models --cov-branch` ≥ 100.
* No `mypy` errors; all attributes typed; no `Any`.

### Links & Dependencies

* Builds on **Phase 01** skeleton.
* Unblocks filtering, mapping and interface phases.
