# Validation evidence

Local execution: 2026-09-17. Python 3.13.5; system Chromium through Playwright; FFmpeg/ffprobe. All provider execution in this local suite was simulated or mocked. No paid model result is represented as verified here.

## Executed

* 62 pytest cases passed. The suite covers five recipe lifecycles, strict inputs, explicit approval, immutable idempotency, concurrent approval, expiry, mode binding, daily/per-job reservation refusal, unknown submissions, crash recovery, cancellation, archival retry, output safety refusal, alpha preservation, cross-tenant HTTP/MCP denial, secure sessions/revocation, CSRF/Host controls, upload/container validation, conservative billing quantities and actual FFmpeg output.
* Browser acceptance passed 15 checks with zero browser page errors. It selected an original preset, approved a quote, archived an image, created a film, attached narration, edited two shots, exported a playable H.264/AAC film, uploaded a reference, created a named element, applied a brand kit, and checked desktop/light/mobile views with no horizontal overflow.
* Exported acceptance film: 8.021333 seconds. The roughly 0.021-second difference from the authored eight seconds is container/audio timing overhead. It contains clearly labeled procedural fixtures and a tone, not real fal-generated footage or speech.
* Control-plane benchmark: 100 samples after ten warmups. Local FastAPI TestClient `/api/session`: median 1.336 ms, p95 1.756 ms, maximum 2.988 ms in that run. This excludes TCP, rendering, provider queue and inference. It is not a production performance or quality claim.
* Python compile checks and JavaScript syntax validation passed.

## Browser transport qualification

The build container's Chromium installation blocks browser networking by administrator policy. No policy was changed. The local test loaded the actual HTML/CSS/JS offline and bridged fetch to a real ephemeral HTTP server through Python. Backend HTTP behavior and browser UI behavior were exercised together, but native browser networking/cookie transport was not proven by that run. The same test defaults to native browser HTTP in GitHub CI. The browser report labels its transport explicitly. Cookie security and revocation were independently exercised with FastAPI TestClient in live configuration using a mocked provider.

## Not established by these results

A credential-backed paid fal run through the application; production hosting; real queue latency; creative quality; prompt adherence; identity continuity; provider invoice settlement; multi-instance safety; Docker image build; autonomous coding-agent completion; or ruOS deployment. `scripts/live_smoke.py` is a bounded executable live acceptance path, not evidence it already ran.

The earlier ruOS task initialization is recorded in COORDINATION.md. It does not count as application implementation. GitHub CI and RuFlo execution must be reported from their actual run results, separately from the local evidence above.

## Bugs found and fixed during validation

The review-monitor overlay intercepted its own media button. Structural shot edits recaptured stale inspector fields. Pixelcut returned a singular image field and defaulted to inline output. PNG normalization discarded transparency. Square image billing quantities were understated. Successful but invalid queue responses could be classified too optimistically. Repeated identical status polls spammed the audit log and could starve newer jobs. Upload formats required explicit demuxer constraints to reject disguised playlists. Tests now cover the corresponding backend invariants; browser acceptance covers the blocked button and shot-edit flow.
