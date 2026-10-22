export const STORAGE_KEY = 'physiotherapie.workspace.v1';
export const APP_ID = 'physiotherapie';
export const CATALOG_ID = 'physiotherapie-2026';
const EXPECTED = ['7301','7311','7313','7330','7340','7350','7351','7352','7353','7354','7361','7362','7363'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireThat(condition, message) { if (!condition) throw Error(message); }
function keys(object, expected, label) {
  requireThat(isObject(object) && Object.keys(object).sort().join('|') === [...expected].sort().join('|'), `${label}: unerwartete oder fehlende Felder`);
}
function string(value, max, label) { requireThat(typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value), `${label}: ungültiger Text`); }
export function decimal(value, places=6) {
  requireThat(typeof value === 'string' && new RegExp(`^(?:0|[1-9][0-9]{0,8})(?:\\.[0-9]{1,${places}})?$`).test(value), 'Ungültige Dezimalzahl');
  const [whole, fraction=''] = value.split('.');
  return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places,'0'));
}
export function quantity(value) {
  requireThat(typeof value === 'string' && /^[1-9][0-9]{0,5}$/.test(value), 'Anzahl: ganze Zahl von 1 bis 999999 erforderlich');
  return BigInt(value);
}
export function money(cents) {
  requireThat(typeof cents === 'bigint' && cents >= 0n, 'Ungültiger Geldbetrag');
  return `${cents / 100n}.${String(cents % 100n).padStart(2,'0')}`;
}
export function validateCatalog(catalog) {
  requireThat(isObject(catalog) && catalog.schemaVersion === 1 && catalog.id === CATALOG_ID && catalog.validFrom === '2026-01-01', 'Unbekannter Katalog');
  requireThat(typeof catalog.title==='string' && typeof catalog.intro==='string' && catalog.intro.length>500 && catalog.introPage===2 && /^[0-9a-f]{64}$/.test(catalog.sourceSha256),'Unvollständige Katalog-Metadaten');
  requireThat(Array.isArray(catalog.taxonomy) && catalog.taxonomy.length === 3, 'Fehlende Quellhierarchie');
  const categories = new Set();
  for (const t of catalog.taxonomy) { requireThat(isObject(t) && ['sessions','supplements','incontinence'].includes(t.id) && typeof t.label==='string' && typeof t.overview==='string' && typeof t.detail==='string' && !categories.has(t.id),'Ungültige Hierarchie'); categories.add(t.id); }
  requireThat(Array.isArray(catalog.positions) && catalog.positions.map(p=>p?.id).join('|')===EXPECTED.join('|'), 'Unvollständiger Positionssatz');
  for (const p of catalog.positions) {
    requireThat(p.id===p.code && typeof p.title==='string' && p.title.length>5 && typeof p.notes==='string' && p.notes.length>50 && categories.has(p.category), 'Ungültige Position');
    requireThat(isObject(p.price) && ['points','chf','purchase-cost'].includes(p.price.type), 'Ungültige Preisbasis');
    if (p.price.type==='points') requireThat(typeof p.price.value==='string' && /^[1-9][0-9]*$/.test(p.price.value), 'Ungültige Taxpunkte');
    if (p.price.type==='chf') decimal(p.price.value,2);
    if (p.price.type==='purchase-cost') requireThat(p.price.value===null, 'Fehlender Wert darf nicht null CHF werden');
    for (const key of ['sourcePages','detailPages']) requireThat(Array.isArray(p[key]) && p[key].length>0 && p[key].every(n=>Number.isInteger(n) && n>=1 && n<=7), 'Ungültige PDF-Seite');
    for (const key of ['allowedSupplements','allowedSessions']) requireThat(Array.isArray(p[key]) && new Set(p[key]).size===p[key].length && p[key].every(c=>typeof c==='string' && EXPECTED.includes(c)), 'Ungültige Kombinationsreferenz');
  }
  return catalog;
}
export function validateProvenance(provenance,catalog) {
  requireThat(isObject(provenance) && provenance.schemaVersion===1 && provenance.catalogId===catalog.id && typeof provenance.retrievedAt==='string' && !Number.isNaN(Date.parse(provenance.retrievedAt)), 'Ungültige Provenienz');
  for (const key of ['versionNote','scope','extraction']) requireThat(typeof provenance[key]==='string' && provenance[key].length>10,'Fehlender Herkunftstext');
  requireThat(isObject(provenance.rights) && typeof provenance.rights.basis==='string' && typeof provenance.rights.lawUrl==='string' && provenance.rights.lawUrl.startsWith('https://www.fedlex.admin.ch/'), 'Ungültiger Nutzungsbefund');
  requireThat(isObject(provenance.taxPointValue) && provenance.taxPointValue.status==='unknown' && typeof provenance.taxPointValue.note==='string', 'Unbekannter Taxpunktwert-Status');
  requireThat(Array.isArray(provenance.sources) && provenance.sources.length===2,'Fehlende Quellen');
  for (const s of provenance.sources) requireThat(isObject(s) && typeof s.title==='string' && typeof s.file==='string' && Number.isSafeInteger(s.bytes) && s.bytes>0 && typeof s.sha256==='string' && /^[a-f0-9]{64}$/.test(s.sha256) && typeof s.url==='string' && /^https:\/\/www\.(bag|fedlex)\.admin\.ch\//.test(s.url), 'Ungültige Quelle');
  requireThat(provenance.sources.some(s=>s.sha256===catalog.sourceSha256),'Quellenbindung fehlt');
  return provenance;
}
export function emptyWorkspace() { return {schemaVersion:1,app:APP_ID,catalogId:CATALOG_ID,label:'',tpw:'',notes:'',lines:[]}; }
export function validateWorkspace(workspace,catalog) {
  keys(workspace,['schemaVersion','app','catalogId','label','tpw','notes','lines'],'Zusammenstellung');
  requireThat(workspace.schemaVersion===1 && workspace.app===APP_ID && workspace.catalogId===catalog.id,'Falsche App, Version oder Katalog');
  string(workspace.label,120,'Titel'); string(workspace.notes,4000,'Notiz');
  requireThat(typeof workspace.tpw==='string','Taxpunktwert muss Text sein'); if (workspace.tpw!=='') decimal(workspace.tpw);
  requireThat(Array.isArray(workspace.lines) && workspace.lines.length<=catalog.positions.length, 'Ungültige Positionsliste');
  const ids=new Set(), map=new Map(catalog.positions.map(p=>[p.id,p]));
  for (const line of workspace.lines) {
    keys(line,['id','quantity','materialChf','note'],'Zeile');
    requireThat(typeof line.id==='string' && map.has(line.id) && !ids.has(line.id),'Unbekannte oder doppelte Positions-ID'); ids.add(line.id);
    quantity(line.quantity); string(line.note,1000,'Zeilennotiz');
    requireThat(typeof line.materialChf==='string','Materialbetrag muss Text sein');
    if (map.get(line.id).price.type==='purchase-cost') { if(line.materialChf!=='') decimal(line.materialChf,2); }
    else requireThat(line.materialChf==='','Materialbetrag nur bei 7361 erlaubt');
  }
  return workspace;
}
export function parseWorkspace(raw,catalog) {
  requireThat(typeof raw==='string' && raw.length<=1000000,'Datei zu gross oder ungültig');
  return validateWorkspace(JSON.parse(raw),catalog);
}
export function priceLabel(position) {
  if(position.price.type==='points') return `${position.price.value} TP`;
  if(position.price.type==='chf') return `CHF ${position.price.value} · Fixbetrag`;
  return 'Einkaufspreis · Betrag offen';
}
export function calculate(workspace,catalog) {
  validateWorkspace(workspace,catalog);
  const map=new Map(catalog.positions.map(p=>[p.id,p])); let total=0n,points=0n,missing=0;
  const lines=workspace.lines.map(line=>{
    const p=map.get(line.id), count=quantity(line.quantity); let cents=null, reason='';
    if(p.price.type==='points') {
      points+=count*BigInt(p.price.value);
      if(workspace.tpw==='') reason='Taxpunktwert fehlt';
      else cents=(count*BigInt(p.price.value)*decimal(workspace.tpw)+5000n)/10000n;
    } else if(p.price.type==='chf') cents=count*decimal(p.price.value,2);
    else if(line.materialChf==='') reason='Einkaufspreis fehlt';
    else cents=count*decimal(line.materialChf,2);
    if(cents===null) missing++; else total+=cents;
    return {...line,position:p,cents,reason};
  });
  const warnings=[];
  if(workspace.lines.length) warnings.push('Rechensammlung, kein einzelner Behandlungsfall: Sitzungs-, Alters-, Indikations-, Frequenz- und Verordnungsregeln werden nicht automatisch geprüft. Keine Zusage einer Vergütung.');
  if(workspace.lines.some(l=>l.id==='7362') && workspace.lines.some(l=>l.id==='7363')) warnings.push('7362 und 7363 dürfen nicht miteinander kumuliert werden (PDF S. 7). Beide sind hier nur als Vergleichsszenario enthalten.');
  return {lines,total,points,missing,complete:missing===0,warnings};
}
export function searchCatalog(catalog,query='',category='') {
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  return catalog.positions.filter(p=>(category==='' || p.category===category) && terms.every(t=>normalize([p.code,p.title,p.notes,...p.allowedSupplements,...p.allowedSessions,catalog.taxonomy.find(c=>c.id===p.category).label].join(' ')).includes(t)));
}
export function normalize(value) { return value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase(); }
export function csvCell(value) { let text=String(value); if(/^\s*[=+\-@]/u.test(text)) text="'"+text; return '"'+text.replaceAll('"','""')+'"'; }
export function workspaceCsv(workspace,catalog) {
  const result=calculate(workspace,catalog);
  const rows=[['Titel','Code','Position','Preisbasis','Quellwert','Anzahl','CHF/TP (eigene Eingabe)','Material CHF je Einheit','Zeilensumme CHF (gerundet)','Status','Zeilennotiz','Gesamtnotiz','Katalog','PDF-Seiten'],...result.lines.map(l=>[workspace.label,l.id,l.position.title,l.position.price.type,l.position.price.value??'',l.quantity,workspace.tpw,l.materialChf,l.cents===null?'':money(l.cents),l.reason||'Rechenwert, keine Vergütungszusage',l.note,workspace.notes,catalog.id,l.position.detailPages.join(',')])];
  return '\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
export function createStorageGuard(storage,catalog) {
  let baseline=null,blocked=false,reason='',workspace=emptyWorkspace();
  try {baseline=storage.getItem(STORAGE_KEY); if(baseline!==null) workspace=parseWorkspace(baseline,catalog);}
  catch(error) {blocked=true;reason=`Speicher nicht lesbar oder beschädigt: ${error.message}`;}
  return {
    get baseline(){return baseline;},get blocked(){return blocked;},get reason(){return reason;},get workspace(){return workspace;},
    freeze(message){blocked=true;reason=message;},
    save(next) {
      validateWorkspace(next,catalog);
      if(blocked) return false;
      try {
        if(storage.getItem(STORAGE_KEY)!==baseline) {blocked=true;reason='Andere Registerkarte hat den Speicher geändert. Lokaler Entwurf bleibt erhalten; bitte sichern und neu laden.';return false;}
        const serialized=JSON.stringify(next); storage.setItem(STORAGE_KEY,serialized);
        if(storage.getItem(STORAGE_KEY)!==serialized) throw Error('Speicheränderung konnte nicht bestätigt werden');
        baseline=serialized;workspace=structuredClone(next);return true;
      } catch(error) {blocked=true;reason=`Speichern blockiert: ${error.message}. Entwurf bitte als JSON sichern.`;return false;}
    },
  };
}
