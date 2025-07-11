## 05 · Navigation Filter & Sensor Fusion

> **Goal:** Fuse magnetic anomaly observations (from Phase 04) with inertial
> data (optional) to produce robust position estimates using an Extended
> Kalman Filter (EKF).

### Scope / Deliverables

* `qmag_nav.filter` package:
  * `ekf.py` — `NavEKF` maintaining state `[lat, lon, dlat, dlon]` (optional
    heading & bias states)
  * `utils.py` — Jacobians & numerical helpers.
* Update cycle: `predict(dt)`, `update(mag_obs, mag_map)`.
* Optional IMU integration (accel + gyro) if data available.
* Monte‑Carlo simulation script (`scripts/sim_nav.py`) generating random
  trajectories & sensor noise; results plotted (matplotlib).
* Tests:
  * Deterministic fixtures with known trajectory, noise 0.
  * Hypothesis random walks: RMS error bound < 10 m after 300 s.
* Docs page explaining EKF equations with LaTeX.

### Tasks

1. Implement state transition `F`, process noise `Q` (tuneable).
2. Implement measurement model `H` mapping state → expected anomaly via
   `MagneticMap.interpolate`.
3. Validate linearisation (finite difference vs analytical Jacobian).
4. Add unit & property tests.

### Acceptance Criteria

* `pytest -k filter --cov=qmag_nav.filter` 100 %.
* Sim RMS error ≤ requirement.
* All public APIs typed & documented.

### Links & Dependencies

* Consumes sensor data (Phase 03) & map lookups (Phase 04).
* Provides estimates to CLI / API (Phase 06).
