# Provider contracts inspected on 2026-09-17

Primary provider references:

* https://fal.ai/docs/documentation/model-apis/inference/queue
* https://fal.ai/docs/platform-apis/v1/models
* https://fal.ai/docs/platform-apis/v1/models/pricing
* https://fal.ai/docs/platform-apis/v1/models/pricing/estimate
* https://fal.ai/docs/documentation/model-apis/fal-cdn
* https://fal.ai/models/fal-ai/flux-1/schnell/api
* https://fal.ai/models/fal-ai/wan/v2.2-a14b/text-to-video/api
* https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/api
* https://fal.ai/models/fal-ai/kokoro/american-english/api
* https://fal.ai/models/pixelcut/background-removal/api

The connected fal schema and pricing tools were used to inspect each of the five execution endpoints. The implementation additionally fetches schema and price during every new live preflight; this document does not freeze the provider API.

Observed unit prices at inspection, not permanent price promises: FLUX Schnell $0.003/megapixel; Wan text/video and image/video $0.08/second; Kokoro $0.02/1000 characters; Pixelcut $0.016/image. Units and account prices must be verified again at runtime. No provider latency or quality rankings are inferred from popularity.

Queue POST responses supply canonical request URLs. A cancelled running job may still complete and incur cost. `X-Fal-No-Retry: 1` requests no platform automatic retries. `X-Fal-Store-IO: 0` requests no stored request/response payload. Generated provider media URLs can be public until their provider retention expiry, so the browser gallery uses locally archived authenticated media instead.

The user-provided Higgsfield capability inventory informed the scope matrix: models, preflight costs, presets, brand kits, reference elements, generation lifecycle, video tools and 3D. The inventory was treated as feature context, not as code, permission to impersonate the service, or proof that any unimplemented feature exists here.
