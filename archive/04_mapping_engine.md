## 04 · Magnetic‑Map Engine

> **Goal:** Load grid datasets (GeoTIFF, NetCDF), cache tiles, and provide fast
> bilinear/bicubic interpolation of magnetic anomalies.

### Scope / Deliverables

* `qmag_nav.mapping` package:
  * `backend.py` — `MagneticMap` high‑level façade (load, interpolate, cache).
  * `interpolate.py` — mathematical routines (bilinear, optional bicubic).
  * `landmarks.py` (stretch) — extract high‑gradient landmarks to speed up
    fingerprint matching.
* File support:
  * GeoTIFF via `rasterio`.
  * NetCDF via `xarray` / `netcdf4`.
* Caching strategy: LRU (in‑mem) + optional disk memoisation.
* Test fixtures:
  * `tests/data/5x5_grid.tif` (small synthetic grid with known values).
  * Golden‑file JSON with expected interpolation outputs.
* Property tests (Hypothesis): continuity across cell boundaries.
* Performance: ≤ 100 µs for single bilinear lookup on 5k × 5k grid.

### Tasks

1. Implement `MagneticMap.from_geotiff(path)`.
2. Implement `MagneticMap.interpolate(lat, lon, method="bilinear")`.
3. Add `functools.lru_cache` or custom cache for tiles.
4. Create fixtures & tests for correctness + OOB errors.

### Acceptance Criteria

* 100 % test & branch coverage for mapping package.
* Benchmarks meet performance goal.
* Memory usage ≤ 200 MB for 1° global grid.

### Links & Dependencies

* Builds on **Phase 02** (`TileMetadata`) for metadata handling.
* Supplies anomaly lookups to EKF in **Phase 05**.
