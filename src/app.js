import {STORAGE_KEY,validateCatalog,validateProvenance,emptyWorkspace,validateWorkspace,parseWorkspace,calculate,money,priceLabel,searchCatalog,workspaceCsv,createStorageGuard} from './domain.js';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const button=(text,action,className='secondary')=>{const e=node('button',text,className);e.type='button';e.addEventListener('click',action);return e;};
let catalog,provenance,guard,draft,visible=6,selected=null,paused=false,pending=null,previewBefore=null,backedUp=false,importRevision=0;
function announce(text,error=false){$('action-status').textContent=text;$('action-status').className=error?'error':'';}
function storageStatus(){ $('storage-status').textContent=guard.blocked?`${guard.reason} Es wird nichts überschrieben; dieser Entwurf bleibt exportierbar.`:'Lokaler Speicher bereit · nur physiotherapie.workspace.v1';$('storage-status').className=guard.blocked?'warning':'storage-ok';$('raw-storage').disabled=guard.baseline===null; }
function save(){if(!paused){try{validateWorkspace(draft,catalog);guard.save(draft);}catch{ /* Keep invalid input as a visible unsaved draft. */ }}storageStatus();renderCalculation();}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function downloadWorkspace(workspace,name='physiotherapie-sammlung.json'){validateWorkspace(workspace,catalog);download(name,JSON.stringify(workspace,null,2)+'\n','application/json');}
function sourceLink(page){const a=node('a',`Amtlicher Anhang · PDF S. ${page}`);a.href=provenance.sources.find(s=>s.sha256===catalog.sourceSha256).url+'#page='+page;return a;}
function ruleContent(position,container){
 const category=catalog.taxonomy.find(t=>t.id===position.category);
 container.append(node('p',`Quellhierarchie: ${category.overview} ${category.label} · Detailbereich ${category.detail}`),node('p',priceLabel(position),'amount'));
 if(position.category==='sessions') container.append(node('p',`Erlaubte Zuschläge gemäss Quellspalte: ${position.allowedSupplements.join(', ')||'keine'}.`));
 else container.append(node('p',`Erlaubte Sitzungspauschalen (aus der Kombinationsspalte abgeleitet): ${position.allowedSessions.join(', ')||'keine'}.`));
 container.append(node('p',position.notes,'source-text'));
 if(position.sharedRulesWith)container.append(node('p','Gemeinsamer Regelblock für 7362 und 7363.','muted'));
 for(const page of position.detailPages){const p=node('p');p.append(sourceLink(page));container.append(p);}
 container.append(node('p','Die einleitenden Bemerkungen (PDF S. 2) gelten zusätzlich. Frequenz, Indikation, Alter, Verordnung und anwendbarer Vertrag sind selbst zu prüfen.','warning'));
}
function openDetails(position){selected=position;$('details-title').textContent=`${position.code} · ${position.title}`;$('details-content').replaceChildren();ruleContent(position,$('details-content'));$('details-dialog').showModal();}
function add(position){
 const existing=draft.lines.find(l=>l.id===position.id);
 if(existing){announce(`${position.code} ist bereits in der Sammlung; Anzahl dort bearbeiten.`);return;}
 draft.lines.push({id:position.id,quantity:'1',materialChf:'',note:''});renderLines();save();announce(`${position.code} zur Sammlung hinzugefügt.`);
}
function renderResults(){const found=searchCatalog(catalog,$('search').value,$('category').value);$('results').replaceChildren();$('result-count').textContent=`${found.length} von ${catalog.positions.length} Positionen · ${Math.min(visible,found.length)} angezeigt`;
 for(const p of found.slice(0,visible)){const card=node('article',undefined,'position');card.dataset.id=p.id;card.append(node('span',p.code,'code'),node('h3',p.title),node('p',priceLabel(p),'amount'));const actions=node('div',undefined,'actions');actions.append(button('Details & Regeln',()=>openDetails(p)),button('Hinzufügen',()=>add(p),''));card.append(actions);$('results').append(card);}
 if(!found.length)$('results').append(node('p','Keine Treffer. Bitte einen anderen Begriff oder Bereich wählen.'));
 $('more').hidden=visible>=found.length;
}
function renderLines(){ $('workspace-lines').replaceChildren();if(!draft.lines.length){$('workspace-lines').append(node('p','Noch keine Position gewählt. Links eine Position hinzufügen.','muted'));return;}
 for(const line of draft.lines){
  const p=catalog.positions.find(p=>p.id===line.id),row=node('article',undefined,'workspace-line');row.dataset.workspaceId=line.id;row.append(node('h3',`${p.code} · ${p.title}`),node('p',priceLabel(p),'amount'));
  const fields=node('div',undefined,'line-inputs');
  const countLabel=node('label','Anzahl'),count=node('input');count.type='text';count.inputMode='numeric';count.value=line.quantity;count.setAttribute('aria-label',`Anzahl ${line.id}`);count.addEventListener('input',()=>{line.quantity=count.value;save();});countLabel.append(count);fields.append(countLabel);
  if(p.price.type==='purchase-cost'){const label=node('label','Einkaufspreis je Einheit · CHF'),input=node('input');input.type='text';input.inputMode='decimal';input.value=line.materialChf;input.placeholder='Unbekannt';input.setAttribute('aria-label',`Materialbetrag ${line.id}`);input.addEventListener('input',()=>{line.materialChf=input.value.trim().replace(',','.');save();});label.append(input);fields.append(label);}
  row.append(fields);
  const label=node('label','Zeilennotiz / Materialkategorie, Menge, Einheit'),note=node('textarea');note.rows=2;note.maxLength=1000;note.value=line.note;note.setAttribute('aria-label',`Notiz ${line.id}`);note.addEventListener('input',()=>{line.note=note.value;save();});label.append(note);row.append(label);
  const amount=node('p',undefined,'amount');amount.dataset.lineAmount=line.id;row.append(amount);
  const details=node('details'),summary=node('summary','Vollständige Originalregeln');details.append(summary);ruleContent(p,details);row.append(details);
  row.append(button(`${p.code} entfernen`,()=>{draft.lines=draft.lines.filter(l=>l!==line);renderLines();save();}));$('workspace-lines').append(row);
 }
}
function renderCalculation(){const target=$('calculation');target.replaceChildren();try{
 const result=calculate(draft,catalog);for(const line of result.lines){const amount=document.querySelector(`[data-line-amount="${line.id}"]`);if(amount)amount.textContent=line.cents===null?`Offen: ${line.reason}`:`CHF ${money(line.cents)} · gesamte Zeile`;}
 const box=node('div',undefined,'totals');box.append(node('p',`${result.points} Taxpunkte · ${draft.lines.length} Positionen`),node('strong',`${result.complete?'Rechensumme':'Unvollständige Teilsumme'}: CHF ${money(result.total)}`));if(result.missing)box.append(node('p',`${result.missing} Zeile(n) ohne berechenbaren CHF-Betrag. Nicht als Nullbetrag enthalten.`,'warning'));target.append(box);
 for(const w of result.warnings.slice(1))target.append(node('p',w,'warning'));
 }catch(error){target.append(node('p',`${error.message}. Eingabe nicht gespeichert; Export und Druck erst nach Korrektur möglich.`,'error'));for(const amount of document.querySelectorAll('[data-line-amount]'))amount.textContent='Nicht berechnet – Eingaben korrigieren';}}
function hydrate(){ $('workspace-label').value=draft.label;$('tpw').value=draft.tpw;$('workspace-notes').value=draft.notes;renderLines();renderCalculation();storageStatus();}
function renderPreview(workspace,target,print=false){
 const result=calculate(workspace,catalog);target.replaceChildren();target.append(node(print?'h1':'h3',workspace.label||'Physiotherapie · Rechensammlung'),node('p',`App ${workspace.app} · Schema ${workspace.schemaVersion} · Katalog ${catalog.id} · gültig ab 01.01.2026`),node('p',`Eigener Taxpunktwert: ${workspace.tpw===''?'unbekannt':workspace.tpw+' CHF/TP'} · ${result.points} TP`),node('p',`Gesamtnotiz: ${workspace.notes||'—'}`,'source-text'));
 for(const line of result.lines){const box=node('section',undefined,print?'print-line':'preview-line');box.dataset.previewId=line.id;box.append(node('h3',`${line.id} · ${line.position.title}`),node('p',`${line.quantity} × ${priceLabel(line.position)}${line.position.price.type==='purchase-cost'?' · selbst erfasst CHF '+(line.materialChf||'unbekannt')+' je Einheit':''}`),node('p',line.cents===null?`Offen: ${line.reason}`:`CHF ${money(line.cents)}`,'amount'),node('p',`Zeilennotiz: ${line.note||'—'}`,'source-text'));
 const rules=node(print?'div':'details');if(!print)rules.append(node('summary','Vollständige Originalregeln'));ruleContent(line.position,rules);box.append(rules);target.append(box);}
 target.append(node('p',`${result.complete?'Rechensumme':'Unvollständige Teilsumme'}: CHF ${money(result.total)} · offene Zeilen: ${result.missing}`,'amount'),node('p','Anzahl × TP × CHF/TP; fixe CHF-Werte ohne TPW. Ganze Zeile auf 0.01 CHF gerundet, halbe Rappen aufwärts, danach summiert. Fehlende Werte nicht als Nullbetrag.'));
 for(const warning of result.warnings)target.append(node('p',warning,'warning'));
 if(print){target.append(node('h2','Einleitende Bemerkungen · PDF S. 2'),node('p',catalog.intro,'source-text'),node('p',provenance.versionNote),node('p','Quelle: '+provenance.sources.find(s=>s.sha256===catalog.sourceSha256).url));}
}
function endPreview(){importRevision++;pending=null;backedUp=false;paused=false;$('import-json').value='';$('import-dialog').close();storageStatus();}
async function previewFile(){const revision=++importRevision,file=$('import-json').files[0];if(!file)return;backedUp=false;try{
 if(file.size>1000000)throw Error('Datei grösser als 1 MB');
 // Keep valid edits saved during the asynchronous read; pause only for the current modal preview.
 const raw=await file.text();if(revision!==importRevision)return;
 const parsed=parseWorkspace(raw,catalog);paused=true;previewBefore=guard.baseline;pending=structuredClone(parsed);renderPreview(pending,$('import-preview'));$('apply-import').disabled=true;$('import-status').textContent=guard.blocked?'Speicher ist geschützt. Vorschau möglich, Übernahme gesperrt.':'Vor Übernahme zuerst den aktuellen Entwurf herunterladen.';$('backup-before-import').disabled=guard.blocked;$('import-dialog').showModal();
 }catch(error){if(revision!==importRevision)return;pending=null;paused=false;$('import-json').value='';announce(`JSON nicht übernommen: ${error.message}`,true);}}
function bind(){
 for(const id of ['search','category'])$(id).addEventListener(id==='search'?'input':'change',()=>{visible=6;renderResults();});
 $('reset').addEventListener('click',()=>{$('search').value='';$('category').value='';visible=6;renderResults();$('search').focus();});$('more').addEventListener('click',()=>{visible+=6;renderResults();});
 $('close-details').addEventListener('click',()=>$('details-dialog').close());$('details-add').addEventListener('click',()=>{add(selected);$('details-dialog').close();});
 for(const [id,key] of [['workspace-label','label'],['workspace-notes','notes'],['tpw','tpw']])$(id).addEventListener('input',()=>{draft[key]=key==='tpw'?$(id).value.trim().replace(',','.'):$(id).value;save();});
 $('export-json').addEventListener('click',()=>{try{downloadWorkspace(draft);announce('JSON-Download ausgelöst. Datei lokal aufbewahren.');}catch(error){announce(error.message,true);}});
 $('export-csv').addEventListener('click',()=>{try{download('physiotherapie-sammlung.csv',workspaceCsv(draft,catalog),'text/csv;charset=utf-8');announce('CSV-Download ausgelöst; Textzellen gegen Formelinjektion geschützt.');}catch(error){announce(error.message,true);}});
 $('raw-storage').addEventListener('click',()=>{if(guard.baseline!==null)download('physiotherapie-gelesener-speicherstand.txt',guard.baseline,'text/plain;charset=utf-8');});
 $('print').addEventListener('click',()=>{try{renderPreview(draft,$('print-area'),true);window.print();}catch(error){announce(error.message,true);}});
 window.addEventListener('beforeprint',()=>{try{renderPreview(draft,$('print-area'),true);}catch(error){$('print-area').replaceChildren(node('p','Keine gültige Druckansicht: '+error.message));}});
 $('import-json').addEventListener('change',previewFile);$('cancel-import').addEventListener('click',endPreview);$('import-dialog').addEventListener('cancel',event=>{event.preventDefault();endPreview();});
 $('backup-before-import').addEventListener('click',()=>{try{downloadWorkspace(draft,'physiotherapie-vor-uebernahme.json');backedUp=true;$('apply-import').disabled=guard.blocked;$('import-status').textContent='Sicherungsdownload ausgelöst. Bitte aufbewahren; danach kann die Vorschau übernommen werden.';}catch(error){$('import-status').textContent=error.message;}});
 $('apply-import').addEventListener('click',()=>{if(!pending||!backedUp||guard.blocked)return;try{
  // Guard re-reads exact storage bytes immediately before the sole-key replacement.
  if(guard.baseline!==previewBefore)throw Error('Speicherbasis hat sich seit der Vorschau geändert');
  if(!guard.save(pending)){storageStatus();$('apply-import').disabled=true;$('import-status').textContent=guard.reason;return;}
  draft=structuredClone(pending);hydrate();endPreview();announce('Geprüfte Zusammenstellung übernommen und im eigenen Speicher zurückgelesen.');
 }catch(error){guard.freeze('Übernahme angehalten: '+error.message);storageStatus();$('apply-import').disabled=true;$('import-status').textContent=guard.reason;}});
 window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY||event.key===null){guard.freeze('Fremdänderung im lokalen Speicher. Entwurf bleibt erhalten; bitte JSON sichern und neu laden.');storageStatus();$('apply-import').disabled=true;}});
}
async function start(){try{
 const [catalogResponse,provenanceResponse]=await Promise.all([fetch(new URL('../data/catalog.json',import.meta.url)),fetch(new URL('../data/provenance.json',import.meta.url))]);if(!catalogResponse.ok||!provenanceResponse.ok)throw Error('Katalog oder Herkunft konnte nicht geladen werden');
 catalog=validateCatalog(await catalogResponse.json());provenance=validateProvenance(await provenanceResponse.json(),catalog);
 guard=createStorageGuard({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)},catalog);draft=structuredClone(guard.workspace||emptyWorkspace());
 for(const t of catalog.taxonomy){const option=node('option',`${t.overview} · ${t.label}`);option.value=t.id;$('category').append(option);}
 $('source-summary').append(node('p',`${catalog.positions.length} amtliche Positionen: 10 Taxpunktpositionen, 2 fixe CHF-Pauschalen, 1 Behandlungsmaterialposition mit offenem Einkaufspreis.`),node('p',provenance.scope),node('p',provenance.versionNote),node('p',provenance.taxPointValue.note));$('intro').textContent=catalog.intro;
 const links=$('provenance');for(const s of provenance.sources){const p=node('p');const a=node('a',s.title);a.href=s.url;p.append(a,node('br'),document.createTextNode(`${s.bytes} Bytes · SHA-256 ${s.sha256}`));links.append(p);}links.append(node('p',`Abruf: ${provenance.retrievedAt}. Publikationsdatum nicht gesondert in der Quelle ausgewiesen; Gültigkeit ist nicht Abrufzeit.`),node('p',provenance.extraction),node('p',provenance.rights.basis));const a=node('a','Art. 5 URG · amtlicher Gesetzestext');a.href=provenance.rights.lawUrl;links.append(a);
 bind();hydrate();renderResults();$('app').hidden=false;$('startup').textContent='';$('startup').hidden=true;document.body.dataset.ready='true';
 }catch(error){$('startup').textContent=`Katalog nicht aktiviert: ${error.message}. Bitte neu laden oder später erneut versuchen. Es wurden keine Ersatzdaten verwendet.`;$('startup').className='error';document.body.dataset.ready='false';}}
start();
