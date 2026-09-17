"""Server-only fal adapter. Queue POSTs are never automatically retried."""
import copy
from urllib.parse import urlsplit
import httpx
from jsonschema import Draft202012Validator

class ProviderError(Exception):
    pass

class SubmissionUnknown(ProviderError):
    pass

def queue_url(url: str, request_id: str) -> str:
    p = urlsplit(url)
    if p.scheme != "https" or p.hostname != "queue.fal.run" or p.port not in (None, 443) or p.username or p.password or p.fragment or request_id not in p.path.split("/") or ".." in p.path or "%" in p.path:
        raise ProviderError("Invalid provider queue URL")
    return url

def media_url(url: str) -> str:
    p = urlsplit(url)
    h = p.hostname or ""
    allowed = h == "fal.media" or h.endswith(".fal.media") or h == "cdn3.pixelcut.app" or (h == "storage.googleapis.com" and p.path.startswith("/falserverless/"))
    if p.scheme != "https" or not allowed or p.port not in (None, 443) or p.username or p.password or p.fragment:
        raise ProviderError("Untrusted output host")
    return url

class FalProvider:
    def __init__(self, key: str, transport=None):
        self.client = httpx.AsyncClient(timeout=25, follow_redirects=False, transport=transport)
        self.headers = {"Authorization": f"Key {key}", "X-Fal-No-Retry": "1", "X-Fal-Store-IO": "0"}

    async def close(self):
        await self.client.aclose()

    async def preflight(self, endpoint, data, expected_unit):
        try:
            r = await self.client.get("https://api.fal.ai/v1/models", params={"endpoint_id": endpoint, "expand": "openapi-3.0"}, headers=self.headers)
            r.raise_for_status()
            models = r.json().get("models", [])
            model = next((m for m in models if m.get("endpoint_id") == endpoint), None)
            if not model or not model.get("openapi", {}).get("paths"):
                raise ProviderError("Model schema unavailable; generation is disabled")
            spec = model["openapi"]
            path = next((v for k, v in spec["paths"].items() if "post" in v and "requests" not in k), None)
            if not path: raise ProviderError("Model input schema unavailable")
            schema = copy.deepcopy(path["post"]["requestBody"]["content"]["application/json"]["schema"])
            schema["components"] = spec.get("components", {})
            # Never resolve external references from provider metadata.
            def refs(x):
                if isinstance(x, dict):
                    if "$ref" in x and not x["$ref"].startswith("#/"): raise ProviderError("External schema references are disabled")
                    for v in x.values(): refs(v)
                elif isinstance(x, list):
                    for v in x: refs(v)
            refs(schema)
            errors = list(Draft202012Validator(schema).iter_errors(data))
            if errors: raise ProviderError("Provider schema rejected the selected recipe; update the adapter")
            p = await self.client.get("https://api.fal.ai/v1/models/pricing", params={"endpoint_id": endpoint}, headers=self.headers)
            p.raise_for_status()
            price = next((p for p in p.json().get("prices", []) if p.get("endpoint_id") == endpoint), None)
            if not price or price.get("currency") != "USD" or price.get("unit") != expected_unit:
                raise ProviderError("Unknown billing unit; no paid call will be made")
            value = float(price["unit_price"])
            if not 0 < value < 10000: raise ProviderError("Invalid price")
            return value
        except (httpx.HTTPError, ValueError, KeyError, StopIteration) as e:
            raise ProviderError("Live schema or pricing lookup failed; no paid call was made") from e

    async def submit(self, endpoint, data):
        try:
            r = await self.client.post(f"https://queue.fal.run/{endpoint}", json=data, headers=self.headers)
            # A 5xx, interrupted response or unreadable response can follow an accepted job.
            if r.status_code >= 500: raise SubmissionUnknown("Provider submission outcome is unknown; do not retry")
            if r.status_code >= 400: raise ProviderError(f"Provider rejected submission ({r.status_code})")
            body = r.json()
            rid = body["request_id"]
            if not isinstance(rid, str) or not rid or len(rid) > 150: raise ValueError("request id")
            for key in ("response_url", "status_url", "cancel_url"):
                try: queue_url(body[key], rid)
                except ProviderError as e: raise SubmissionUnknown("Accepted response could not be verified; do not retry") from e
            return {key: body[key] for key in ("request_id", "response_url", "status_url", "cancel_url")}
        except (httpx.HTTPError, ValueError, KeyError) as e:
            raise SubmissionUnknown("Provider submission outcome is unknown; do not retry") from e

    async def poll(self, handle):
        try:
            r = await self.client.get(queue_url(handle["status_url"], handle["request_id"]), headers=self.headers)
            r.raise_for_status()
            body = r.json()
            if body.get("status") == "COMPLETED":
                if body.get("error"): return {"status": "failed", "error": "Provider generation failed"}
                result = await self.client.get(queue_url(handle["response_url"], handle["request_id"]), headers=self.headers)
                if result.status_code in (400, 422): return {"status": "failed", "error": "Provider generation rejected"}
                result.raise_for_status()
                return {"status": "completed", "result": result.json()}
            return {"status": "running" if body.get("status") == "IN_PROGRESS" else "queued"}
        except (httpx.HTTPError, ValueError, KeyError) as e:
            raise ProviderError("Status unavailable; the existing request will be polled again") from e

    async def cancel(self, handle):
        r = await self.client.put(queue_url(handle["cancel_url"], handle["request_id"]), headers=self.headers)
        if r.status_code not in (202, 400): raise ProviderError("Cancellation outcome could not be confirmed")
        return "cancel_requested" if r.status_code == 202 else "running"

    async def download(self, url, target):
        total = 0
        async with self.client.stream("GET", media_url(url)) as response:
            response.raise_for_status()
            with target.open("wb") as f:
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > 64 * 1024 * 1024: raise ProviderError("Output exceeds the 64 MiB archive limit")
                    f.write(chunk)
        return total
