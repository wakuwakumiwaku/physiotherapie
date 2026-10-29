import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {File} from 'node:buffer';
import * as domain from '../src/domain.js';
import {validateCatalog,emptyWorkspace,STORAGE_KEY} from '../src/domain.js';
const catalog=validateCatalog(JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url))));
const provenance=JSON.parse(await readFile(new URL('../public/data/provenance.json',import.meta.url)));
const line=(id,quantity='1',materialChf='',note='')=>({id,quantity,materialChf,note});
const plan=(lines=[],tpw='')=>({...emptyWorkspace(),lines,tpw});

// Offline execution of the real app handlers and domain exports. Only ESM syntax is
// adapted for a fresh VM context; DOM, packaged fetch and download IO are adapters.
// Native input selection, modal interaction and saved downloads remain browser gates.
const appSource=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const appHtml=await readFile(new URL('../index.html',import.meta.url),'utf8');
async function importFixture(initial={...plan([line('7330')]),label:'Before import'}){
 const writes=[],reads=[],downloads=[],urls=new Map(),windowEvents=new Map();
 const initialRaw=' \n'+JSON.stringify(initial)+'  ',foreignRaw='untouched foreign bytes Ω\n';
 const raw=new Map([[STORAGE_KEY,initialRaw],['foreign.workspace.v1',foreignRaw]]);
 let failDownload=false,afterWrite=()=>{};
 class Element{
  constructor(tag,id=''){Object.assign(this,{tag,id,children:[],dataset:{},attrs:{},listeners:new Map(),disabled:false,open:false,shows:0,files:[],_text:'',_value:'',resets:0});}
  get value(){return this._value;}
  set value(v){this._value=v;if(v==='')this.resets++;}
  get textContent(){return this._text+this.children.map(e=>e.textContent).join('');}
  set textContent(v){this._text=String(v);this.children=[];}
  append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  setAttribute(k,v){this.attrs[k]=String(v);}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  async fire(type,fields={}){const event={type,target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...fields};await Promise.all((this.listeners.get(type)||[]).map(fn=>fn(event)));return event;}
  click(){if(this.disabled)return Promise.resolve();if(this.tag==='a'){assert.ok(urls.has(this.href));downloads.push({name:this.download,blob:urls.get(this.href)});}return this.fire('click');}
  showModal(){this.open=true;this.shows++;}
  close(){this.open=false;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
  focus(){}
 }
 const body=new Element('body'),nodes=new Map();
 for(const match of appHtml.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){
  const e=new Element(match[1],match[3]);e.disabled=/\sdisabled(?:\s|$)/.test(match[2]);nodes.set(e.id,e);body.append(e);
 }
 const get=id=>{assert.ok(nodes.has(id),'real HTML hook missing: '+id);return nodes.get(id);};
 const descendants=e=>e.children.flatMap(n=>[n,...descendants(n)]);
 const document={body,getElementById:get,createElement:tag=>new Element(tag),createTextNode:text=>{const e=new Element('#text');e.textContent=text;return e;},
  querySelector:selector=>{const m=selector.match(/^\[data-line-amount="([^"]+)"\]$/);assert.ok(m,'unsupported selector '+selector);return descendants(body).find(e=>e.dataset.lineAmount===m[1])??null;},
  querySelectorAll:selector=>{assert.equal(selector,'[data-line-amount]');return descendants(body).filter(e=>e.dataset.lineAmount!==undefined);}};
 const storage={getItem(k){reads.push(k);return raw.get(k)??null;},setItem(k,v){writes.push({key:k,raw:v});raw.set(k,v);afterWrite(k,v);},clear(){assert.fail('whole localStorage clear forbidden');},removeItem(){assert.fail('storage removal forbidden');}};
 const window={localStorage:storage,addEventListener(type,fn){windowEvents.set(type,fn);}};
 class DownloadURL extends URL{
  static createObjectURL(blob){if(failDownload)throw Error('download unavailable');const url='blob:offline-'+urls.size;urls.set(url,blob);return url;}
  static revokeObjectURL(url){urls.delete(url);}
 }
 const context=vm.createContext({document,window,domain,URL:DownloadURL,Blob,structuredClone,setTimeout(){},fetch:async url=>{
  const name=new URL(url).pathname.split('/').at(-1);assert.ok(['catalog.json','provenance.json'].includes(name),'unexpected fetch '+url);
  return {ok:true,json:async()=>structuredClone(name==='catalog.json'?catalog:provenance)};
 }});
 assert.equal([...appSource.matchAll(/^import \{([^}]+)\} from '\.\/domain\.js';/gm)].length,1);
 const executable=appSource.replace(/^import \{([^}]+)\} from '\.\/domain\.js';/m,'const {$1}=domain;').replaceAll('import.meta.url',JSON.stringify(new URL('../src/app.js',import.meta.url).href));
 await new vm.Script(executable,{filename:'src/app.js'}).runInContext(context);
 assert.equal(body.dataset.ready,'true',get('startup').textContent);assert.equal(writes.length,0,'no startup writes');
 const f={get,raw,reads,writes,downloads,initialRaw,foreignRaw,
  select(file){get('import-json').files=file?[file]:[];get('import-json').value=file?'C:\\fakepath\\'+file.name:'';return get('import-json').fire('change');},
  async input(id,value){get(id).value=value;await get(id).fire('input');},
  async escape(){const e=await get('import-dialog').fire('cancel');assert.equal(e.defaultPrevented,true,'real Escape handler');},
  async backup(expected){const count=downloads.length;await get('backup-before-import').click();assert.equal(downloads.length,count+1);assert.equal(downloads.at(-1).name,'physiotherapie-vor-uebernahme.json');assert.deepEqual(JSON.parse(await downloads.at(-1).blob.text()),expected);},
  failDownload(value){failDownload=value;},afterWrite(fn){afterWrite=fn;},
  snapshot(){return {open:get('import-dialog').open,shows:get('import-dialog').shows,preview:get('import-preview').textContent,action:get('action-status').textContent,actionClass:get('action-status').className,status:get('import-status').textContent,storage:get('storage-status').textContent,file:get('import-json').value,resets:get('import-json').resets,applyDisabled:get('apply-import').disabled,backupDisabled:get('backup-before-import').disabled,label:get('workspace-label').value,raw:raw.get(STORAGE_KEY),writes:writes.length,downloads:downloads.length};},
  assertStorage(){assert.equal(raw.get('foreign.workspace.v1'),foreignRaw);assert.deepEqual([...raw.keys()].sort(),[STORAGE_KEY,'foreign.workspace.v1'].sort());assert.ok(writes.every(w=>w.key===STORAGE_KEY));assert.ok(reads.every(k=>k===STORAGE_KEY));}};
 return f;
}
const incoming=label=>({...plan([line('7362')]),label});
const importFile=(value,name='import.json')=>new File([typeof value==='string'?value:JSON.stringify(value)],name,{type:'application/json'});
function heldFile(value,name='held.json'){
 const file=importFile(value,name),read=file.text.bind(file);let release,reject;
 const gate=new Promise((resolve,fail)=>{release=resolve;reject=fail;});
 Object.defineProperty(file,'text',{value:()=>gate.then(read)});
 return {file,release,reject:()=>reject(Error('held file read failed'))};
}

test('real import handlers: ordinary preview requires a successful valid before-image download',async()=>{
 const f=await importFixture(),b=incoming('B');await f.select(importFile(b));
 assert.equal(f.get('import-dialog').open,true);assert.equal(f.raw.get(STORAGE_KEY),f.initialRaw);
 await f.get('apply-import').click();assert.equal(f.writes.length,0);
 f.failDownload(true);await f.get('backup-before-import').click();assert.equal(f.get('apply-import').disabled,true);assert.match(f.get('import-status').textContent,/download unavailable/);
 await f.get('apply-import').click();assert.equal(f.writes.length,0);f.failDownload(false);
 await f.input('tpw','-1');await f.get('backup-before-import').click();assert.equal(f.downloads.length,0);assert.equal(f.get('apply-import').disabled,true);
 await f.input('tpw','');await f.backup(JSON.parse(f.initialRaw));assert.equal(f.get('apply-import').disabled,false);
 await f.get('apply-import').click();assert.deepEqual(JSON.parse(f.raw.get(STORAGE_KEY)),b);assert.equal(f.get('import-dialog').open,false);
 assert.equal(f.get('import-json').value,'');assert.equal(f.writes.length,1);assert.match(f.get('action-status').textContent,/zurückgelesen/);f.assertStorage();
});

for(const phase of ['preview','cancel','Escape','apply'])for(const outcome of ['success','error']){
 test(`real import ownership: stale ${outcome} after B ${phase} is inert`,async()=>{
  const f=await importFixture(),a=heldFile(incoming('A'),'A.json'),old=f.select(a.file),b=incoming('B');
  await f.select(importFile(b,'B.json'));assert.equal(f.get('import-dialog').open,true);
  // Preserve B's already-granted backup permission, not merely its visible text.
  await f.backup(JSON.parse(f.initialRaw));
  if(phase==='cancel')await f.get('cancel-import').click();
  if(phase==='Escape')await f.escape();
  if(phase==='apply')await f.get('apply-import').click();
  const before=f.snapshot();if(outcome==='success')a.release();else a.reject();await old;
  assert.deepEqual(f.snapshot(),before,'obsolete read must not mutate current UI, input cleanup, storage or downloads');
  if(phase==='preview'){
   await f.input('workspace-label','edit behind current preview');assert.equal(f.raw.get(STORAGE_KEY),f.initialRaw,'current preview still pauses autosave');
   await f.get('apply-import').click();assert.deepEqual(JSON.parse(f.raw.get(STORAGE_KEY)),b,'B remains backed-up and confirmable');
  }else{
   assert.equal(f.get('import-dialog').open,false);await f.input('workspace-label','saved after '+phase);
   assert.equal(JSON.parse(f.raw.get(STORAGE_KEY)).label,'saved after '+phase,'saving resumes after completion');
  }
  f.assertStorage();
 });
}

for(const outcome of ['success','error'])test(`real import ownership: stale ${outcome} cannot reset newer pending input`,async()=>{
 const f=await importFixture(),a=heldFile(incoming('A'),'A.json'),old=f.select(a.file),b=heldFile(incoming('B'),'B.json'),current=f.select(b.file);
 const before=f.snapshot();if(outcome==='success')a.release();else a.reject();await old;
 assert.deepEqual(f.snapshot(),before);await f.input('workspace-label','saved during B read');
 assert.equal(JSON.parse(f.raw.get(STORAGE_KEY)).label,'saved during B read');b.release();await current;
 assert.ok(f.get('import-preview').textContent.includes('B'));assert.equal(f.get('import-dialog').open,true);
 await f.backup(JSON.parse(f.raw.get(STORAGE_KEY)));await f.get('apply-import').click();assert.deepEqual(JSON.parse(f.raw.get(STORAGE_KEY)),incoming('B'));f.assertStorage();
});

test('real import ownership: new selection discards old candidate and backup while saving stays active',async()=>{
 const f=await importFixture();await f.select(importFile(incoming('A')));await f.backup(JSON.parse(f.initialRaw));
 const b=heldFile(incoming('B'),'B.json'),read=f.select(b.file);
 assert.equal(f.get('import-dialog').open,false);assert.equal(f.get('apply-import').disabled,true);assert.equal(f.get('backup-before-import').disabled,true);
 await f.get('apply-import').click();assert.equal(f.writes.length,0);
 await f.input('workspace-label','saved in new read');assert.equal(JSON.parse(f.raw.get(STORAGE_KEY)).label,'saved in new read');
 b.release();await read;assert.equal(f.get('apply-import').disabled,true,'A backup cannot authorize B');
 await f.get('apply-import').click();assert.equal(f.writes.length,1);await f.backup(JSON.parse(f.raw.get(STORAGE_KEY)));
 await f.get('apply-import').click();assert.deepEqual(JSON.parse(f.raw.get(STORAGE_KEY)),incoming('B'));f.assertStorage();
});

for(const cancel of ['cancel','Escape','empty selection'])test(`real import ownership: ${cancel} invalidates the current held read`,async()=>{
 const f=await importFixture(),a=heldFile(incoming('A')),read=f.select(a.file);
 if(cancel==='cancel')await f.get('cancel-import').click();else if(cancel==='Escape')await f.escape();else await f.select(null);
 const before=f.snapshot();a.release();await read;assert.deepEqual(f.snapshot(),before);assert.equal(f.get('import-dialog').open,false);f.assertStorage();
});

for(const outcome of ['cancel','apply','invalid','read error'])test(`real import edits during read: ${outcome} preserves the edited before-image and permits retry`,async()=>{
 const f=await importFixture(),b=incoming('B'),h=heldFile(outcome==='invalid'?'{':b),read=f.select(h.file);
 await f.input('workspace-label','edited while reading');await f.input('tpw','0.0002');
 const count=f.get('workspace-lines').children[0].children[2].children[0].children[0];count.value='3';await count.fire('input');
 const edited={...plan([line('7330','3')],'0.0002'),label:'edited while reading'},editedRaw=f.raw.get(STORAGE_KEY);
 assert.deepEqual(JSON.parse(editedRaw),edited,'all valid edits persist before read settles');
 if(outcome==='read error')h.reject();else h.release();await read;
 assert.equal(f.raw.get(STORAGE_KEY),editedRaw,'preview or failed read is nonmutating');
 if(outcome==='cancel')await f.get('cancel-import').click();
 else if(outcome==='apply'){await f.backup(edited);await f.get('apply-import').click();assert.deepEqual(JSON.parse(f.raw.get(STORAGE_KEY)),b,'baseline captured after edits, at preview opening');}
 else{assert.match(f.get('action-status').textContent,/JSON nicht übernommen:/);assert.equal(f.get('import-json').value,'');assert.equal(f.get('import-dialog').open,false);await f.select(importFile(b));await f.backup(edited);await f.get('apply-import').click();assert.deepEqual(JSON.parse(f.raw.get(STORAGE_KEY)),b,'current failure supports a fresh successful retry');}
 f.assertStorage();
});

test('real import failures: oversize and malformed schema reject without writes and allow retry',async()=>{
 const f=await importFixture();for(const bad of [' '.repeat(1000001),{...incoming('B'),extra:true}]){
  await f.select(importFile(bad));assert.equal(f.get('import-dialog').open,false);assert.equal(f.get('import-json').value,'');assert.match(f.get('action-status').textContent,/JSON nicht übernommen:/);assert.equal(f.raw.get(STORAGE_KEY),f.initialRaw);
 }
 await f.select(importFile(incoming('B')));await f.backup(JSON.parse(f.initialRaw));await f.get('apply-import').click();assert.deepEqual(JSON.parse(f.raw.get(STORAGE_KEY)),incoming('B'));f.assertStorage();
});

for(const conflict of ['foreign bytes','failed readback'])test(`real import storage safety: ${conflict} refuses replacement acknowledgement`,async()=>{
 const f=await importFixture();await f.select(importFile(incoming('B')));await f.backup(JSON.parse(f.initialRaw));
 const foreign='foreign exact bytes Ω\n';if(conflict==='foreign bytes')f.raw.set(STORAGE_KEY,foreign);else f.afterWrite(k=>f.raw.set(k,foreign));
 await f.get('apply-import').click();assert.equal(f.raw.get(STORAGE_KEY),foreign);assert.equal(f.get('workspace-label').value,'Before import');assert.equal(f.get('import-dialog').open,true);assert.equal(f.get('apply-import').disabled,true);
 assert.equal(f.writes.length,conflict==='foreign bytes'?0:1);assert.doesNotMatch(f.get('action-status').textContent,/zurückgelesen/);assert.ok(f.get('import-status').textContent);f.assertStorage();
});

// Keep transition oracles independent: a modal assertion must not hide paused
// saves or an old candidate actually being reauthorized during replacement.
for(const selection of ['held replacement','empty selection']){
 test(`real import transition: ${selection} resumes saves from an existing preview`,async()=>{
  const f=await importFixture();await f.select(importFile(incoming('A')));await f.backup(JSON.parse(f.initialRaw));
  const b=heldFile(incoming('B'),'B.json'),read=selection==='held replacement'?f.select(b.file):f.select(null);
  try{
   if(selection==='held replacement')assert.match(f.get('import-json').value,/B\.json$/,'newly selected file is not cleared');
   await f.input('workspace-label','saved after '+selection);
   assert.equal(JSON.parse(f.raw.get(STORAGE_KEY)).label,'saved after '+selection,'old preview must no longer pause valid saves');
  }finally{b.release();await read;}
  f.assertStorage();
 });
 test(`real import transition: ${selection} cannot reauthorize the old candidate`,async()=>{
  const f=await importFixture();await f.select(importFile(incoming('A')));await f.backup(JSON.parse(f.initialRaw));
  const b=heldFile(incoming('B'),'B.json'),read=selection==='held replacement'?f.select(b.file):f.select(null);
  try{
   await f.get('backup-before-import').click();
   // Dispatch the actual apply callback even if disabled, to check pending
   // authority as well as the adapter's/native control's disabled state.
   await f.get('apply-import').fire('click');
   assert.equal(f.raw.get(STORAGE_KEY),f.initialRaw,'old A must not be applied after replacement intent');
   assert.equal(f.downloads.length,1,'replacement intent cannot grant another old backup');
   assert.equal(f.get('import-dialog').open,false);assert.equal(f.get('apply-import').disabled,true);assert.equal(f.get('backup-before-import').disabled,true);
  }finally{b.release();await read;}
  f.assertStorage();
 });
}

for(const completion of ['cancel','Escape','apply'])test(`real import completion: ${completion} revokes preview permissions`,async()=>{
 const f=await importFixture(),a=incoming('A');await f.select(importFile(a));await f.backup(JSON.parse(f.initialRaw));
 if(completion==='cancel')await f.get('cancel-import').click();else if(completion==='Escape')await f.escape();else await f.get('apply-import').click();
 assert.equal(f.get('backup-before-import').disabled,true,'completed preview has no backup permission');
 assert.equal(f.get('apply-import').disabled,true,'completed preview has no apply permission');
 assert.equal(f.get('import-json').value,'');assert.equal(f.get('import-dialog').open,false);
 assert.equal(f.writes.length,completion==='apply'?1:0);f.assertStorage();
});
