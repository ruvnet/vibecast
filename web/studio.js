/* Vibecast browser client. Provider credentials never enter this application. */
'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = m => '$' + (Number(m || 0)/1000000).toFixed(m && m < 10000 ? 4 : 2);
const id = () => crypto.randomUUID().replaceAll('-', '');
const S = {session:null, view:'create', recipe:'image', projects:[], project:null, shot:0, assets:[], jobs:[], brands:[], elements:[], audit:[], prompt:'', aspect:'16:9', duration:5, count:1, voice:'af_heart', reference:'', filter:'All', search:'', camera:'Slow dolly in', busy:false};
const activeStates = new Set(['queued','running','archiving','cancel_requested']);
const fileUrl = a => '/api/assets/' + encodeURIComponent(typeof a === 'string' ? a : a.id) + '/file';
let toastTimer, refreshing = false;
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'),5000); }
async function api(path, method='GET', data) {
  const opts = {method, credentials:'same-origin', headers:{}};
  if (data instanceof FormData) opts.body=data;
  else if (data !== undefined) { opts.body=JSON.stringify(data); opts.headers['Content-Type']='application/json'; }
  const response = await fetch(path,opts);
  let body;
  try { body=await response.json(); } catch (_) { throw new Error('The server did not return a usable response. Check the service status.'); }
  if (!response.ok) throw new Error(typeof body.detail==='string' ? body.detail : 'Some fields are invalid. Check their limits and try again.');
  return body;
}
function modal(title,body) { $('#dialogTitle').textContent=title; $('#dialogBody').innerHTML=body; if (!$('#dialog').open) $('#dialog').showModal(); }
function closeModal() { $('#dialog').close(); }
const option = (v,current,label=v) => `<option value="${esc(v)}" ${v===current?'selected':''}>${esc(label)}</option>`;
const imageOptions = current => '<option value="">Choose an owned reference</option>' + S.assets.filter(a=>a.kind==='image').map(a=>option(a.id,current,a.name)).join('');
function assetTag(a,cls='') {
  if (!a) return '<div class="empty-media">Select a take to see your shot</div>';
  if (a.kind==='video') return `<video class="${cls}" src="${fileUrl(a)}" controls playsinline preload="metadata"></video>`;
  if (a.kind==='audio') return `<div class="audio-art">∿</div><audio src="${fileUrl(a)}" controls preload="metadata"></audio>`;
  return `<img class="${cls}" src="${fileUrl(a)}" alt="${esc(a.name)}" loading="lazy">`;
}
function header(title,subtitle,actions='') { return `<div class="section-heading"><div><p class="eyebrow">YOUR CREATIVE WORKSPACE</p><h1>${title}</h1><p class="muted">${subtitle}</p></div><div class="button-cluster">${actions}</div></div>`; }
function empty(title,text,button='') { return `<div class="empty-state"><div class="empty-symbol">✦</div><h3>${title}</h3><p>${text}</p>${button}</div>`; }
function updateChrome() {
  $('#viewName').textContent=({create:'Creative studio',director:'Director workspace',library:'Media library',elements:'Reference library',brands:'Brand kits',activity:'Activity'})[S.view];
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===S.view));
  if (S.session) {
    $('#modeBadge').textContent=S.session.mode==='demo'?'SIMULATION · NO SPEND':'LIVE · FAL CONNECTED';
    $('#budgetValue').textContent=money(S.session.reserved_today_micros);
    $('#budgetLimit').textContent=`of ${money(S.session.daily_budget_micros)} daily reservation budget`;
    $('#budgetBar').style.width=Math.min(100,S.session.reserved_today_micros/S.session.daily_budget_micros*100)+'%';
  }
}
function captureComposer() {
  if ($('#prompt')) S.prompt=$('#prompt').value;
  for (const [key,selector] of Object.entries({aspect:'#aspect',duration:'#duration',count:'#count',voice:'#voice',reference:'#reference',camera:'#camera'})) if ($(selector)) S[key]=['duration','count'].includes(key)?Number($(selector).value):$(selector).value;
}
function createView() {
  const model=S.session.catalog[S.recipe];
  const settings=`<label class="field">Model<div class="model-select"><span>◈</span>${esc(model.name)}<span class="muted">fal</span></div></label>
  ${S.recipe!=='voice'&&S.recipe!=='cutout'?`<label class="field">Aspect ratio<select id="aspect">${['16:9','9:16','1:1'].map(v=>option(v,S.aspect)).join('')}</select></label>`:''}
  ${S.recipe==='image'?`<label class="field">Variations<select id="count">${[1,2,3,4].map(v=>option(v,S.count,v+' frame'+(v>1?'s':''))).join('')}</select></label>`:''}
  ${['video','animate'].includes(S.recipe)?`<label class="field">Clip length<select id="duration">${[3,5,8].map(v=>option(v,S.duration,v+' seconds')).join('')}</select></label>`:''}
  ${S.recipe==='voice'?`<label class="field">Voice<select id="voice">${[['af_heart','Heart'],['af_bella','Bella'],['am_adam','Adam'],['am_michael','Michael']].map(([v,n])=>option(v,S.voice,n)).join('')}</select></label>`:`<label class="field">Camera direction<select id="camera">${S.session.cameras.map(v=>option(v,S.camera)).join('')}</select></label>`}
  ${['animate','cutout'].includes(S.recipe)?`<label class="field">Reference image<select id="reference">${imageOptions(S.reference)}</select></label><button class="button small secondary" data-action="upload">↑ Upload reference</button>`:''}`;
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span> A STUDIO FOR THE WAY YOU THINK</p><h1>Make something<br>worth <em>watching.</em></h1><p>From the first spark to the final cut. Shape a world, direct every shot, and bring your story to life.</p><div class="button-cluster"><button class="button primary" data-action="new-project">Open the director's chair <span>↗</span></button><button class="text-button" data-action="focus-prompt">Start with a frame →</button></div><div class="hero-meta"><span>IMAGINE</span><i></i><span>DIRECT</span><i></i><span>CREATE</span></div></div><div class="hero-art"><div class="art-corners"></div><div class="art-top"><span>VIBECAST / ORIGINAL ARTWORK</span><span>01 / 08</span></div><div class="art-bottom"><div><small>THE FIRST CONTACT</small><strong>Every world starts with a frame.</strong></div><span class="play-orb">▷</span></div></div></section>
  <section class="composer"><div class="mode-tabs" role="tablist" aria-label="Generation type">${Object.entries({image:'✦ Image',video:'▷ Video',animate:'◉ Animate',voice:'∿ Voice',cutout:'◌ Cutout'}).map(([k,v])=>`<button role="tab" aria-selected="${k===S.recipe}" class="mode-tab ${k===S.recipe?'active':''}" data-recipe="${k}">${v}</button>`).join('')}<span class="composer-hint">A little direction goes a long way.</span></div><div class="composer-grid"><div class="prompt-area"><label for="prompt">${S.recipe==='voice'?'WHAT SHOULD WE SAY?':'WHAT DO YOU WANT TO CREATE?'}</label><textarea id="prompt" maxlength="4000" placeholder="An explorer finds a circular gateway in an endless desert. Late afternoon light. A slow, deliberate push in…">${esc(S.prompt)}</textarea><div class="prompt-meta"><span>✧ Original ideas. Precise direction.</span><span>⌘ / Ctrl + Enter to review</span></div></div><div class="composer-settings">${settings}</div></div><div class="composer-actions"><span class="studio-note">${S.session.mode==='demo'?'◉ Simulation generates labeled test media, not AI output.':'◉ Every generation starts with a live price and your approval.'}</span><button class="button primary" id="quoteButton" data-action="quote">Review cost <span>↗</span></button></div></section>
  <div class="section-heading"><div><p class="eyebrow">A STARTING POINT, NOT A LIMIT</p><h2>Find your next direction.</h2></div><span class="muted small-text">8 original recipes · Illustrative artwork</span></div><div class="filter-bar"><div class="chips">${['All','Cinema','Product','Nature','Portrait','Campaign'].map(v=>`<button class="chip ${S.filter===v?'active':''}" data-filter="${v}">${v}</button>`).join('')}</div><label class="search-box"><span>⌕</span><input id="presetSearch" placeholder="Search directions" value="${esc(S.search)}" aria-label="Search directions"></label></div><div class="preset-grid" id="presetGrid">${presetCards()}</div>
  <div class="section-heading"><div><p class="eyebrow">YOUR CREATIVE TRAIL</p><h2>Recent takes</h2></div><button class="text-button" data-view="activity">View activity ↗</button></div><div id="recentJobs">${jobCards(S.jobs.slice(0,6))}</div>`;
}
function presetCards() {
  const items=S.session.presets.filter(p=>(S.filter==='All'||p.category===S.filter)&&`${p.name} ${p.prompt}`.toLowerCase().includes(S.search.toLowerCase()));
  return items.map(p=>`<button class="preset-card ${esc(p.color)}" data-preset="${esc(p.id)}"><div class="preset-art"><span class="preset-label">${esc(p.category)}</span><span class="preset-arrow">↗</span></div><div class="preset-body"><h3>${esc(p.name)}</h3><p>${esc(p.camera)} <span>·</span> ${esc(p.lens)}</p></div></button>`).join('')||empty('No matching directions','Try another search.');
}
function jobCards(jobs) {
  if (!jobs.length) return empty('Your next great take starts here.','Create a frame or a scene. Every quote and result stays in this workspace.');
  return `<div class="result-grid">${jobs.map(j=>{const a=S.assets.find(a=>a.id===j.assets[0]);return `<article class="result-card"><div class="result-media">${a?assetTag(a):`<div class="job-placeholder ${activeStates.has(j.status)?'processing':''}"><span>${activeStates.has(j.status)?'◌':'✦'}</span><small>${esc(j.status.replaceAll('_',' '))}</small></div>`}</div><div class="result-meta"><div class="job-heading"><span class="label ${j.status==='completed'?'success':''}">${esc(j.status.replaceAll('_',' '))}</span><small>${j.mode==='demo'?'SIMULATION':esc(j.kind.toUpperCase())}</small></div><p title="${esc(j.generation.prompt)}">${esc(j.generation.prompt.slice(0,110))}</p><div class="job-footer"><small>${money(j.reserved_micros)} reserved</small><div class="button-cluster">${a?`<button class="text-button" data-preview="${a.id}">Open ↗</button><button class="text-button" data-use-job="${j.id}">Use take</button>`:''}${j.status==='quoted'?`<button class="text-button" data-review="${j.id}">Review</button>`:''}${['quoted',...activeStates].includes(j.status)?`<button class="text-button" data-cancel="${j.id}">Cancel</button>`:''}</div></div>${j.error?`<p class="error-note">${esc(j.error)}</p>`:''}</div></article>`;}).join('')}</div>`;
}
function currentShot() { return S.project?.shots[S.shot]; }
function captureProject() {
  if (!S.project||S.view!=='director') return;
  const shot=currentShot();
  for(const k of ['name','brief','look','aspect']) if ($('#project-'+k)) S.project[k]=$('#project-'+k).value;
  if(shot) for(const k of ['title','prompt','camera','lens','light','duration','narration','reference_id']) if($('#shot-'+k)) shot[k]=k==='duration'?Number($('#shot-'+k).value):k==='reference_id'?$('#shot-'+k).value||null:$('#shot-'+k).value;
}
function newShot(n=1) { return {id:id(),title:`Shot ${String(n).padStart(2,'0')}`,prompt:S.prompt||'An explorer approaches a colossal gateway in the desert.',camera:S.camera,lens:'35mm anamorphic',light:'Warm backlight and atmospheric dust',duration:5,narration:'',asset_id:null,audio_asset_id:null,reference_id:null}; }
async function saveProject(recapture=true) {
  if(recapture)captureProject();
  if(S.saving)throw new Error('Wait for the current film save to finish.');
  const {id:pid,...data}=S.project;
  // Lock the old inspector while a structural edit is being persisted. Otherwise
  // a fast edit can target the previous shot and be replaced by the response.
  S.saving=true;
  const controls=[...document.querySelectorAll('#main input,#main textarea,#main select,#main button')].map(el=>[el,el.disabled]);
  controls.forEach(([el])=>{el.disabled=true;});
  $('#main').setAttribute('aria-busy','true');
  try {
    const saved=await api('/api/projects/'+pid,'PUT',data);S.project=saved;
    S.projects=S.projects.map(p=>p.id===pid?saved:p);return saved;
  } finally {
    controls.forEach(([el,disabled])=>{el.disabled=disabled;});
    $('#main').removeAttribute('aria-busy');S.saving=false;
  }
}
function directorView() {
  if(!S.project) return header('Your director’s chair.','One story. Every shot under your control.')+empty('Give your story a home.','Create a film, plan its shots, choose your takes, and export a real review cut.','<button class="button primary" data-action="new-project">+ Create a film</button>');
  const p=S.project,s=currentShot(),a=S.assets.find(a=>a.id===s?.asset_id),total=p.shots.reduce((n,s)=>n+s.duration,0);
  return `<div class="director-toolbar"><div class="button-cluster"><span class="eyebrow">DIRECTOR WORKSPACE</span><select id="projectPicker" aria-label="Choose film">${S.projects.map(v=>option(v.id,p.id,v.name)).join('')}</select></div><div class="button-cluster"><span class="muted small-text">${p.shots.length} shots / ${total}s / rev ${p.revision}</span><button class="button secondary small" data-action="save-project">Save film</button><a class="button secondary small" href="/api/projects/${p.id}/package">Cut manifest ↓</a><button class="button primary small" data-action="export" ${!p.shots.length||p.shots.some(s=>!s.asset_id)?'disabled':''}>Export film ↗</button></div></div>
  <div class="project-note"><label class="field">Film title<input id="project-name" maxlength="120" value="${esc(p.name)}"></label><label class="field">Creative brief<input id="project-brief" maxlength="5000" value="${esc(p.brief)}" placeholder="What is this story really about?"></label><label class="field">Format<select id="project-aspect">${['16:9','9:16','1:1'].map(v=>option(v,p.aspect)).join('')}</select></label></div>
  <div class="director-grid"><aside class="shot-list"><div class="panel-heading"><strong>Shot list</strong><button class="icon-button" data-action="add-shot" aria-label="Add shot">+</button></div>${p.shots.map((sh,i)=>{const m=S.assets.find(a=>a.id===sh.asset_id);return `<div class="shot-entry ${i===S.shot?'active':''}"><button class="shot-select" data-shot="${i}"><span class="shot-number">${String(i+1).padStart(2,'0')}</span><div class="shot-thumb">${m?.kind==='image'?`<img src="${fileUrl(m)}" alt="">`:'▷'}</div><strong>${esc(sh.title)}</strong><small>${sh.duration}s · ${m?'TAKE SELECTED':'AWAITING TAKE'}</small></button><div class="shot-actions"><button data-move="${i}" data-direction="-1" aria-label="Move shot up" ${i===0?'disabled':''}>↑</button><button data-move="${i}" data-direction="1" aria-label="Move shot down" ${i===p.shots.length-1?'disabled':''}>↓</button><button data-delete-shot="${i}" aria-label="Remove shot">×</button></div></div>`;}).join('')}<button class="button secondary small full" data-action="add-shot">+ Add shot</button></aside>
  <section class="monitor-panel"><div class="panel-heading"><span>${esc(s?.title||'Select a shot')}</span><span class="label">${p.aspect} / REVIEW MONITOR</span></div><div class="monitor ${p.aspect==='9:16'?'portrait-monitor':''}">${a?assetTag(a):`<div class="monitor-placeholder"><span class="frame-bracket"></span><p class="eyebrow">FRAME YOUR NEXT IDEA</p><h2>The scene is yours.</h2><p>Generate a take or choose an owned asset.</p><button class="button secondary" data-action="choose-take">Choose media ↗</button></div>`}</div><div class="monitor-controls"><span>${a?esc(a.provenance.mode==='demo'?'Simulation fixture · not AI output':a.kind+' / '+a.name):'No take selected'}</span><button class="text-button" data-action="choose-take">Change take ↗</button></div><div class="timeline"><div class="timeline-heading"><strong>Sequence</strong><small>${total}s / 24 fps export</small></div><div class="timeline-track">${p.shots.map((sh,i)=>`<button class="timeline-clip ${i===S.shot?'active':''}" style="flex:${sh.duration}" data-shot="${i}"><span>${String(i+1).padStart(2,'0')}</span><small>${sh.duration}s</small></button>`).join('')}</div><div class="audio-track">${p.shots.map(sh=>`<span style="flex:${sh.duration}" class="${sh.audio_asset_id?'has-audio':''}">${sh.audio_asset_id?'∿ ∿ ∿':'· · ·'}</span>`).join('')}</div></div><label class="field look-field">Shared visual language<textarea id="project-look" rows="2" maxlength="1500">${esc(p.look)}</textarea></label><p class="studio-note">Continuity is a creative constraint, not a guarantee. Inspect every take before publication.</p></section>
  <aside class="inspector"><div class="panel-heading"><strong>Shot direction</strong><span>◈</span></div>${s?`<label class="field">Shot title<input id="shot-title" value="${esc(s.title)}" maxlength="120"></label><label class="field">What happens?<textarea id="shot-prompt" rows="5" maxlength="4000">${esc(s.prompt)}</textarea></label><label class="field">Camera<select id="shot-camera">${S.session.cameras.map(v=>option(v,s.camera)).join('')}</select></label><div class="two-fields"><label class="field">Lens<input id="shot-lens" value="${esc(s.lens)}" maxlength="80"></label><label class="field">Seconds<input type="number" min="1" max="10" id="shot-duration" value="${s.duration}"></label></div><label class="field">Lighting<input id="shot-light" value="${esc(s.light)}" maxlength="160"></label><label class="field">Reference<select id="shot-reference_id">${imageOptions(s.reference_id)}</select></label><div class="button-cluster"><button class="button primary small" data-shot-generate="image">Create frame</button><button class="button secondary small" data-shot-generate="video">Create scene</button></div><button class="button secondary small full" data-shot-generate="animate" ${!s.reference_id?'disabled':''}>Animate reference</button><div class="inspector-divider"></div><label class="field">Narration<textarea id="shot-narration" rows="3" maxlength="1500" placeholder="Words that move the story forward…">${esc(s.narration)}</textarea></label><button class="button secondary small full" data-shot-generate="voice">Create narration ∿</button>${s.audio_asset_id?'<small class="success-text">Narration take attached</small>':''}`:''}</aside></div>
  <div class="section-heading"><h2>Production takes</h2><span class="muted small-text">Select deliberately. Nothing replaces a take without your choice.</span></div><div id="recentJobs">${jobCards(S.jobs.filter(j=>j.generation.project_id===p.id))}</div>`;
}
function mediaCards(items,select=false) { return `<div class="media-grid">${items.map(a=>`<article class="media-card"><button class="media-preview" ${select?`data-select-asset="${a.id}"`:`data-preview="${a.id}"`} aria-label="${select?'Choose':'Preview'} ${esc(a.name)}">${a.kind==='image'?`<img src="${fileUrl(a)}" alt="${esc(a.name)}" loading="lazy">`:`<span class="media-glyph">${a.kind==='video'?'▷':'∿'}</span>`}<span class="media-badge">${a.provenance.mode==='demo'?'SIMULATION':esc(a.kind.toUpperCase())}</span></button><div class="media-caption"><strong>${esc(a.name)}</strong><small>${a.width?a.width+' × '+a.height:Math.round(a.duration||0)+'s'} · ${(a.size/1048576).toFixed(2)} MB</small></div></article>`).join('')}</div>`; }
function libraryView() { return header('Made here. Kept here.','Your images, films, and audio. Archived locally with provenance.','<button class="button primary" data-action="upload">↑ Upload media</button>')+(S.assets.length?mediaCards(S.assets):empty('Your media library is waiting.','Generate a take or upload a reference. PNG, JPEG, WebP, MP4, WebM, WAV, MP3 and M4A. Maximum 16 MiB per upload.')); }
function elementsView() {
  return header('Keep your world consistent.','Named visual references for characters, products, and environments.')+`<div class="split-grid"><section class="form-panel"><h2>Add a reference</h2><p class="muted">A reusable asset and description, not identity training or a likeness guarantee.</p><form id="elementForm"><label class="field">Name<input name="name" required maxlength="100" placeholder="The explorer"></label><label class="field">Type<select name="category">${['character','product','environment'].map(v=>option(v,'character')).join('')}</select></label><label class="field">Owned image<select name="asset_id" required>${imageOptions('')}</select></label><label class="field">Continuity notes<textarea name="description" maxlength="2000" rows="4" placeholder="Wardrobe, materials, silhouette, details to preserve"></textarea></label><div class="button-cluster"><button class="button primary" type="submit">Save reference</button><button class="button secondary" type="button" data-action="upload">Upload image</button></div></form></section><section class="stack">${S.elements.length?S.elements.map(e=>{const a=S.assets.find(a=>a.id===e.asset_id);return `<article class="brand-card reference-card">${a?`<img src="${fileUrl(a)}" alt="${esc(e.name)}">`:''}<span class="label">${esc(e.category)}</span><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p><button class="button secondary small" data-use-element="${e.id}">Use as reference ↗</button></article>`;}).join(''):empty('Build your cast of ideas.','Reuse the same visual reference across scenes, then review continuity in the director workspace.')}</section></div>`;
}
function brandsView() {
  return header('Give every frame your signature.','Save the voice, palette, and creative rules behind your work.')+`<div class="split-grid"><section class="form-panel"><h2>Create a brand kit</h2><form id="brandForm"><label class="field">Brand name<input name="name" required maxlength="100" placeholder="Cognitum"></label><label class="field">Voice and tone<textarea name="voice" maxlength="1500" rows="3" placeholder="Confident, precise, human. No empty promises."></textarea></label><label class="field">Palette<input name="palette" placeholder="#D5EEA2, #101110, #F0F2E9"></label><label class="field">Creative rules<textarea name="notes" maxlength="3000" rows="4" placeholder="Material language, lighting, composition, words to avoid"></textarea></label><button class="button primary" type="submit">Save brand kit</button></form></section><section class="stack">${S.brands.length?S.brands.map(b=>`<article class="brand-card"><span class="label">BRAND KIT</span><h2>${esc(b.name)}</h2><div class="swatches">${b.palette.filter(c=>/^#[0-9a-f]{6}$/i.test(c)).map(c=>`<span style="background:${c}" title="${c}"></span>`).join('')}</div><p>${esc(b.voice)}</p><p class="muted">${esc(b.notes)}</p><button class="button secondary small" data-use-brand="${b.id}">Apply creative direction ↗</button></article>`).join(''):empty('A recognizable point of view.','Create a kit to apply shared creative constraints to your films.')}</section></div>`;
}
function activityView() {
  return header('Every decision leaves a trail.','Quotes, approvals, provider status, and archived results. No hidden generation retries.')+`<div class="notice">Reservations are conservative estimates, not settled provider invoices. Unknown submissions keep their reservation until an operator reconciles them.</div><div id="recentJobs">${jobCards(S.jobs)}</div><div class="section-heading"><h2>Audit trail</h2><button class="text-button" data-action="refresh">Refresh ↻</button></div><div class="audit-wrap"><table class="audit-table"><thead><tr><th>Time</th><th>Event</th><th>Object</th></tr></thead><tbody>${S.audit.map(a=>`<tr><td>${esc(new Date(a.at*1000).toLocaleString())}</td><td>${esc(a.event)}</td><td><code>${esc(a.object_id.slice(0,12))}</code></td></tr>`).join('')}</tbody></table></div>`;
}
function render() {
  updateChrome();
  $('#main').innerHTML=({create:createView,director:directorView,library:libraryView,elements:elementsView,brands:brandsView,activity:activityView})[S.view]();
}
async function refreshData(full=false) {
  const [assets,jobs,session]=await Promise.all([api('/api/assets'),api('/api/jobs'),api('/api/session')]);
  S.assets=assets;S.jobs=jobs;S.session=session;
  if(full) [S.projects,S.brands,S.elements,S.audit]=await Promise.all(['/api/projects','/api/brands','/api/elements','/api/audit'].map(p=>api(p)));
  updateChrome();
}
async function load() {
  try { S.session=await api('/api/session'); await refreshData(true);S.project=S.projects[0]||null;render(); }
  catch(e) { $('#main').innerHTML=empty('Your private studio.','Sign in with your studio access token. Your fal key stays on the server.'); modal('Enter your studio',`<form id="loginForm"><label class="field">Studio access token<input name="token" type="password" required autocomplete="current-password" maxlength="256"></label><p class="muted">This is not your fal API key. Ask the studio operator for an access token.</p><button class="button primary" type="submit">Sign in</button><p id="loginError" role="alert"></p></form>`); }
}
async function newProject() {
  captureComposer();captureProject();
  modal('A new story starts here.',`<form id="projectForm"><label class="field">Film title<input name="name" required maxlength="120" value="Untitled film"></label><label class="field">The brief<textarea name="brief" maxlength="5000" rows="3" placeholder="Tell us what you want the audience to feel."></textarea></label><button class="button primary" type="submit">Create film ↗</button></form>`);
}
async function showQuote(g) {
  const quote=await api('/api/quotes','POST',g); S.jobs=[quote,...S.jobs.filter(j=>j.id!==quote.id)];reviewQuote(quote);
}
function reviewQuote(q) {
  modal('A deliberate next take.',`<p class="eyebrow">${q.mode==='demo'?'SIMULATION / NO PROVIDER CALL':'LIVE GENERATION / USD ESTIMATE'}</p><div class="quote-amount">${money(q.approval_micros)}</div><p class="muted">${q.mode==='demo'?'Produces clearly labeled procedural media to test the workflow. Images are fixtures, voice is a tone, and video is a test clip.':'Maximum studio reservation for this request, including a 25% estimate buffer. This is not a guaranteed provider charge cap.'}</p><div class="quote-row"><span>Model</span><strong>${esc(q.model)}</strong></div><div class="quote-row"><span>Estimated billing units</span><strong>${q.billing_units} ${esc(q.billing_unit)}</strong></div><div class="quote-row"><span>Base estimate</span><strong>${money(q.estimate_micros)}</strong></div><div class="quote-row"><span>Quote expires</span><strong>${esc(new Date(q.expires_at*1000).toLocaleTimeString())}</strong></div><div class="quote-prompt">${esc(q.generation.prompt)}</div><p class="studio-note">${q.generation.reference_id?'Your selected reference image will be sent to fal. ':''}Use only media and likenesses you have rights to use. Nothing is submitted until you approve.</p><button class="button primary full" data-approve="${q.id}">Approve ${money(q.approval_micros)} and generate ↗</button>`);
}
async function preview(assetId) {
  const a=S.assets.find(a=>a.id===assetId);if(!a)return;
  modal(a.name,`<div class="preview-media">${assetTag(a)}</div><div class="quote-row"><span>Source</span><strong>${esc(a.provenance.mode)}</strong></div><p class="studio-note">${esc(a.provenance.notice||a.provenance.rights||'Archived in your private workspace.')}</p><div class="button-cluster"><a class="button primary" href="${fileUrl(a)}" download="${esc(a.name)}">Download asset ↓</a>${a.kind!=='audio'?`<button class="button secondary" data-select-asset="${a.id}">Use in current shot</button>`:''}</div><details><summary>Provenance</summary><pre>${esc(JSON.stringify({sha256:a.sha256,...a.provenance},null,2))}</pre></details>`);
}
async function chooseTake() { captureProject();if(!currentShot())throw new Error('Create a film and select a shot first.');modal('Choose a take',S.assets.length?mediaCards(S.assets,true):empty('No media yet.','Create a frame or upload media first.','<button class="button secondary" data-action="upload">Upload media</button>')); }
async function attach(assetId,job=null) {
  const a=S.assets.find(a=>a.id===assetId);if(!a)return;
  captureProject();
  if(job?.generation.project_id) {
    if(S.project?.id===job.generation.project_id&&S.view==='director')await saveProject();
    S.project=await api('/api/projects/'+job.generation.project_id);S.shot=Math.max(0,S.project.shots.findIndex(s=>s.id===job.generation.shot_id));
  }
  const s=currentShot();if(!s)throw new Error('Create a film and select a shot before attaching a take.');
  s[a.kind==='audio'?'audio_asset_id':'asset_id']=a.id;
  // Saving from another view must not recapture a stale inspector.
  const previous=S.view;S.view='library';await saveProject();S.view=previous;
  closeModal();S.view='director';render();toast('Take selected. Your film has been saved.');
}
async function navigate(view) { captureComposer();if(S.view==='director'&&S.project)await saveProject();S.view=view;if(view==='activity')S.audit=await api('/api/audit');render(); }
async function action(name,button) {
  if(name==='new-project')return newProject();
  if(name==='focus-prompt')return $('#prompt')?.focus();
  if(name==='upload')return $('#fileInput').click();
  if(name==='choose-take')return chooseTake();
  if(name==='quote') { captureComposer();if(!S.prompt.trim())throw new Error('Write a prompt or choose a direction first.');return showQuote({recipe:S.recipe,prompt:S.prompt+(S.recipe==='voice'||S.recipe==='cutout'?'':` Camera: ${S.camera}.`),aspect:S.aspect,duration:S.duration,count:S.count,voice:S.voice,reference_id:S.reference||null,idempotency_key:id()}); }
  if(name==='save-project'){await saveProject();render();return toast('Film saved.');}
  if(name==='add-shot'){captureProject();if(S.project.shots.length>=24)throw new Error('A film supports up to 24 shots.');S.project.shots.push(newShot(S.project.shots.length+1));S.shot=S.project.shots.length-1;await saveProject(false);return render();}
  if(name==='export'){await saveProject();button.disabled=true;button.textContent='Rendering film…';try{const a=await api('/api/projects/'+S.project.id+'/export','POST',{});await refreshData();await preview(a.id);toast('Review film rendered and archived.');}finally{render();}return;}
  if(name==='refresh'){await refreshData(true);render();return toast('Workspace refreshed.');}
  if(name==='logout'){await api('/api/session','DELETE');closeModal();S.session=null;return load();}
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('button, [data-view]');if(!b||b.disabled||S.saving)return;
  try {
    if(b.dataset.view)return await navigate(b.dataset.view);
    if(b.dataset.action)return await action(b.dataset.action,b);
    if(b.dataset.recipe){captureComposer();S.recipe=b.dataset.recipe;return render();}
    if(b.dataset.filter){captureComposer();S.filter=b.dataset.filter;return render();}
    if(b.dataset.preset){const p=S.session.presets.find(p=>p.id===b.dataset.preset);captureComposer();S.prompt=`${p.prompt} Lens: ${p.lens}. Lighting: ${p.light}.`;S.camera=p.camera;S.view='create';render();$('#prompt').focus();return;}
    if(b.dataset.preview)return preview(b.dataset.preview);
    if(b.dataset.review)return reviewQuote(S.jobs.find(j=>j.id===b.dataset.review));
    if(b.dataset.approve){b.disabled=true;const q=S.jobs.find(j=>j.id===b.dataset.approve);try{await api('/api/jobs/'+q.id+'/approve','POST',{approved:true,max_cost_micros:q.approval_micros});closeModal();await refreshData();captureComposer();captureProject();render();toast('Job submitted once. The studio will track this request.');}catch(e){b.disabled=false;throw e;}return;}
    if(b.dataset.cancel){await api('/api/jobs/'+b.dataset.cancel+'/cancel','POST',{});await refreshData();captureComposer();captureProject();render();return toast('Cancellation recorded. Running provider jobs may still complete and be billed.');}
    if(b.dataset.shot!==undefined){captureProject();S.shot=Number(b.dataset.shot);return render();}
    if(b.dataset.move!==undefined){captureProject();const i=Number(b.dataset.move),j=i+Number(b.dataset.direction);[S.project.shots[i],S.project.shots[j]]=[S.project.shots[j],S.project.shots[i]];S.shot=j;await saveProject(false);return render();}
    if(b.dataset.deleteShot!==undefined){captureProject();S.project.shots.splice(Number(b.dataset.deleteShot),1);S.shot=Math.max(0,Math.min(S.shot,S.project.shots.length-1));await saveProject(false);return render();}
    if(b.dataset.shotGenerate){await saveProject();const s=currentShot(),recipe=b.dataset.shotGenerate;const prompt=recipe==='voice'?s.narration:`${s.prompt} Camera: ${s.camera}. Lens: ${s.lens}. Lighting: ${s.light}. ${S.project.look}`;if(!prompt.trim())throw new Error('Write the shot prompt or narration first.');return showQuote({recipe,prompt,aspect:S.project.aspect,duration:s.duration<=3?3:s.duration<=5?5:8,reference_id:s.reference_id,project_id:S.project.id,shot_id:s.id,idempotency_key:id()});}
    if(b.dataset.selectAsset)return await attach(b.dataset.selectAsset);
    if(b.dataset.useJob){const j=S.jobs.find(j=>j.id===b.dataset.useJob);return await attach(j.assets[0],j);}
    if(b.dataset.useElement){const e=S.elements.find(e=>e.id===b.dataset.useElement);S.reference=e.asset_id;S.prompt=e.description;S.recipe='animate';S.view='create';render();return toast('Reference selected. Add motion direction and review the cost.');}
    if(b.dataset.useBrand){const k=S.brands.find(k=>k.id===b.dataset.useBrand),look=`${k.name}. ${k.voice} Palette: ${k.palette.join(', ')}. ${k.notes}`;if(S.project){S.project.look=look.slice(0,1500);await saveProject();S.view='director';render();}else{S.prompt=look;S.view='create';render();}return toast('Creative direction applied. Review the prompt before generation.');}
  } catch(e){toast(e.message);}
});
document.addEventListener('input',e=>{if(e.target.id==='presetSearch'){S.search=e.target.value;$('#presetGrid').innerHTML=presetCards();}});
document.addEventListener('change',async e=>{
  try{
    if(e.target.id==='projectPicker'){const next=e.target.value;await saveProject();S.project=await api('/api/projects/'+next);S.shot=0;render();}
    if(e.target.id==='shot-reference_id'){captureProject();render();}
  }catch(err){toast(err.message);}
});
document.addEventListener('submit',async e=>{
  if(!['loginForm','projectForm','brandForm','elementForm'].includes(e.target.id))return;
  e.preventDefault();const f=e.target,data=Object.fromEntries(new FormData(f));const button=f.querySelector('[type="submit"]');button.disabled=true;
  try{
    if(f.id==='loginForm'){await api('/api/session','POST',data);closeModal();return await load();}
    if(f.id==='projectForm'){S.project=await api('/api/projects','POST',{...data,look:'Cinematic realism, consistent color and physical detail',aspect:S.aspect,shots:[newShot(1)]});S.projects.unshift(S.project);S.shot=0;S.view='director';closeModal();render();return;}
    if(f.id==='brandForm'){data.palette=data.palette.split(',').map(v=>v.trim()).filter(Boolean);if(data.palette.some(v=>!/^#[0-9a-f]{6}$/i.test(v)))throw new Error('Use six digit hex colors, separated by commas.');await api('/api/brands','POST',data);S.brands=await api('/api/brands');render();toast('Brand kit saved.');}
    if(f.id==='elementForm'){await api('/api/elements','POST',data);S.elements=await api('/api/elements');render();toast('Reference saved.');}
  }catch(err){toast(err.message);if($('#loginError'))$('#loginError').textContent=err.message;}finally{button.disabled=false;}
});
$('#fileInput').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>16*1024*1024)throw new Error('Upload exceeds 16 MiB.');toast('Validating and archiving media…');const form=new FormData();form.append('file',file);const a=await api('/api/assets','POST',form);await refreshData();captureComposer();captureProject();if(a.kind==='image')S.reference=a.id;closeModal();render();toast('Media archived. Your upload is available in the library.');}catch(err){toast(err.message);}finally{e.target.value='';}
});
$('#closeDialog').addEventListener('click',closeModal);
$('#projectShortcut').addEventListener('click',newProject);
$('#settingsButton').addEventListener('click',()=>modal('Studio settings',`<p class="eyebrow">${esc(S.session?.tenant)} / ${esc(S.session?.mode?.toUpperCase())}</p><p>This workspace stores projects, assets, quotes, and audit records on the studio server. Provider credentials are server only.</p><div class="quote-row"><span>Export engine</span><strong>${S.session?.export_available?'FFmpeg available':'FFmpeg not installed'}</strong></div><div class="quote-row"><span>Daily reservation budget</span><strong>${money(S.session?.daily_budget_micros)}</strong></div><div class="notice">${S.session?.mode==='demo'?'Simulation is restricted to loopback. It makes no paid calls and deliberately produces labeled test fixtures. To use live fal generation, configure the server with HTTPS, an access token, and FAL_KEY.':'Live mode requires explicit cost approval for each request. Provider prices can vary; reconcile reservations against your provider bill.'}</div><p class="studio-note">Single instance studio. This build is not an enterprise identity or billing service.</p>${S.session?.mode==='live'?'<button class="button secondary" data-action="logout">Sign out</button>':''}`));
$('#themeButton').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('vibecast-theme',document.documentElement.dataset.theme);});
try{document.documentElement.dataset.theme=localStorage.getItem('vibecast-theme')||'dark';}catch(_){}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&S.view==='create'&&!$('#dialog').open){e.preventDefault();action('quote',$('#quoteButton')).catch(err=>toast(err.message));}});
setInterval(async()=>{
  if(!S.session||refreshing||!S.jobs.some(j=>activeStates.has(j.status)))return;
  refreshing=true;
  try{const before=S.jobs.filter(j=>activeStates.has(j.status)).map(j=>j.id);await refreshData();const changed=S.jobs.some(j=>before.includes(j.id)&&j.status==='completed');const box=$('#recentJobs');if(box)box.innerHTML=jobCards(S.view==='director'?S.jobs.filter(j=>j.generation.project_id===S.project?.id):S.view==='create'?S.jobs.slice(0,6):S.jobs);if(changed){toast('A new take is ready. Review it before selecting.');if(S.view==='library')render();}}catch(_){}finally{refreshing=false;}
},2500);
load();
