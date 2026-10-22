import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runtimeFiles} from './files.mjs';
import {validateCatalog,validateProvenance} from '../src/domain.js';
export const project=fileURLToPath(new URL('../',import.meta.url));
export async function preflight(root=project){
 const buffers=new Map(),realRoot=await realpath(root);
 for(const [destination,source] of Object.entries(runtimeFiles)){
  if(destination.includes('..')||path.isAbsolute(destination))throw Error('Invalid runtime destination');
  const filename=path.join(root,source),stat=await lstat(filename),real=await realpath(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||!real.startsWith(realRoot+path.sep))throw Error('Runtime input must be an owned regular file: '+source);
  const data=await readFile(filename);if(!data.length)throw Error('Empty runtime input: '+source);
  if(destination.endsWith('.js')){const parsed=spawnSync(process.execPath,['--input-type=module','--check'],{input:data,encoding:'utf8'});if(parsed.status!==0)throw Error('Invalid runtime JavaScript: '+source+' '+parsed.stderr);}
  buffers.set(destination,data);
 }
 const catalog=validateCatalog(JSON.parse(buffers.get('data/catalog.json'))),provenance=validateProvenance(JSON.parse(buffers.get('data/provenance.json')),catalog),report=JSON.parse(buffers.get('data/import-report.json'));
 if(catalog.sourceSha256!=='d10462e61e5aa6594660dfa6e04d5085aa417caa7f2a54d0c8781e87278936a9')throw Error('Unreviewed catalog source');
 const values=['48','77','77','25','22','24','30','19','67','34',null,'50.00','90.00'];
 catalog.positions.forEach((p,i)=>{if(p.price.value!==values[i])throw Error('Unexpected source value');});
 if(report.schemaVersion!==1||report.positions!==13||report.points!==10||report.fixedChf!==2||report.purchaseCost!==1||report.codes.join('|')!==catalog.positions.map(p=>p.id).join('|')||report.missingRules!==0||report.overviewDetailMismatches!==0||report.unresolvedCombinationCodes.length!==0)throw Error('Import report mismatch');
 const html=buffers.get('index.html').toString();
 const links=[...html.matchAll(/href="https:\/\/wakuwakumiwaku\.github\.io\/([^/]+)\/"/g)].map(m=>m[1]);
 const expected=['dentotar','migel','spezialitaetenliste','analysenliste','pflegefinanzierung','arzneimittelliste','arzttarife','physiotherapie','spitaltarife'];
 if(links.length!==9||new Set(links).size!==9||!expected.every(id=>links.includes(id))||(html.match(/aria-current="page"/g)||[]).length!==1)throw Error('Navigation contract mismatch');
 if(!html.includes('id="search"')||!html.includes('id="results"'))throw Error('Missing native hooks');
 for(const [name,data] of buffers){const text=data.toString();if(/\/mnt\/[a-z]\/|\/home\/hermes\/|(?:api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"']+["']/i.test(text))throw Error('Private path/secret-shaped content: '+name);}
 return {buffers,catalog,provenance,report};
}
export async function check(){const result=await preflight();for(const file of ['src/app.js','src/domain.js','scripts/build.mjs','scripts/check.mjs','scripts/files.mjs','scripts/serve.mjs']){const r=spawnSync(process.execPath,['--check',path.join(project,file)],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||'Syntax failure');}console.log(`CHECK OK: ${Object.keys(runtimeFiles).length} runtime files; ${result.catalog.positions.length} official positions; source/provenance/report/navigation valid.`);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await check();
