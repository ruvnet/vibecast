"""Local TestClient control-plane latency; not provider inference performance."""
import json
from pathlib import Path
import statistics
import sys
import tempfile
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from studio.app import Config, create_app

def main():
    values=[]
    with tempfile.TemporaryDirectory() as td:
        app=create_app(Config(root=Path(td),mode='demo',origin='http://127.0.0.1:8000',tokens={},worker=False))
        with TestClient(app,base_url='http://127.0.0.1:8000') as c:
            for i in range(110):
                start=time.perf_counter();r=c.get('/api/session');elapsed=(time.perf_counter()-start)*1000
                assert r.status_code==200
                if i>=10:values.append(elapsed)
    ordered=sorted(values)
    result={'scope':'local FastAPI TestClient authenticated demo session endpoint; excludes TCP and inference','samples':len(values),'warmup':10,'p50_ms':round(statistics.median(values),3),'p95_ms':round(ordered[94],3),'maximum_ms':round(max(values),3),'paid_provider_calls':0}
    out=Path('evidence');out.mkdir(exist_ok=True);(out/'benchmark.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
if __name__=='__main__':main()
