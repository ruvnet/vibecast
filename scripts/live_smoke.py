"""One explicitly budget-approved paid fal image, through the actual app service."""
import argparse
import asyncio
from decimal import Decimal
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from studio.app import Config, Service, Approval
from studio.catalog import Generation

async def run(ceiling):
    if not os.getenv('FAL_KEY'):raise SystemExit('FAL_KEY is absent. Set it through a secure server environment, not in chat.')
    root=Path('evidence/live-smoke').resolve()
    cfg=Config(root=root,mode='live',origin='https://localhost',key=os.environ['FAL_KEY'],tokens={'smoke':secrets.token_urlsafe(32)},job_micros=ceiling,daily_micros=ceiling,worker=False)
    cfg.validate();svc=Service(cfg)
    try:
        q=await svc.quote('smoke',Generation(prompt='A monumental stone gateway in the desert at golden hour, cinematic composition, no text.',idempotency_key=secrets.token_hex(16)))
        print(json.dumps({'quoted_reservation_usd':q['approval_micros']/1000000,'approved_ceiling_usd':ceiling/1000000,'model':q['model']}))
        j=await svc.approve('smoke',q['id'],Approval(approved=True,max_cost_micros=q['approval_micros']))
        deadline=time.monotonic()+180
        while j['status'] in ('queued','running','archiving') and time.monotonic()<deadline:
            await asyncio.sleep(2);j=await svc.refresh('smoke',j['id'])
        report={'status':j['status'],'job_id':j['id'],'model':j['model'],'assets':j['assets'],'reserved_micros':j['reserved_micros'],'settled_charge_usd':None}
        (root/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
        if j['status']!='completed':raise SystemExit('Not completed. Existing request retained; inspect saved job. Do not rerun blindly.')
    finally:await svc.provider.close()
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--approve-usd',type=Decimal,required=True);args=parser.parse_args()
    if not args.approve_usd.is_finite() or not Decimal('0')<args.approve_usd<=Decimal('0.05'):parser.error('Approval must be positive and at most $0.05')
    asyncio.run(run(int(args.approve_usd*1000000)))
