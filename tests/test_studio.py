"""Cost, ownership, lifecycle and media integration tests. No paid provider calls."""
import asyncio
import io
import json
from pathlib import Path
import time
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor

import httpx
from PIL import Image
import pytest
from fastapi.testclient import TestClient
from studio.app import Config, Service, create_app
from studio.catalog import Generation, Project, Shot, build_input
from studio.provider import FalProvider, ProviderError, SubmissionUnknown, queue_url, media_url
from studio.media import inspect_media

ORIGIN='https://studio.test'
A='a'*40
B='b'*40

def payload(**values):
    return {'prompt':'An explorer discovers a monumental gateway.','idempotency_key':uuid.uuid4().hex,**values}

class FakeProvider:
    def __init__(self): self.calls=0; self.price=.003; self.unknown=False; self.fail_quote=False; self.downloads=0; self.failed_downloads=0; self.result=None
    async def preflight(self,endpoint,data,unit):
        if self.fail_quote: raise ProviderError('Pricing unavailable')
        return self.price
    async def submit(self,endpoint,data):
        self.calls+=1
        if self.unknown: raise SubmissionUnknown('timeout')
        return {'request_id':'mock-request','status_url':'https://queue.fal.run/fal-ai/model/requests/mock-request/status','response_url':'https://queue.fal.run/fal-ai/model/requests/mock-request','cancel_url':'https://queue.fal.run/fal-ai/model/requests/mock-request/cancel'}
    async def poll(self,handle): return {'status':'completed','result':self.result or {'images':[{'url':'https://fal.media/mock.png'}]}}
    async def cancel(self,handle): return 'cancel_requested'
    async def download(self,url,path):
        self.downloads+=1
        if self.failed_downloads: self.failed_downloads-=1;raise ProviderError('archival interrupted')
        Image.new('RGBA',(64,64),(128,44,22,90)).save(path,'PNG')
    async def close(self): pass

@pytest.fixture
def env(tmp_path):
    provider=FakeProvider()
    cfg=Config(root=tmp_path,mode='live',origin=ORIGIN,key='not-a-real-key',tokens={'alpha':A,'beta':B},worker=False)
    app=create_app(cfg,provider)
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN,'Authorization':'Bearer '+A}) as client:
        yield client,app.state.service,provider

def quote(c,**kw):
    r=c.post('/api/quotes',json=payload(**kw));assert r.status_code==200,r.text;return r.json()

def approve(c,q,**kw): return c.post('/api/jobs/'+q['id']+'/approve',json={'approved':True,'max_cost_micros':q['approval_micros'],**kw})

def upload(c):
    b=io.BytesIO();Image.new('RGBA',(64,32),(255,100,10,44)).save(b,'PNG')
    r=c.post('/api/assets',files={'file':('ref.png',b.getvalue(),'image/png')});assert r.status_code==200,r.text;return r.json()

def project(c,**kw):
    r=c.post('/api/projects',json={'name':'First contact','shots':[{'id':'shot1','duration':2}],**kw});assert r.status_code==200,r.text;return r.json()

def test_no_paid_call_until_explicit_approval(env):
    c,s,p=env;q=quote(c);assert p.calls==0
    assert approve(c,q,approved=False).status_code==422
    assert approve(c,q,approved=1).status_code==422
    assert approve(c,q,max_cost_micros=q['approval_micros']+1).status_code==422
    assert p.calls==0
    assert approve(c,q).json()['status']=='queued';assert p.calls==1

def test_duplicate_and_conflicting_inputs(env):
    c,s,p=env;body=payload();q=c.post('/api/quotes',json=body).json()
    assert c.post('/api/quotes',json=body).json()['id']==q['id']
    assert c.post('/api/quotes',json={**body,'prompt':'Another input'}).status_code==409
    for _ in range(3): assert approve(c,q).status_code==200
    assert p.calls==1

def test_concurrent_approval_calls_provider_once(env):
    c,s,p=env;q=quote(c)
    with ThreadPoolExecutor(max_workers=6) as pool: results=list(pool.map(lambda _:approve(c,q),range(6)))
    assert all(r.status_code==200 for r in results);assert p.calls==1

def test_expiration_mode_change_and_budget(env):
    c,s,p=env;q=quote(c);s.store.change('alpha',q['id'],'quoted',expires_at=0)
    assert approve(c,q).status_code==409
    q=quote(c);s.store.change('alpha',q['id'],'quoted',mode='demo');assert approve(c,q).status_code==409
    p.price=1000;assert c.post('/api/quotes',json=payload()).status_code==409;assert p.calls==0

def test_daily_reservation_is_atomic(env):
    c,s,p=env;q1=quote(c);q2=quote(c);s.cfg.daily_micros=q1['approval_micros']
    assert approve(c,q1).status_code==200;assert approve(c,q2).status_code==409;assert p.calls==1

def test_unknown_submission_never_retries(env):
    c,s,p=env;p.unknown=True;q=quote(c)
    assert approve(c,q).json()['status']=='submission_unknown'
    for _ in range(2): assert approve(c,q).json()['status']=='submission_unknown'
    assert c.post('/api/jobs/'+q['id']+'/refresh').json()['status']=='submission_unknown';assert p.calls==1
    assert s.store.job('alpha',q['id'])['reserved_micros']>0

def test_restart_preserves_unknown(env):
    c,s,p=env;q=quote(c);s.store.change('alpha',q['id'],'submitting')
    restarted=Service(s.cfg,p);assert restarted.store.job('alpha',q['id'])['status']=='submission_unknown';assert p.calls==0

def test_cancel_before_dispatch_and_after_submission(env):
    c,s,p=env;q=quote(c);assert c.post('/api/jobs/'+q['id']+'/cancel').json()['status']=='cancelled'
    assert approve(c,q).status_code==409;assert p.calls==0
    q=quote(c);approve(c,q);assert c.post('/api/jobs/'+q['id']+'/cancel').json()['status']=='cancel_requested'
    assert c.post('/api/jobs/'+q['id']+'/refresh').json()['status']=='completed';assert p.calls==1

def test_archival_retries_not_generations(env):
    c,s,p=env;q=quote(c);approve(c,q);p.failed_downloads=1
    c.post('/api/jobs/'+q['id']+'/refresh')
    r=c.post('/api/jobs/'+q['id']+'/refresh').json();assert r['status']=='completed';assert p.calls==1;assert p.downloads==2
    a=c.get('/api/assets').json()[0];assert 'path' not in a;assert a['provenance']['request_id']=='mock-request'
    assert c.get('/api/assets/'+a['id']+'/file').status_code==200

def test_cutout_shape_and_alpha(env):
    c,s,p=env;a=upload(c);p.result={'image':{'url':'https://fal.media/cutout.png'}}
    q=quote(c,recipe='cutout',reference_id=a['id']);approve(c,q)
    out=c.post('/api/jobs/'+q['id']+'/refresh').json();assert out['status']=='completed'
    pixels=c.get('/api/assets/'+out['assets'][0]+'/file').content
    assert Image.open(io.BytesIO(pixels)).getpixel((0,0))[3]==90

def test_safety_output_is_not_archived(env):
    c,s,p=env;p.result={'has_nsfw_concepts':[True],'images':[{'url':'https://fal.media/rejected.png'}]}
    q=quote(c);approve(c,q);assert c.post('/api/jobs/'+q['id']+'/refresh').json()['status']=='failed';assert p.downloads==0

def test_schema_lookup_failure_never_dispatches(env):
    c,s,p=env;p.fail_quote=True;assert c.post('/api/quotes',json=payload()).status_code==503;assert p.calls==0

@pytest.mark.parametrize('path,method', [('/api/jobs/{q}','GET'),('/api/jobs/{q}/approve','POST'),('/api/jobs/{q}/cancel','POST'),('/api/jobs/{q}/refresh','POST'),('/api/projects/{p}','GET'),('/api/projects/{p}/export','POST'),('/api/projects/{p}/package','GET'),('/api/assets/{a}/file','GET')])
def test_cross_tenant_denial(env,path,method):
    c,s,provider=env;q=quote(c);p=project(c);a=upload(c)
    url=path.format(q=q['id'],p=p['id'],a=a['id'])
    body={'approved':True,'max_cost_micros':q['approval_micros']} if url.endswith('/approve') else None
    r=c.request(method,url,headers={'Authorization':'Bearer '+B},json=body)
    assert r.status_code==404,r.text;assert provider.calls==0

def test_tenant_lists_and_reference_ownership(env):
    c,s,p=env;a=upload(c);project(c);quote(c)
    for route in ('/api/projects','/api/assets','/api/jobs','/api/audit'):
        assert c.get(route,headers={'Authorization':'Bearer '+B}).json()==[]
    assert c.post('/api/quotes',headers={'Authorization':'Bearer '+B},json=payload(recipe='animate',reference_id=a['id'])).status_code==404
    assert c.post('/api/elements',headers={'Authorization':'Bearer '+B},json={'name':'Stolen','asset_id':a['id']}).status_code==404

def test_csrf_host_and_auth(env):
    c,s,p=env
    assert c.post('/api/quotes',headers={'Origin':'https://evil.test'},json=payload()).status_code==403
    assert c.get('/api/session',headers={'Host':'evil.test'}).status_code==400
    assert c.get('/api/session',headers={'Authorization':'Bearer invalid'}).status_code==401
    r=c.get('/api/session');assert r.headers['cache-control']=='no-store';assert 'script-src' in r.headers['content-security-policy']

def test_cookie_login_revocation(env):
    c,s,p=env
    r=c.post('/api/session',json={'token':A});assert r.status_code==200
    assert 'HttpOnly' in r.headers['set-cookie'] and 'Secure' in r.headers['set-cookie'] and 'SameSite=strict' in r.headers['set-cookie']
    c.headers.pop('Authorization');assert c.get('/api/session').status_code==200
    s.cfg.tokens['alpha']='rotated'*8;assert c.get('/api/session').status_code==401

@pytest.mark.parametrize('bad', [{'recipe':'arbitrary/endpoint'}, {'image_url':'http://127.0.0.1/secret'}, {'enable_safety_checker':False}, {'count':99}, {'duration':900}, {'prompt':''}])
def test_invalid_generation_rejected(env,bad):
    c,s,p=env;assert c.post('/api/quotes',json=payload(**bad)).status_code==422;assert p.calls==0

def test_project_revision_and_validation(env):
    c,s,p=env;film=project(c);pid=film.pop('id');assert c.put('/api/projects/'+pid,json=film).status_code==200
    assert c.put('/api/projects/'+pid,json=film).status_code==409
    assert c.post('/api/projects',json={'name':'Dup','shots':[{'id':'one'},{'id':'one'}]}).status_code==422
    assert c.post('/api/projects',json={'name':'Huge','shots':[{'id':str(i),'duration':10} for i in range(24)]}).status_code==422

def test_upload_limits_and_no_active_payload(env):
    c,s,p=env
    for name in ['evil.html','evil.svg','bad.png']:
        assert c.post('/api/assets',files={'file':(name,b'<script>alert(1)</script>','image/png')}).status_code==422
    assert c.post('/api/quotes',content=b'x'*140000,headers={'Content-Type':'application/json'}).status_code==413
    a=upload(c);assert a['width']==64 and a['height']==32

def test_manifest_and_real_video_export(env):
    c,s,p=env;a=upload(c);film=project(c,shots=[{'id':'one','duration':1,'asset_id':a['id'],'narration':'First contact.'},{'id':'two','duration':2,'asset_id':a['id'],'narration':'A new world.'}])
    response=c.post('/api/projects/'+film['id']+'/export');assert response.status_code==200,response.text
    video=response.json();assert video['kind']=='video';assert abs(video['duration']-3)<.2;assert video['width']==1280
    archive=c.get('/api/projects/'+film['id']+'/package')
    z=zipfile.ZipFile(io.BytesIO(archive.content));assert set(z.namelist())=={'project.json','README.txt','captions.srt'}
    assert '00:00:01,000 --> 00:00:03,000' in z.read('captions.srt').decode()
    assert 'not-a-real-key' not in z.read('project.json').decode()

def test_mcp_approval_and_owner_gates(env):
    c,s,p=env
    def call(name,args,token=A):
        return c.post('/mcp',headers={'Authorization':'Bearer '+token},json={'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':args}}).json()['result']
    r=call('studio_quote',payload());q=json.loads(r['content'][0]['text']);assert p.calls==0
    assert call('studio_job',{'job_id':q['id']},B)['isError']
    assert call('studio_approve',{'job_id':q['id'],'approved':False,'max_cost_micros':q['approval_micros']})['isError'];assert p.calls==0
    assert not call('studio_approve',{'job_id':q['id'],'approved':True,'max_cost_micros':q['approval_micros']})['isError'];assert p.calls==1
    tools=c.post('/mcp',json={'jsonrpc':'2.0','id':2,'method':'tools/list'}).json()['result']['tools'];assert len(tools)==5

@pytest.mark.parametrize('url',['http://queue.fal.run/x/id','https://queue.fal.run.evil.test/x/id','https://evil.test/id','https://u:p@queue.fal.run/id','https://queue.fal.run/x/other','https://queue.fal.run/%2f/id'])
def test_queue_url_allowlist(url):
    with pytest.raises(ProviderError):queue_url(url,'id')

@pytest.mark.parametrize('url',['http://fal.media/x','https://fal.media.evil.test/x','http://127.0.0.1/x','file:///etc/passwd','https://storage.googleapis.com/private/x','https://user@fal.media/x'])
def test_media_allowlist(url):
    with pytest.raises(ProviderError):media_url(url)

def test_provider_uses_canonical_urls_and_no_post_retry():
    seen=[]
    def handler(req):
        seen.append((req.method,str(req.url)));assert req.headers['x-fal-no-retry']=='1'
        if req.method=='POST':return httpx.Response(200,json={'request_id':'r1','status_url':'https://queue.fal.run/fal-ai/wan/requests/r1/status','response_url':'https://queue.fal.run/fal-ai/wan/requests/r1','cancel_url':'https://queue.fal.run/fal-ai/wan/requests/r1/cancel'})
        if req.url.path.endswith('status'):return httpx.Response(200,json={'status':'COMPLETED'})
        return httpx.Response(200,json={'video':{'url':'https://fal.media/v.mp4'}})
    async def run():
        provider=FalProvider('fake',httpx.MockTransport(handler));h=await provider.submit('fal-ai/wan/nested/model',{});r=await provider.poll(h);await provider.close();return r
    assert asyncio.run(run())['status']=='completed';assert seen[1][1].endswith('/wan/requests/r1/status');assert len(seen)==3

@pytest.mark.parametrize('status,body', [(500,{}),(200,{}),(200,{'request_id':'r','status_url':'https://evil.test/r','response_url':'https://evil.test/r','cancel_url':'https://evil.test/r'})])
def test_ambiguous_provider_response_is_unknown(status,body):
    async def run():
        p=FalProvider('fake',httpx.MockTransport(lambda r:httpx.Response(status,json=body)))
        try:
            with pytest.raises(SubmissionUnknown):await p.submit('fal-ai/example',{})
        finally:await p.close()
    asyncio.run(run())

def test_provider_live_preflight_exact_units():
    def handler(req):
        if req.url.path.endswith('pricing'):return httpx.Response(200,json={'prices':[{'endpoint_id':'test/model','unit_price':.003,'unit':'megapixels','currency':'USD'}]})
        return httpx.Response(200,json={'models':[{'endpoint_id':'test/model','openapi':{'paths':{'/test/model':{'post':{'requestBody':{'content':{'application/json':{'schema':{'$ref':'#/components/schemas/Input'}}}}}}},'components':{'schemas':{'Input':{'type':'object','required':['prompt'],'properties':{'prompt':{'type':'string'}}}}}}}]})
    async def run():
        p=FalProvider('fake',httpx.MockTransport(handler))
        assert await p.preflight('test/model',{'prompt':'hi'},'megapixels')==.003
        with pytest.raises(ProviderError):await p.preflight('test/model',{},'megapixels')
        with pytest.raises(ProviderError):await p.preflight('test/model',{'prompt':'hi'},'seconds')
        await p.close()
    asyncio.run(run())

def test_recipes_keep_safety_and_conservative_units():
    g=Generation(**payload(aspect='1:1',count=4));data,units=build_input(g);assert units==8;assert data['enable_safety_checker'] is True
    g=Generation(**payload(recipe='video',duration=8));data,units=build_input(g);assert data['num_frames']==129 and units==9;assert data['enable_output_safety_checker']
    g=Generation(**payload(recipe='cutout'));data,units=build_input(g,'data:image/png;base64,AA==');assert data['sync_mode'] is False

@pytest.mark.parametrize('kwargs',[{'mode':'live','origin':'http://studio.test'},{'mode':'demo','origin':'https://public.test'},{'tokens':{'a':'short'}}])
def test_fail_closed_configuration(tmp_path,kwargs):
    with pytest.raises(ValueError):Config(root=tmp_path,**kwargs).validate()

def test_disguised_playlist_cannot_read_local_files(env):
    c,s,p=env
    malicious=b'#EXTM3U\n#EXTINF:2,\nfile:///etc/passwd\n'
    assert c.post('/api/assets',files={'file':('evil.mp4',malicious,'video/mp4')}).status_code==422

def test_unchanged_status_does_not_flood_audit(env):
    c,s,p=env;q=quote(c);approve(c,q)
    before=len(c.get('/api/audit').json())
    for _ in range(10):s.store.change('alpha',q['id'],'queued')
    assert len(c.get('/api/audit').json())==before

def test_mcp_invalid_json_is_parse_error(env):
    c,s,p=env;r=c.post('/mcp',content='{bad',headers={'Content-Type':'application/json'})
    assert r.status_code==400 and r.json()['error']['code']==-32700

@pytest.mark.parametrize('recipe',['image','video','animate','voice','cutout'])
def test_demo_recipe_runs_to_archived_media(tmp_path,recipe):
    app=create_app(Config(root=tmp_path,mode='demo',origin='http://127.0.0.1:8000',worker=False))
    with TestClient(app,base_url='http://127.0.0.1:8000',headers={'Origin':'http://127.0.0.1:8000'}) as c:
        a=upload(c);q=quote(c,recipe=recipe,reference_id=a['id'] if recipe in ('animate','cutout') else None,count=2 if recipe=='image' else 1)
        assert q['approval_micros']==0;approve(c,q)
        app.state.service.store.change('demo',q['id'],'queued',submitted_at=0)
        r=c.post('/api/jobs/'+q['id']+'/refresh').json();assert r['status']=='completed',r
        assert len(r['assets'])==(2 if recipe=='image' else 1)
        assert c.get('/api/assets/'+r['assets'][0]+'/file').status_code==200
