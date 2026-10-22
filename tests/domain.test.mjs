import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCatalog,validateProvenance,emptyWorkspace,validateWorkspace,parseWorkspace,calculate,money,decimal,quantity,searchCatalog,csvCell,workspaceCsv,createStorageGuard,STORAGE_KEY} from '../src/domain.js';
const catalog=validateCatalog(JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url))));
const provenance=JSON.parse(await readFile(new URL('../public/data/provenance.json',import.meta.url)));
const line=(id,quantity='1',materialChf='',note='')=>({id,quantity,materialChf,note});
const plan=(lines=[],tpw='')=>({...emptyWorkspace(),lines,tpw});

test('all thirteen official positions, literal codes, typed prices and complete rules',()=>{
 assert.equal(catalog.positions.length,13);assert.deepEqual(catalog.positions.map(p=>p.code),['7301','7311','7313','7330','7340','7350','7351','7352','7353','7354','7361','7362','7363']);
 assert.deepEqual(catalog.positions.map(p=>p.price.type),[...Array(10).fill('points'),'purchase-cost','chf','chf']);
 assert.deepEqual(catalog.positions.map(p=>p.price.value),['48','77','77','25','22','24','30','19','67','34',null,'50.00','90.00']);
 assert.equal(validateProvenance(provenance,catalog),provenance);
 assert.ok(catalog.positions.find(p=>p.id==='7350').notes.includes('36 Sitzungen'));assert.ok(catalog.positions.find(p=>p.id==='7350').notes.includes('sechs Monate'));
 assert.ok(catalog.positions.find(p=>p.id==='7340').notes.includes('zwei Sitzungen'));assert.ok(catalog.positions.find(p=>p.id==='7354').notes.includes('keine Weg-'));
 assert.equal(catalog.positions.find(p=>p.id==='7362').notes,catalog.positions.find(p=>p.id==='7363').notes);assert.ok(catalog.positions.find(p=>p.id==='7362').notes.includes('maximal einmal pro Kalenderjahr'));
 assert.deepEqual(catalog.positions.find(p=>p.id==='7311').detailPages,[4,5]);assert.deepEqual(catalog.positions.find(p=>p.id==='7350').detailPages,[5,6]);
 assert.deepEqual(catalog.positions.find(p=>p.id==='7340').allowedSupplements,[]);assert.deepEqual(catalog.positions.find(p=>p.id==='7353').allowedSessions,['7313']);
});
test('whole-line half-up rounding, not unit rounding; exact six-place TPW',()=>{
 const r=calculate(plan([line('7301','3')],'0.333333'),catalog);assert.equal(money(r.total),'48.00'); // unit-rounded result would be 48.00 too
 const low=calculate(plan([line('7330','3')],'0.0002'),catalog);assert.equal(money(low.total),'0.02'); // 3 * 25 * .0002 = .015, not 3 * .01
 assert.equal(money(calculate(plan([line('7330')],'0.0002'),catalog).total),'0.01');
 assert.equal(money(calculate(plan([line('7301','9'),line('7350')],'1.05'),catalog).total),'478.80');
 assert.equal(money(calculate(plan([line('7301','999999')],'999999999.999999'),catalog).total),'47999951999999952.00');
});
test('fixed CHF independent of TPW; unknown/material/zero distinct',()=>{
 const r=calculate(plan([line('7301'),line('7362'),line('7361')]),catalog);assert.equal(money(r.total),'50.00');assert.equal(r.missing,2);assert.equal(r.complete,false);
 assert.equal(money(calculate(plan([line('7363','2')],'8.999999'),catalog).total),'180.00');
 assert.equal(money(calculate(plan([line('7361','3','1.25')]),catalog).total),'3.75');
 assert.equal(calculate(plan([line('7301')],'0'),catalog).missing,0);assert.equal(calculate(plan([line('7361','1','0')]),catalog).missing,0);
 assert.equal(calculate(plan([line('7362'),line('7363')]),catalog).warnings.length,2);
});
test('full-corpus search includes limitations, diacritics and categories',()=>{
 assert.ok(searchCatalog(catalog,'sechs Monate').some(p=>p.id==='7350'));assert.ok(searchCatalog(catalog,'aufwandige').some(p=>p.id==='7311'));assert.ok(searchCatalog(catalog,'Skelettmuskulatur').some(p=>p.id==='7351'));
 assert.equal(searchCatalog(catalog,'','incontinence').length,2);assert.equal(searchCatalog(catalog,'unauffindbar').length,0);assert.equal(searchCatalog(catalog).length,13);
});
test('strict full import validation refuses malformed primitive types and fields',()=>{
 const valid=plan([line('7301')],'1.05');assert.deepEqual(parseWorkspace(JSON.stringify(valid),catalog),valid);
 const changes=[w=>w.schemaVersion='1',w=>w.app=['physiotherapie'],w=>w.catalogId={},w=>w.label=null,w=>w.notes=1,w=>w.tpw=1,w=>w.tpw='1e2',w=>w.extra=true,w=>w.lines[0].id=['7301'],w=>w.lines[0].quantity=1,w=>w.lines[0].quantity='0',w=>w.lines[0].quantity='1.5',w=>w.lines[0].materialChf='1',w=>w.lines[0].note={},w=>w.lines.push(line('7301')),w=>w.lines.push(line('9999'))];
 for(const mutate of changes){const w=structuredClone(valid);mutate(w);assert.throws(()=>validateWorkspace(w,catalog));}
 for(const raw of ['null','[]','{}','{','"x"'])assert.throws(()=>parseWorkspace(raw,catalog));
 for(const value of ['-1','01','1.1234567','Infinity','NaN','1,2',' 1','1.','0x1'])assert.throws(()=>decimal(value));
 assert.throws(()=>quantity('1000000'));assert.throws(()=>parseWorkspace(' '.repeat(1000001),catalog));
});
test('provenance type attacks rejected before activation',()=>{
 for(const bad of [null,{}, {toString:null},'nope',1]){const p=structuredClone(provenance);p.sources[0].sha256=bad;assert.throws(()=>validateProvenance(p,catalog));}
});
test('guard makes no startup writes, protects malformed, denied and foreign-tab state',()=>{
 const map=new Map([['migel.workspace.v1','foreign']]);let writes=0;
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>{writes++;map.set(k,v);}};const g=createStorageGuard(storage,catalog);assert.equal(writes,0);assert.equal(g.save(plan([line('7301')])),true);assert.equal(writes,1);assert.equal(map.get('migel.workspace.v1'),'foreign');
 const before=g.baseline;map.set(STORAGE_KEY,'foreign tab');assert.equal(g.save(plan([line('7311')])),false);assert.equal(map.get(STORAGE_KEY),'foreign tab');assert.equal(g.baseline,before);assert.equal(g.blocked,true);
 const bad=createStorageGuard({getItem:()=>'{bad',setItem:()=>{throw Error('must not write');}},catalog);assert.equal(bad.blocked,true);assert.equal(bad.baseline,'{bad');assert.equal(bad.save(emptyWorkspace()),false);
 const denied=createStorageGuard({getItem:()=>{throw Error('denied');},setItem:()=>assert.fail()},catalog);assert.equal(denied.blocked,true);
 const full=createStorageGuard({getItem:()=>null,setItem:()=>{throw Error('quota');}},catalog);assert.equal(full.save(emptyWorkspace()),false);assert.ok(full.reason.includes('quota'));
});
test('CSV neutralizes leading-whitespace formulas; fresh notes used without reload',()=>{
 for(const text of ['=SUM(A1)','   =1','\t+1','\n@A1','-5'])assert.ok(csvCell(text).startsWith('"\''));
 const workspace=plan([line('7301','1','','new "note"; =x')],'1.05');workspace.label='  =HYPERLINK(1)';workspace.notes='fresh';let csv=workspaceCsv(workspace,catalog);assert.ok(csv.includes("'  =HYPERLINK(1)"));assert.ok(csv.includes('new ""note""; =x'));assert.ok(csv.includes('fresh'));
 workspace.notes='replacement';workspace.lines[0].note='';csv=workspaceCsv(workspace,catalog);assert.ok(csv.includes('replacement'));assert.ok(!csv.includes('fresh'));assert.ok(!csv.includes('new ""note'));
});
