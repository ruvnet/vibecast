# Vibecast · Director's Studio

An independent creative studio powered by fal. Start with a brief, create frames and scenes, choose your takes, add narration, and render a review film. Your projects and media stay in your own workspace.

![Vibecast original studio artwork](web/art.svg)

This is working software, not a static dashboard. It includes a responsive dark/light interface, a director workspace, persistent SQLite projects, private media, explicit cost approvals, a durable generation lifecycle, and real FFmpeg exports. It is an original implementation, not affiliated with Higgsfield and not a claim of complete Higgsfield feature parity.

## Run locally

Python 3.12 or 3.13 and FFmpeg/ffprobe are required. Install FFmpeg using your OS package manager first.

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn studio.app:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000`. The default is a **loopback-only simulation**, with no fal credential and no provider spending. Simulation images and clips are labeled procedural fixtures; simulated narration is a tone, not speech. This exercises real persistence, approvals, ownership, media handling, and export without pretending to demonstrate AI quality.

### Your first film

1. Select **First contact**, then **Review cost**. Approve the zero-cost simulation and wait for the take.
2. Create a film, choose the take in the director monitor, and write narration. Create the narration, approve its quote, then choose **Use take**.
3. Add and reorder shots, select visual media for each shot, and save. **Export film** produces a playable H.264/AAC MP4. **Cut manifest** downloads the project JSON and authored SRT captions.

Nothing replaces a selected take automatically. Each paid request requires its own approval. New variations require a new quote, not a hidden retry.

## What works

| Area | Delivered capability |
| --- | --- |
| Create | FLUX.1 Schnell images; Wan 2.2 text/video and reference animation; Kokoro preset narration; Pixelcut transparent cutouts |
| Direction | 8 original presets, editable prompts, camera/lens/light, shared visual constraints, format, shot ordering, narration, selected takes |
| Production | Up to 24 shots and 180 seconds per review film; 24 fps export; H.264/AAC; portrait, square and landscape; source audio is replaced by the selected narration or silence |
| Media | Validated uploads, decoded PNG references, preserved alpha, private authenticated downloads, local archival, provenance hashes |
| Brand | Owned brand kits and named character/product/environment references; prompt constraints, not identity training |
| Governance | Owner checks, CSRF and Host validation, immutable quotes, atomic daily reservations, deduplication, cancellation tracking, unknown-outcome quarantine, audit log |
| MCP | Five tools using the same authorization and approval services: catalog, quote, job, approve and cancel |

Video recipes currently fix generation to 480p and bounded 3/5/8-second clips; review exports normalize to 720p. Export is assembly, not generative resolution enhancement. Reference animation uses the chosen aspect ratio. Narration uses built-in preset voices, not voice cloning.

## Live fal mode

Configure secrets in your process or deployment secret manager, never in the browser or repository. See `.env.example`. The app does not load that file automatically; source it through your process manager or Docker `--env-file` after setting values securely.

Required settings:

* `VIBECAST_MODE=live`
* `VIBECAST_ORIGIN=https://your-studio.example` matching the external origin exactly
* `FAL_KEY` as a server-side fal API key
* `VIBECAST_TOKENS` as a JSON object mapping workspace names to unique random access tokens of at least 32 characters

Generate access tokens with `python -c 'import secrets; print(secrets.token_urlsafe(32))'`. Share them through a secure channel, not a public issue or chat. Each token maps to one isolated workspace. Tokens are not a substitute for enterprise SSO. The browser exchanges its studio token for a Secure, HttpOnly, SameSite cookie. Changing the configured token invalidates existing sessions on the next authenticated read.

Run **one application worker** behind an HTTPS reverse proxy that preserves the original Host header. Keep its internal port private. Persist and back up the entire data directory. A Linux Dockerfile is included. Its default port is bound to loopback by the example command:

```sh
docker build -t vibecast .
docker volume create vibecast-data
docker run --rm --name vibecast --env-file .env \
  -p 127.0.0.1:8000:8000 -v vibecast-data:/app/data vibecast
```

Docker localhost simulation cannot be accessed through a bridged container because the server intentionally rejects non-loopback clients. Use the Python local run for simulation; the Docker path is for live mode behind an HTTPS reverse proxy.

### Cost controls are reservations, not settled bills

At live quote creation, Vibecast fetches the exact endpoint's current OpenAPI schema and price, verifies its billing unit, and validates the fixed recipe. An unknown schema/unit fails closed. Quotes expire after 120 seconds. Billing quantities are conservative and rounded up; a further 25% buffer is reserved.

Default caps are $2 per request and $10 per workspace per UTC day. These are studio reservation caps, **not a guarantee that the provider's invoice cannot exceed an estimate**. Account pricing, provider billing changes and inference settings can still differ. Reconcile against fal usage. Interrupted submissions never trigger another paid POST. Running cancellations may still complete and be billed; reservations remain conservatively held even after failure or cancellation.

## Verify

```sh
pip install -r requirements-dev.txt
python -m pytest tests/test_studio.py -q
python -m playwright install chromium
python tests/browser_flow.py
python scripts/benchmark.py
```

The browser test runs an ephemeral real HTTP server. It creates a two-shot sequence, attaches narration, exports and inspects the review film, uploads a reference, applies a brand kit, and checks mobile layouts. It leaves screenshots, a test film and a JSON report under `evidence/`.

For an explicitly network-disabled browser environment, `OFFLINE_BROWSER=1 CHROMIUM_EXECUTABLE=/usr/bin/chromium python tests/browser_flow.py` loads local HTML and bridges requests through Python to that same HTTP server. It does not alter browser administrator policies. Its report identifies this alternate transport; it is not reported as native browser-network coverage.

`python scripts/live_smoke.py --approve-usd 0.01` performs **one paid image request** through the application's real quote/approval/archival path when `FAL_KEY` is available. It refuses an estimate above the supplied reservation ceiling. It does not run in ordinary CI. No automatic retry follows an ambiguous submission.

## Coordination and deployment boundaries

`scripts/coordinate.sh` uses the pinned RuFlo 3.42.2 CLI for local swarm/task/memory coordination, then records evidence from actual test results. It does not publish to a federation, start unbounded agents, or promote code to main. GitHub CI can run it explicitly with `workflow_dispatch`. See [coordination provenance](docs/COORDINATION.md).

This build targets a small trusted studio on one instance. It does **not** claim enterprise multi-instance readiness, frame-accurate nonlinear editing, motion transfer, 3D creation, arbitrary provider models, guaranteed likeness continuity, music generation, automated social publishing, or provider invoice settlement. Those have explicit design gates in [the capability matrix](docs/PARITY.md).

Architecture, state invariants, limits and review risks: [ADR 001](docs/ADR-001.md). Reproducible local results: [validation](docs/VALIDATION.md). Provider contracts: [sources](docs/SOURCES.md).

## License

MIT, as specified in the existing repository license. Vibecast artwork and presets in this change are original. Uploaded media and provider outputs remain subject to applicable model licenses, provider terms, and the rights in the supplied material.
