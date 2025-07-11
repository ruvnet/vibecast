## 03 · Sensor Sub‑Package

> **Goal:** Acquire calibrated, de‑noised magnetic‑vector measurements at a
> configurable rate.

### Scope / Deliverables

* `qmag_nav.sensor` package:
  * `magnetometer.py` — `Magnetometer`, `MovingAverageFilter`.
  * `mock.py` — deterministic `MockSensorDriver` for tests and CI.
* Real driver shim interface (`Protocol`) with `.read() -> (bx,by,bz)`.
* Configurable calibration (`CalibrationParams`) + optional moving average.
* Unit tests:
  * Window edge‑cases (size 1, size N>1, invalid 0).
  * Calibration math.
  * Hot restart (persistent buffer after object recreation).
* Performance target: ≥ 1 000 Hz in‑memory mock (benchmarks optional).

### Tasks

1. Define driver `Protocol` & mock driver cycling through given samples.
2. Write moving‑average using `collections.deque(maxlen=window)`.
3. Integrate calibration logic.
4. Parameterize pytest cases; use `@pytest.mark.parametrize`.

### Acceptance Criteria

* `pytest -k sensor --cov=qmag_nav.sensor` 100 %.
* Throughput benchmark (`pytest -k bench` optional) meets target.

### Links & Dependencies

* Depends on `CalibrationParams` model from **Phase 02**.
* Feeds into mapping + filter phases.
