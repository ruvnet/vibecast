"""Vibecast: owned projects, immutable quotes, durable fal jobs, and review exports."""
import asyncio
import base64
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_UP
import hashlib
import hmac
import io
import json
import math
import os
from pathlib import Path
import secrets
import shutil
import sqlite3
import time
from typing import Literal
from urllib.parse import urlsplit
import uuid
import zipfile

from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import Field, ValidationError, StrictBool

from .catalog import CATALOG, PRESETS, CAMERAS, Generation, Project, Strict
from .provider import FalProvider, ProviderError, SubmissionUnknown
from .media import demo_media, inspect_media, export_film
from .catalog import build_input

ROOT = Path(__file__).resolve().parent.parent

def uid(): return uuid.uuid4().hex

def packed(x): return json.dumps(x, sort_keys=True, separators=(",", ":"), allow_nan=False)

def fail(code, message): raise HTTPException(code, message)

@dataclass
class Config:
    root: Path = field(default_factory=lambda: Path(os.getenv("VIBECAST_DATA", "data")).resolve())
    mode: str = field(default_factory=lambda: os.getenv("VIBECAST_MODE", "demo"))
    origin: str = field(default_factory=lambda: os.getenv("VIBECAST_ORIGIN", "http://127.0.0.1:8000").rstrip("/"))
    key: str = field(default_factory=lambda: os.getenv("FAL_KEY", ""))
    tokens: dict = field(default_factory=lambda: json.loads(os.getenv("VIBECAST_TOKENS", "{}")))
    daily_micros: int = field(default_factory=lambda: int(Decimal(os.getenv("VIBECAST_DAILY_BUDGET_USD", "10"))*1000000))
    job_micros: int = field(default_factory=lambda: int(Decimal(os.getenv("VIBECAST_JOB_BUDGET_USD", "2"))*1000000))
    worker: bool = True
    def validate(self):
        if self.mode not in ("demo", "live"): raise ValueError("VIBECAST_MODE must be demo or live")
        p = urlsplit(self.origin)
        if p.scheme not in ("http", "https") or not p.hostname or p.path or p.query or p.fragment or p.username:
            raise ValueError("VIBECAST_ORIGIN must be a single origin")
        if self.mode == "live" and (p.scheme != "https" or not self.key or not self.tokens):
            raise ValueError("Live mode requires HTTPS origin, server FAL_KEY and VIBECAST_TOKENS")
        if self.mode == "demo" and p.hostname not in ("localhost", "127.0.0.1", "::1"):
            raise ValueError("Unauthenticated demo must use a loopback origin")
        if any(not isinstance(v, str) or len(v) < 32 for v in self.tokens.values()):
            raise ValueError("Studio access tokens must contain at least 32 characters")
        if self.daily_micros <= 0 or self.job_micros <= 0: raise ValueError("Budgets must be positive")
        self.root.mkdir(parents=True, exist_ok=True)
        self.root.chmod(0o700)
        (self.root/"media").mkdir(exist_ok=True)

class Store:
    def __init__(self, path):
        self.path = path
        with self.tx() as c:
            c.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY, tenant TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created REAL NOT NULL);
            CREATE INDEX IF NOT EXISTS objects_owner ON objects(tenant,kind,created);
            CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, tenant TEXT NOT NULL, idem TEXT NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL, reserve INTEGER NOT NULL DEFAULT 0, dispatched REAL, created REAL NOT NULL, UNIQUE(tenant,idem));
            CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(tenant,created);
            CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, tenant TEXT NOT NULL, token_hash TEXT NOT NULL, expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL, object_id TEXT NOT NULL, event TEXT NOT NULL, at REAL NOT NULL);
            """)
    @contextmanager
    def tx(self):
        c = sqlite3.connect(self.path, timeout=10)
        c.row_factory = sqlite3.Row
        try:
            c.execute("PRAGMA foreign_keys=ON")
            c.execute("BEGIN IMMEDIATE")
            yield c
            c.commit()
        except BaseException:
            c.rollback(); raise
        finally: c.close()
    def object(self, tenant, object_id, kind=None):
        with self.tx() as c:
            r = c.execute("SELECT * FROM objects WHERE id=? AND tenant=?", (object_id, tenant)).fetchone()
        if not r or (kind and r["kind"] != kind): fail(404, "Object not found")
        return {**json.loads(r["data"]), "id": r["id"], "revision": r["revision"]}
    def objects(self, tenant, kind):
        with self.tx() as c:
            rows = c.execute("SELECT * FROM objects WHERE tenant=? AND kind=? ORDER BY created DESC LIMIT 200", (tenant, kind)).fetchall()
        return [{**json.loads(r["data"]), "id": r["id"], "revision": r["revision"]} for r in rows]
    def put(self, tenant, kind, data):
        object_id = uid()
        with self.tx() as c:
            count = c.execute("SELECT COUNT(*) FROM objects WHERE tenant=? AND kind=?", (tenant,kind)).fetchone()[0]
            if count >= 200: fail(409, "Workspace object limit reached")
            c.execute("INSERT INTO objects VALUES(?,?,?,?,1,?)", (object_id,tenant,kind,packed(data),time.time()))
            self.event(c, tenant, object_id, f"{kind}.created")
        return {**data, "id": object_id, "revision": 1}
    @staticmethod
    def event(c, tenant, object_id, event):
        c.execute("INSERT INTO audit(tenant,object_id,event,at) VALUES(?,?,?,?)", (tenant,object_id,event,time.time()))
    def job(self, tenant, job_id):
        with self.tx() as c:
            r = c.execute("SELECT * FROM jobs WHERE id=? AND tenant=?", (job_id,tenant)).fetchone()
        if not r: fail(404, "Job not found")
        return self.jobrow(r)
    @staticmethod
    def jobrow(r):
        return {**json.loads(r["data"]), "id": r["id"], "status": r["status"], "reserved_micros": r["reserve"], "created_at": r["created"]}
    def change(self, tenant, job_id, status, **fields):
        with self.tx() as c:
            r = c.execute("SELECT * FROM jobs WHERE id=? AND tenant=?", (job_id,tenant)).fetchone()
            if not r: fail(404, "Job not found")
            data = {**json.loads(r["data"]), **fields, "last_checked": time.time()}
            c.execute("UPDATE jobs SET data=?,status=? WHERE id=? AND tenant=?", (packed(data),status,job_id,tenant))
            if r["status"] != status: self.event(c,tenant,job_id,f"job.{status}")
        return self.job(tenant,job_id)

class Service:
    def __init__(self, config, provider=None):
        self.cfg = config
        self.store = Store(config.root/"studio.sqlite3")
        self.provider = provider or (FalProvider(config.key) if config.mode == "live" else None)
        self.locks = {}
        self.export_lock = asyncio.Lock()
        # Never resubmit a possibly accepted job after a process crash.
        with self.store.tx() as c:
            c.execute("UPDATE jobs SET status='submission_unknown' WHERE status='submitting'")
    def lock(self, key): return self.locks.setdefault(key, asyncio.Lock())
    def clean_asset(self, a): return {k:v for k,v in a.items() if k != "path"}
    def save_asset(self, tenant, path, name, provenance):
        path, meta = inspect_media(path)
        try:
            size = path.stat().st_size
            info = {**meta,"path":str(path),"name":name[:120],"size":size,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"provenance":provenance}
            object_id = uid()
            # Quota check and insertion share one write transaction across upload workers.
            with self.store.tx() as c:
                rows = c.execute("SELECT data FROM objects WHERE tenant=? AND kind='asset'", (tenant,)).fetchall()
                if len(rows)>=200: fail(409,"Workspace media object limit reached")
                if sum(json.loads(r["data"])["size"] for r in rows)+size > 512*1024*1024: fail(413,"Workspace media quota exceeded")
                c.execute("INSERT INTO objects VALUES(?,?,?,?,1,?)", (object_id,tenant,"asset",packed(info),time.time()))
                self.store.event(c,tenant,object_id,"asset.created")
            return {**info,"id":object_id,"revision":1}
        except BaseException:
            path.unlink(missing_ok=True)
            raise
    def validate_project_assets(self, tenant, project):
        ids = [s.id for s in project.shots]
        if len(ids) != len(set(ids)): fail(422,"Shot IDs must be unique")
        if sum(s.duration for s in project.shots) > 180: fail(422,"Project duration exceeds 180 seconds")
        for s in project.shots:
            for key in ("asset_id","audio_asset_id","reference_id"):
                a = getattr(s,key)
                if a:
                    owned = self.store.object(tenant,a,"asset")
                    if key == "audio_asset_id" and owned["kind"] != "audio": fail(422,"Narration must be audio")
                    if key == "asset_id" and owned["kind"] not in ("image","video"): fail(422,"Shot media must be visual")
                    if key == "reference_id" and owned["kind"] != "image": fail(422,"Reference must be an image")
    def project_create(self, tenant, p):
        self.validate_project_assets(tenant,p)
        return self.store.put(tenant,"project",p.model_dump(exclude={"revision"}))
    def project_save(self, tenant, project_id, p):
        self.validate_project_assets(tenant,p)
        with self.store.tx() as c:
            r = c.execute("SELECT revision FROM objects WHERE id=? AND tenant=? AND kind='project'", (project_id,tenant)).fetchone()
            if not r: fail(404,"Project not found")
            if r["revision"] != p.revision: fail(409,"Project changed in another tab; reload before saving")
            c.execute("UPDATE objects SET data=?,revision=revision+1 WHERE id=? AND tenant=?", (packed(p.model_dump(exclude={"revision"})),project_id,tenant))
            self.store.event(c,tenant,project_id,"project.saved")
        return self.store.object(tenant,project_id,"project")
    def provider_input(self, tenant, generation):
        reference = None
        if generation.reference_id:
            asset = self.store.object(tenant,generation.reference_id,"asset")
            if asset["kind"] != "image": fail(422,"Reference must be an owned image")
            if asset["size"] > 4*1024*1024: fail(422,"Reference image exceeds 4 MiB; resize it before generation")
            reference = "data:image/png;base64,"+base64.b64encode(Path(asset["path"]).read_bytes()).decode()
        try: return build_input(generation,reference)
        except ValueError as e: fail(422,str(e))
    async def quote(self, tenant, generation):
        data = generation.model_dump()
        fingerprint = hashlib.sha256(packed(data).encode()).hexdigest()
        with self.store.tx() as c:
            r = c.execute("SELECT * FROM jobs WHERE tenant=? AND idem=?", (tenant,generation.idempotency_key)).fetchone()
            if r:
                if r["fingerprint"] != fingerprint: fail(409,"Idempotency key was used for different inputs")
                return self.store.jobrow(r)
            n = c.execute("SELECT COUNT(*) FROM jobs WHERE tenant=? AND created>?", (tenant,time.time()-86400)).fetchone()[0]
            if n >= 500: fail(429,"Daily request limit reached")
        if generation.project_id:
            p = self.store.object(tenant,generation.project_id,"project")
            if generation.shot_id and not any(s["id"]==generation.shot_id for s in p["shots"]): fail(404,"Shot not found")
        elif generation.shot_id: fail(422,"A shot must belong to a project")
        payload, units = self.provider_input(tenant,generation)
        model = CATALOG[generation.recipe]
        if self.cfg.mode == "live":
            try: price = await self.provider.preflight(model["endpoint"],payload,model["unit"])
            except ProviderError as e: fail(503,str(e))
            estimate = int((Decimal(str(price))*Decimal(str(units))*1000000).to_integral_value(rounding=ROUND_UP))
        else: price, estimate = 0, 0
        reserve = int((Decimal(estimate)*Decimal("1.25")).to_integral_value(rounding=ROUND_UP))
        if reserve > self.cfg.job_micros: fail(409,"Estimated reservation exceeds the per-job budget; reduce the request")
        job_id = uid()
        body = {"generation":data,"model":model["endpoint"],"kind":model["kind"],"mode":self.cfg.mode,"estimate_micros":estimate,"approval_micros":reserve,"billing_unit":model["unit"],"billing_units":units,"unit_price_usd":price,"expires_at":time.time()+120,"assets":[],"error":None}
        with self.store.tx() as c:
            # A concurrent identical preflight is safe and returns the same quote.
            r = c.execute("SELECT * FROM jobs WHERE tenant=? AND idem=?", (tenant,generation.idempotency_key)).fetchone()
            if r:
                if r["fingerprint"] != fingerprint: fail(409,"Idempotency conflict")
                return self.store.jobrow(r)
            c.execute("INSERT INTO jobs(id,tenant,idem,fingerprint,data,status,created) VALUES(?,?,?,?,?,'quoted',?)", (job_id,tenant,generation.idempotency_key,fingerprint,packed(body),time.time()))
            self.store.event(c,tenant,job_id,"job.quoted")
        return self.store.job(tenant,job_id)
    async def approve(self, tenant, job_id, approval):
        async with self.lock(job_id):
            with self.store.tx() as c:
                row = c.execute("SELECT * FROM jobs WHERE id=? AND tenant=?",(job_id,tenant)).fetchone()
                if not row: fail(404,"Job not found")
                job = self.store.jobrow(row)
                if approval.approved is not True or approval.max_cost_micros != job["approval_micros"]: fail(422,"Explicit approval of this exact reservation is required")
                if job["status"] != "quoted":
                    if job["status"] == "cancelled": fail(409,"Cancelled jobs cannot be approved")
                    return job
                if job["expires_at"] < time.time(): fail(409,"Quote expired; request a new quote")
                if job["mode"] != self.cfg.mode: fail(409,"Execution mode changed; request a new quote")
                day = datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
                reserved = c.execute("SELECT COALESCE(SUM(reserve),0) FROM jobs WHERE tenant=? AND dispatched>=?", (tenant,day)).fetchone()[0]
                if reserved+job["approval_micros"] > self.cfg.daily_micros: fail(409,"Daily reservation budget exceeded")
                c.execute("UPDATE jobs SET status='submitting',reserve=?,dispatched=? WHERE id=? AND tenant=?", (job["approval_micros"],time.time(),job_id,tenant))
                self.store.event(c,tenant,job_id,"job.approved")
            g = Generation(**job["generation"])
            try:
                payload, _ = self.provider_input(tenant,g)
                if self.cfg.mode == "demo":
                    handle = {"request_id":f"demo-{job_id}"}
                else: handle = await self.provider.submit(job["model"],payload)
                return self.store.change(tenant,job_id,"queued",handle=handle,submitted_at=time.time())
            except SubmissionUnknown:
                return self.store.change(tenant,job_id,"submission_unknown",error="Provider may have accepted this job. Do not retry; reconcile in the provider dashboard.")
            except ProviderError as e:
                return self.store.change(tenant,job_id,"failed",error=str(e))
            except Exception:
                # Includes an interruption after dispatch: retain the reservation.
                return self.store.change(tenant,job_id,"submission_unknown",error="Submission outcome is unknown. Automatic resubmission is disabled.")
    async def refresh(self, tenant, job_id):
        async with self.lock(job_id):
            job = self.store.job(tenant,job_id)
            if job["status"] not in ("queued","running","cancel_requested","archiving"): return job
            try:
                if self.cfg.mode == "demo":
                    if time.time()-job.get("submitted_at",0) < 0.4: return job
                    ids=[]
                    count=job["generation"]["count"] if job["kind"]=="image" and job["generation"]["recipe"]=="image" else 1
                    for i in range(count):
                        media = await asyncio.to_thread(demo_media,self.cfg.root/"media",job["kind"],job["generation"]["seed"]+i)
                        dest = self.cfg.root/"media"/(uid()+media.suffix)
                        shutil.copyfile(media,dest)
                        a = await asyncio.to_thread(self.save_asset,tenant,dest,job["generation"]["prompt"][:70],{"mode":"demo","job_id":job_id,"notice":"Procedural test fixture, not AI output; demo audio is a tone, not speech"})
                        ids.append(a["id"])
                    return self.store.change(tenant,job_id,"completed",assets=ids,completed_at=time.time())
                state = await self.provider.poll(job["handle"])
                if state["status"] == "failed": return self.store.change(tenant,job_id,"failed",error=state["error"])
                if state["status"] != "completed":
                    return self.store.change(tenant,job_id,"cancel_requested" if job["status"]=="cancel_requested" else state["status"])
                result = state["result"]
                if any(result.get("has_nsfw_concepts",[])): return self.store.change(tenant,job_id,"failed",error="Provider safety check blocked the output")
                outputs = result.get("images") or [result.get("image") or result.get("video") or result.get("audio") or {"url":result.get("audio_url")}]
                if not outputs or len(outputs)>4 or any(not isinstance(o,dict) or not o.get("url") for o in outputs): raise ProviderError("Provider returned no supported media")
                # A completed provider job is never rerun if archival fails.
                self.store.change(tenant,job_id,"archiving")
                ids = list(job.get("assets",[]))
                for output in outputs[len(ids):]:
                    ext = {"image":".png","video":".mp4","audio":".wav"}[job["kind"]]
                    if job["kind"] == "audio" and urlsplit(output["url"]).path.lower().endswith(".mp3"): ext=".mp3"
                    path = self.cfg.root/"media"/(uid()+ext)
                    try:
                        await self.provider.download(output["url"],path)
                        a = await asyncio.to_thread(self.save_asset,tenant,path,job["generation"]["prompt"][:70],{"mode":"live","provider":"fal","model":job["model"],"job_id":job_id,"request_id":job["handle"]["request_id"]})
                    except BaseException:
                        path.unlink(missing_ok=True); raise
                    ids.append(a["id"])
                    self.store.change(tenant,job_id,"archiving",assets=ids)
                return self.store.change(tenant,job_id,"completed",assets=ids,error=None,completed_at=time.time())
            except Exception:
                return self.store.change(tenant,job_id,job["status"] if job["status"]=="cancel_requested" else "archiving" if job["status"]=="archiving" else "running",error="Status or media archival temporarily unavailable. Existing request retained; no resubmission.")
    async def cancel(self, tenant, job_id):
        async with self.lock(job_id):
            job = self.store.job(tenant,job_id)
            if job["status"]=="quoted" or (self.cfg.mode=="demo" and job["status"] in ("queued","running")):
                return self.store.change(tenant,job_id,"cancelled")
            if job["status"] in ("completed","failed","cancelled","submission_unknown"): return job
            try: status = await self.provider.cancel(job["handle"])
            except Exception: fail(503,"Cancellation could not be confirmed; keep tracking this same job")
            return self.store.change(tenant,job_id,status)
    async def worker(self):
        while True:
            with self.store.tx() as c:
                rows = c.execute("SELECT id,tenant FROM jobs WHERE status IN ('queued','running','cancel_requested','archiving') ORDER BY COALESCE(json_extract(data, '$.last_checked'),0) LIMIT 12").fetchall()
            for row in rows:
                try: await self.refresh(row["tenant"],row["id"])
                except asyncio.CancelledError: raise
                except Exception: pass
            await asyncio.sleep(2)

class Approval(Strict):
    approved: StrictBool
    max_cost_micros: int = Field(ge=0, le=100000000)

class Login(Strict):
    token: str = Field(min_length=1,max_length=256)

class Brand(Strict):
    name: str = Field(min_length=1,max_length=100)
    voice: str = Field(default="",max_length=1500)
    palette: list[str] = Field(default_factory=list,max_length=8)
    notes: str = Field(default="",max_length=3000)

class Element(Strict):
    name: str = Field(min_length=1,max_length=100)
    category: Literal["character","product","environment"] = "character"
    description: str = Field(default="",max_length=2000)
    asset_id: str


def create_app(config=None, provider=None):
    cfg = config or Config()
    cfg.validate()
    svc = Service(cfg,provider)
    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(svc.worker()) if cfg.worker else None
        yield
        if task:
            task.cancel()
            try: await task
            except asyncio.CancelledError: pass
        if svc.provider and hasattr(svc.provider,"close"): await svc.provider.close()
    app = FastAPI(title="Vibecast Studio", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.service = svc
    limits = {}
    expected_host = urlsplit(cfg.origin).netloc

    def authenticate(request):
        auth = request.headers.get("authorization","")
        if auth.startswith("Bearer "):
            token = auth[7:]
            for tenant, known in cfg.tokens.items():
                if hmac.compare_digest(hashlib.sha256(token.encode()).digest(),hashlib.sha256(known.encode()).digest()): return tenant
            fail(401,"Invalid studio access token")
        if cfg.mode == "demo":
            if request.client and request.client.host not in ("127.0.0.1","::1","testclient"): fail(403,"Demo is available only on loopback")
            return "demo"
        session = request.cookies.get("vibecast_session","")
        if session:
            with svc.store.tx() as c:
                r = c.execute("SELECT * FROM sessions WHERE hash=? AND expires>?", (hashlib.sha256(session.encode()).hexdigest(),time.time())).fetchone()
            if r and r["tenant"] in cfg.tokens and hmac.compare_digest(r["token_hash"],hashlib.sha256(cfg.tokens[r["tenant"]].encode()).hexdigest()): return r["tenant"]
        fail(401,"Sign in with a studio access token")

    @app.middleware("http")
    async def guard(request, call_next):
        if request.headers.get("host") != expected_host:
            return JSONResponse({"detail":"Untrusted Host header"},status_code=400)
        if request.method not in ("GET","HEAD","OPTIONS"):
            origin = request.headers.get("origin")
            bearer = request.headers.get("authorization","").startswith("Bearer ")
            if origin != cfg.origin and not (origin is None and bearer):
                return JSONResponse({"detail":"Same-origin request required"},status_code=403)
        try:
            length = int(request.headers.get("content-length","0"))
        except ValueError: return JSONResponse({"detail":"Invalid Content-Length"},status_code=400)
        ceiling = 20*1024*1024 if request.url.path == "/api/assets" else 128*1024
        if length > ceiling: return JSONResponse({"detail":"Request too large"},status_code=413)
        # Enforce streamed body bounds too, not only the caller-supplied length.
        if request.method in ("POST","PUT","PATCH"):
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body)>ceiling: return JSONResponse({"detail":"Request too large"},status_code=413)
            request._body = bytes(body)
        ip = request.client.host if request.client else "unknown"
        bucket = (ip,int(time.time()//60))
        limits[bucket] = limits.get(bucket,0)+1
        if len(limits)>1000:
            now = int(time.time()//60)
            for k in list(limits):
                if k[1]<now: limits.pop(k,None)
        if request.url.path.startswith(("/api/","/mcp")) and limits[bucket]>300:
            return JSONResponse({"detail":"Rate limit exceeded"},status_code=429,headers={"Retry-After":"60"})
        response = await call_next(request)
        response.headers["X-Content-Type-Options"]="nosniff"
        response.headers["Referrer-Policy"]="no-referrer"
        response.headers["X-Frame-Options"]="DENY"
        response.headers["Content-Security-Policy"]="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        response.headers["Cache-Control"]="no-store" if request.url.path.startswith(("/api/","/mcp")) else "no-cache"
        return response

    @app.exception_handler(Exception)
    async def unexpected(request, exc):
        return JSONResponse({"detail":"Internal operation failed; no automatic generation retry"},status_code=500)

    @app.get("/healthz")
    async def health(): return {"ok":True,"mode":cfg.mode,"version":"0.1.0"}

    @app.get("/api/session")
    async def session(request: Request):
        tenant = authenticate(request)
        day = datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
        with svc.store.tx() as c:
            total=c.execute("SELECT COALESCE(SUM(reserve),0) FROM jobs WHERE tenant=? AND dispatched>=?", (tenant,day)).fetchone()[0]
        return {"tenant":tenant,"mode":cfg.mode,"daily_budget_micros":cfg.daily_micros,"reserved_today_micros":total,"export_available":bool(shutil.which("ffmpeg")),"catalog":CATALOG,"presets":PRESETS,"cameras":CAMERAS}

    @app.post("/api/session")
    async def login(body: Login):
        tenant = next((t for t,v in cfg.tokens.items() if hmac.compare_digest(hashlib.sha256(body.token.encode()).digest(),hashlib.sha256(v.encode()).digest())),None)
        if not tenant: fail(401,"Invalid studio access token")
        token = secrets.token_urlsafe(32)
        with svc.store.tx() as c:
            c.execute("DELETE FROM sessions WHERE expires<?",(time.time(),))
            c.execute("INSERT INTO sessions VALUES(?,?,?,?)",(hashlib.sha256(token.encode()).hexdigest(),tenant,hashlib.sha256(body.token.encode()).hexdigest(),time.time()+28800))
        response = JSONResponse({"ok":True})
        response.set_cookie("vibecast_session",token,httponly=True,secure=True,samesite="strict",max_age=28800)
        return response

    @app.delete("/api/session")
    async def logout(request: Request):
        token=request.cookies.get("vibecast_session","")
        with svc.store.tx() as c: c.execute("DELETE FROM sessions WHERE hash=?",(hashlib.sha256(token.encode()).hexdigest(),))
        response=JSONResponse({"ok":True}); response.delete_cookie("vibecast_session"); return response

    @app.get("/api/projects")
    async def projects(request: Request): return svc.store.objects(authenticate(request),"project")
    @app.post("/api/projects")
    async def new_project(body: Project, request: Request): return svc.project_create(authenticate(request),body)
    @app.get("/api/projects/{project_id}")
    async def project(project_id: str, request: Request): return svc.store.object(authenticate(request),project_id,"project")
    @app.put("/api/projects/{project_id}")
    async def save_project(project_id: str, body: Project, request: Request): return svc.project_save(authenticate(request),project_id,body)

    @app.get("/api/brands")
    async def brands(request: Request): return svc.store.objects(authenticate(request),"brand")
    @app.post("/api/brands")
    async def brand(body: Brand,request: Request): return svc.store.put(authenticate(request),"brand",body.model_dump())
    @app.get("/api/elements")
    async def elements(request: Request): return svc.store.objects(authenticate(request),"element")
    @app.post("/api/elements")
    async def element(body: Element,request: Request):
        tenant=authenticate(request)
        a=svc.store.object(tenant,body.asset_id,"asset")
        if a["kind"]!="image": fail(422,"Reference elements require an image")
        return svc.store.put(tenant,"element",body.model_dump())

    @app.get("/api/assets")
    async def assets(request: Request): return [svc.clean_asset(a) for a in svc.store.objects(authenticate(request),"asset")]
    @app.post("/api/assets")
    async def upload(request: Request, file: UploadFile=File(...)):
        tenant=authenticate(request)
        suffix=Path(file.filename or "").suffix.lower()
        if suffix not in (".png",".jpg",".jpeg",".webp",".mp4",".webm",".wav",".mp3",".m4a"): fail(422,"Unsupported media type")
        path=cfg.root/"media"/(uid()+suffix)
        try:
            size=0
            with path.open("wb") as f:
                while chunk:=await file.read(65536):
                    size+=len(chunk)
                    if size>16*1024*1024: fail(413,"Upload exceeds 16 MiB")
                    f.write(chunk)
            if not size: fail(422,"Empty file")
            a=await asyncio.to_thread(svc.save_asset,tenant,path,file.filename or "Upload",{"mode":"uploaded","rights":"User supplied; verify likeness and usage rights before publication"})
            return svc.clean_asset(a)
        except HTTPException: path.unlink(missing_ok=True); raise
        except Exception:
            path.unlink(missing_ok=True); fail(422,"Media could not be decoded or exceeded limits")
    @app.get("/api/assets/{asset_id}/file")
    async def asset_file(asset_id: str,request: Request):
        a=svc.store.object(authenticate(request),asset_id,"asset")
        return FileResponse(a["path"],media_type=a["mime"])

    @app.post("/api/quotes")
    async def quote(body: Generation, request: Request): return await svc.quote(authenticate(request),body)
    @app.get("/api/jobs")
    async def jobs(request: Request):
        tenant=authenticate(request)
        with svc.store.tx() as c: rows=c.execute("SELECT * FROM jobs WHERE tenant=? ORDER BY created DESC LIMIT 100",(tenant,)).fetchall()
        return [svc.store.jobrow(r) for r in rows]
    @app.get("/api/jobs/{job_id}")
    async def job(job_id: str, request: Request): return svc.store.job(authenticate(request),job_id)
    @app.post("/api/jobs/{job_id}/approve")
    async def approve(job_id: str, body: Approval, request: Request): return await svc.approve(authenticate(request),job_id,body)
    @app.post("/api/jobs/{job_id}/refresh")
    async def refresh(job_id: str, request: Request): return await svc.refresh(authenticate(request),job_id)
    @app.post("/api/jobs/{job_id}/cancel")
    async def cancel(job_id: str, request: Request): return await svc.cancel(authenticate(request),job_id)

    @app.get("/api/audit")
    async def audit(request: Request):
        tenant=authenticate(request)
        with svc.store.tx() as c: rows=c.execute("SELECT seq,object_id,event,at FROM audit WHERE tenant=? ORDER BY seq DESC LIMIT 100",(tenant,)).fetchall()
        return [dict(r) for r in rows]

    @app.post("/api/projects/{project_id}/export")
    async def export(project_id: str,request: Request):
        tenant=authenticate(request)
        p=svc.store.object(tenant,project_id,"project")
        owned={a["id"]:a for a in svc.store.objects(tenant,"asset")}
        if svc.export_lock.locked(): fail(409,"An export is already running on this instance")
        async with svc.export_lock:
            try: path=await asyncio.to_thread(export_film,p,owned,cfg.root/"media")
            except Exception: fail(422,"Export failed. Every shot needs selected owned media; ffmpeg must be installed")
            a=await asyncio.to_thread(svc.save_asset,tenant,path,p["name"]+" review film",{"mode":"export","project_id":project_id,"project_revision":p["revision"],"contains_demo":any(owned.get(s.get("asset_id"),{}).get("provenance",{}).get("mode")=="demo" for s in p["shots"])})
            return svc.clean_asset(a)

    @app.get("/api/projects/{project_id}/package")
    async def package(project_id: str, request: Request):
        tenant=authenticate(request)
        p=svc.store.object(tenant,project_id,"project")
        # Portable cut manifest and captions. No remote URLs, auth tokens, or source file paths.
        out=io.BytesIO()
        with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json",json.dumps(p,indent=2))
            z.writestr("README.txt","Vibecast project package. Media files are not embedded. Resolve asset IDs through the authenticated studio API. Captions are authored narration, not forced alignment.\n")
            def stamp(seconds):
                ms=int(seconds*1000); return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"
            clock=0; captions=[]; index=1
            for s in p["shots"]:
                if s["narration"]:
                    captions.append(f"{index}\n{stamp(clock)} --> {stamp(clock+s['duration'])}\n{s['narration']}\n"); index+=1
                clock+=s["duration"]
            z.writestr("captions.srt","\n".join(captions))
        return Response(out.getvalue(),media_type="application/zip",headers={"Content-Disposition":f'attachment; filename="vibecast-{project_id[:8]}.zip"'})

    @app.post("/mcp")
    async def mcp(request: Request):
        """Stateless Streamable HTTP JSON mode; tools use the same service authorization."""
        tenant=authenticate(request)
        try: body=await request.json()
        except ValueError: return JSONResponse({"jsonrpc":"2.0","id":None,"error":{"code":-32700,"message":"Parse error"}},status_code=400)
        if not isinstance(body,dict): return JSONResponse({"jsonrpc":"2.0","id":None,"error":{"code":-32600,"message":"Single request required"}},status_code=400)
        rid=body.get("id")
        if rid is None: return Response(status_code=202)
        method=body.get("method")
        tools=[
            {"name":"studio_catalog","description":"Read the executable recipes and original cinematic presets.","inputSchema":{"type":"object","properties":{},"additionalProperties":False},"annotations":{"readOnlyHint":True}},
            {"name":"studio_quote","description":"Create an owned cost quote without submitting a generation. An explicit approval is a separate action.","inputSchema":Generation.model_json_schema(),"annotations":{"readOnlyHint":False,"destructiveHint":False,"openWorldHint":True}},
            {"name":"studio_job","description":"Read an owned job and its archived asset IDs.","inputSchema":{"type":"object","properties":{"job_id":{"type":"string"}},"required":["job_id"],"additionalProperties":False},"annotations":{"readOnlyHint":True}},
            {"name":"studio_approve","description":"Spend by approving the exact reservation. Call only after the user explicitly approves the quoted amount.","inputSchema":{"type":"object","properties":{"job_id":{"type":"string"},"approved":{"const":True,"type":"boolean"},"max_cost_micros":{"type":"integer","minimum":0}},"required":["job_id","approved","max_cost_micros"],"additionalProperties":False},"annotations":{"readOnlyHint":False,"destructiveHint":False,"openWorldHint":True}},
            {"name":"studio_cancel","description":"Request cancellation of one owned job. Running provider work may still complete and be billed.","inputSchema":{"type":"object","properties":{"job_id":{"type":"string"}},"required":["job_id"],"additionalProperties":False},"annotations":{"readOnlyHint":False,"destructiveHint":True}},
        ]
        try:
            if method=="initialize": result={"protocolVersion":"2025-03-26","capabilities":{"tools":{"listChanged":False}},"serverInfo":{"name":"vibecast","version":"0.1.0"}}
            elif method=="ping": result={}
            elif method=="tools/list": result={"tools":tools}
            elif method=="tools/call":
                params=body.get("params",{}); name=params.get("name"); args=params.get("arguments",{})
                if name=="studio_catalog": value={"models":CATALOG,"presets":PRESETS}
                elif name=="studio_quote": value=await svc.quote(tenant,Generation(**args))
                elif name=="studio_job": value=svc.store.job(tenant,args["job_id"])
                elif name=="studio_approve": value=await svc.approve(tenant,args["job_id"],Approval(approved=args["approved"],max_cost_micros=args["max_cost_micros"]))
                elif name=="studio_cancel": value=await svc.cancel(tenant,args["job_id"])
                else: raise ValueError("Unknown tool")
                result={"content":[{"type":"text","text":packed(value)}],"isError":False}
            else: return {"jsonrpc":"2.0","id":rid,"error":{"code":-32601,"message":"Method not found"}}
        except (HTTPException,ValueError,KeyError,TypeError) as e:
            message=e.detail if isinstance(e,HTTPException) else "Invalid tool arguments"
            result={"content":[{"type":"text","text":str(message)}],"isError":True}
        return {"jsonrpc":"2.0","id":rid,"result":result}

    app.mount("/",StaticFiles(directory=ROOT/"web",html=True),name="web")
    return app

app = create_app()
