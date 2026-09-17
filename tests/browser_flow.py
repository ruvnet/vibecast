"""Run the actual UI against an ephemeral HTTP server; never uses paid models.

For browser installations with administrator-disabled networking, OFFLINE_BROWSER=1
loads local HTML and bridges fetch to the same HTTP server through Python. No browser
network policy is changed. Normal CI exercises unmodified browser HTTP transport.
"""
import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

import httpx
from PIL import Image
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.getenv('EVIDENCE_DIR',str(ROOT/'evidence')));OUT.mkdir(exist_ok=True)
ORIGIN='http://127.0.0.1:8765'

def main():
    offline=os.getenv('OFFLINE_BROWSER')=='1'
    with tempfile.TemporaryDirectory() as td:
        log=open(Path(td)/'server.log','w')
        env={**os.environ,'VIBECAST_DATA':td,'VIBECAST_MODE':'demo','VIBECAST_ORIGIN':ORIGIN,'VIBECAST_TOKENS':'{}'}
        server=subprocess.Popen([sys.executable,'-m','uvicorn','studio.app:app','--host','127.0.0.1','--port','8765'],cwd=ROOT,env=env,stdout=log,stderr=log)
        try:
            for _ in range(60):
                try:
                    if httpx.get(ORIGIN+'/healthz').status_code==200:break
                except httpx.ConnectError:pass
                time.sleep(.2)
            else:raise RuntimeError('Test HTTP server did not start')
            with sync_playwright() as pw:
                executable=os.getenv('CHROMIUM_EXECUTABLE')
                if not executable and offline:executable=shutil.which('chromium')
                browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
                context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
                page=context.new_page();page.set_default_timeout(7000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                if offline:
                    def bridge(url,opts):
                        if not url.startswith('/api/') and url!='/mcp':raise ValueError('Test transport allows only local studio API routes')
                        headers={'Origin':ORIGIN,**opts.get('headers',{})}
                        if opts.get('form'):
                            files={f['key']:(f['name'],base64.b64decode(f['data']),f['type']) for f in opts['form']}
                            r=httpx.request(opts.get('method','GET'),ORIGIN+url,headers=headers,files=files,timeout=120)
                        else:r=httpx.request(opts.get('method','GET'),ORIGIN+url,headers=headers,content=opts.get('body'),timeout=120)
                        return {'status':r.status_code,'body':base64.b64encode(r.content).decode(),'headers':dict(r.headers)}
                    page.expose_function('serverFetch',bridge)
                    html=(ROOT/'web/index.html').read_text().replace('<script src="/studio.js" defer></script>','').replace('<link rel="stylesheet" href="/studio.css">','').replace('<link rel="icon" href="/art.svg" type="image/svg+xml">','')
                    page.set_content(html)
                    art='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'web/art.svg').read_bytes()).decode()
                    css=(ROOT/'web/studio.css').read_text().replace('/art.svg',art)
                    page.add_style_tag(content=css)
                    page.evaluate('''() => {
                      if (!crypto.randomUUID) crypto.randomUUID=()=>{const a=crypto.getRandomValues(new Uint8Array(16));return Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');};
                      const mem=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)}});
                      const decode = b => Uint8Array.from(atob(b), c=>c.charCodeAt(0));
                      window.fetch = async (url,opts={}) => {
                        let request={method:opts.method||'GET',headers:opts.headers||{},body:opts.body};
                        if(opts.body instanceof FormData){request.body=undefined;request.form=[];for(const [key,f] of opts.body.entries()){const bytes=new Uint8Array(await f.arrayBuffer());let str='';for(const n of bytes)str+=String.fromCharCode(n);request.form.push({key,name:f.name,type:f.type,data:btoa(str)});}}
                        const r=await window.serverFetch(String(url),request);return new Response(decode(r.body),{status:r.status,headers:r.headers});
                      };
                      const update=()=>document.querySelectorAll('img[src^="/api/"],video[src^="/api/"],audio[src^="/api/"]').forEach(async el=>{const src=el.getAttribute('src');el.removeAttribute('src');const r=await window.serverFetch(src,{});el.src='data:'+r.headers['content-type']+';base64,'+r.body;});
                      new MutationObserver(update).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
                    }''')
                    page.add_script_tag(content=(ROOT/'web/studio.js').read_text())
                else:page.goto(ORIGIN,wait_until='networkidle')
                page.wait_for_selector('.hero')
                page.screenshot(path=str(OUT/'studio-desktop.png'),full_page=True)
                assert page.locator('.preset-card').count()==8
                page.locator('[data-preset="first-contact"]').click()
                expect(page.locator('#prompt')).to_have_value(__import__('re').compile('.*colossal.*'))
                print('STEP quote',flush=True);page.locator('#quoteButton').click();page.wait_for_timeout(200);print('TOAST',page.locator('#toast').inner_text(),flush=True);page.wait_for_selector('[data-approve]')
                assert httpx.get(ORIGIN+'/api/jobs').json()[0]['status']=='quoted'
                page.locator('[data-approve]').click()
                page.wait_for_selector('[data-use-job]',timeout=30000);print('STEP image complete',flush=True)
                print('STEP new film',flush=True);page.locator('#projectShortcut').click();print('STEP modal open',flush=True);page.locator('#projectForm input[name="name"]').fill('First contact / browser acceptance')
                page.locator('#projectForm button[type="submit"]').click();print('STEP film submitted',flush=True);page.wait_for_selector('.director-grid')
                print('STEP choosing',flush=True);page.locator('[data-action="choose-take"]').first.click();print('STEP chooser open',flush=True);page.locator('[data-select-asset]').first.click()
                page.wait_for_selector('.monitor img');print('STEP image attached',flush=True)
                page.locator('#shot-narration').fill('There is a world beyond the frame.')
                print('STEP voice',flush=True);page.locator('[data-shot-generate="voice"]').click();page.wait_for_selector('[data-approve]');page.locator('[data-approve]').click()
                page.wait_for_selector('[data-use-job]',timeout=30000);page.locator('[data-use-job]').first.click()
                expect(page.locator('.success-text')).to_contain_text('Narration take attached')
                page.locator('[data-action="add-shot"]').last.click();page.wait_for_selector('#shot-title')
                page.locator('#shot-title').fill('The discovery');page.locator('#shot-duration').fill('3')
                print('STEP choosing',flush=True);page.locator('[data-action="choose-take"]').first.click();print('STEP chooser open',flush=True);page.locator('[data-select-asset]').filter(has=page.locator('img')).first.click()
                page.locator('[data-action="save-project"]').click()
                page.wait_for_timeout(200)
                # Choose a visual asset explicitly; never attach an audio file as shot visual.
                film=httpx.get(ORIGIN+'/api/projects').json()[0]
                assert len(film['shots'])==2 and all(s['asset_id'] for s in film['shots']),film
                page.screenshot(path=str(OUT/'studio-director.png'),full_page=True)
                page.locator('[data-action="export"]').click();page.wait_for_selector('.preview-media video',timeout=120000);print('STEP export complete',flush=True)
                expect(page.locator('#dialogTitle')).to_contain_text('review film')
                exported=next(a for a in httpx.get(ORIGIN+'/api/assets').json() if a['provenance']['mode']=='export')
                assert abs(exported['duration']-8)<.25
                (OUT/'acceptance-review.mp4').write_bytes(httpx.get(ORIGIN+'/api/assets/'+exported['id']+'/file').content)
                page.locator('#closeDialog').click()
                # Upload and ownership-backed reference library.
                png=Path(td)/'reference.png';Image.new('RGBA',(320,180),(40,80,55,128)).save(png)
                page.locator('#fileInput').set_input_files(str(png));page.wait_for_function("S.assets.some(a => a.name === 'reference.png')")
                page.locator('.sidebar [data-view="elements"]').click()
                page.locator('#elementForm input[name="name"]').fill('Explorer continuity')
                assets=httpx.get(ORIGIN+'/api/assets').json();a=next(a for a in assets if a['name']=='reference.png')
                page.locator('#elementForm select[name="asset_id"]').select_option(a['id'])
                page.locator('#elementForm button[type="submit"]').click();page.wait_for_selector('[data-use-element]')
                page.locator('.sidebar [data-view="brands"]').click()
                page.locator('#brandForm input[name="name"]').fill('Cognitum original')
                page.locator('#brandForm input[name="palette"]').fill('#D5EEA2, #101110')
                page.locator('#brandForm textarea[name="voice"]').fill('Precise and human.')
                page.locator('#brandForm button[type="submit"]').click();page.wait_for_selector('[data-use-brand]')
                page.locator('[data-use-brand]').click();page.wait_for_selector('.director-grid')
                expect(page.locator('#project-look')).to_have_value(__import__('re').compile('.*Cognitum original.*'))
                # Mobile overflow and main navigation, light mode.
                page.set_viewport_size({'width':390,'height':844});page.locator('.mobile-nav [data-view="create"]').click();page.wait_for_selector('.hero')
                assert not page.evaluate('document.documentElement.scrollWidth>window.innerWidth'), 'mobile create overflow'
                page.screenshot(path=str(OUT/'studio-mobile.png'),full_page=True)
                page.locator('.mobile-nav [data-view="director"]').click();page.wait_for_selector('.director-grid')
                assert not page.evaluate('document.documentElement.scrollWidth>window.innerWidth'), 'mobile director overflow'
                page.screenshot(path=str(OUT/'director-mobile.png'),full_page=True)
                page.set_viewport_size({'width':1440,'height':1000});page.locator('.sidebar [data-view="create"]').click()
                page.locator('#themeButton').click();page.screenshot(path=str(OUT/'studio-light.png'),full_page=True)
                assert not errors,errors
                report={'transport':'offline browser with real HTTP API bridge' if offline else 'native browser HTTP','checks':['8 searchable original presets','quote does not dispatch','explicit approval','archived image','project persistence','narration generation and attachment','two-shot edit','8-second H264/AAC film','media upload','owned reference element','brand kit applied','mobile create no overflow','mobile director no overflow','light theme','zero browser page errors'],'export_duration_seconds':exported['duration'],'provider_spend_usd':0,'provider_mode':'simulation','page_errors':errors}
                (OUT/'browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
                browser.close()
        except Exception:
            try:
                print('TOAST',page.locator('#toast').inner_text(), 'ERRORS',errors,flush=True);page.screenshot(path=str(OUT/'failure.png'),full_page=True,timeout=3000)
            except Exception:pass
            raise
        finally:
            server.terminate();server.wait(timeout=10);log.close()

if __name__=='__main__': main()
