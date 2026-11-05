import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../',import.meta.url));
async function inventory(root,prefix=''){
  const out={};for(const e of await readdir(root,{withFileTypes:true})){
    const name=prefix+e.name,file=join(root,e.name);
    if(e.isDirectory())Object.assign(out,await inventory(file,name+'/'));
    else out[name]=createHash('sha256').update(await readFile(file)).digest('hex');
  }return out;
}
for(const rollbackFails of [false,true])test(`failed build publication ${rollbackFails?'retains the recoverable last good artifact when rollback fails':'restores the last good artifact'}`,async()=>{
  const root=await mkdtemp(join(tmpdir(),'physio-rollback-'));
  try{
    for(const name of ['scripts','src','public','index.html','package.json'])await cp(join(source,name),join(root,name),{recursive:true});
    const build=(args=[])=>spawnSync(process.execPath,[...args,'scripts/build.mjs'],{cwd:root,encoding:'utf8',timeout:30000});
    const good=build();assert.equal(good.status,0,good.stderr);
    await writeFile(join(root,'dist','last-good-marker.txt'),'Synthetic last good output');
    const before=await inventory(join(root,'dist')),preload=join(root,'fault.mjs');
    await writeFile(preload,`import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {basename} from 'node:path';
const rename=fs.promises.rename;
fs.promises.rename=async function(from,to){
  if(basename(to)==='dist'&&(basename(from)==='output'||(${rollbackFails}&&basename(from)==='previous')))throw Object.assign(new Error('Synthetic '+basename(from)+' rename refusal'),{code:'EIO'});
  return rename.call(this,from,to);
};syncBuiltinESMExports();`);
    const bad=build(['--import',preload]);assert.notEqual(bad.status,0);assert.match(bad.stderr,/Synthetic (output|previous) rename refusal/);
    const stages=(await readdir(root)).filter(n=>n.startsWith('.build-'));
    if(rollbackFails){
      assert.equal(stages.length,1,'must not delete the only complete artifact after a refused rollback');
      assert.match(bad.stderr,/Synthetic output rename refusal/);assert.match(bad.stderr,/Synthetic previous rename refusal/);
      const retained=join(root,stages[0],'previous');
      assert.deepEqual(await inventory(retained),before,'every last-good byte remains recoverable');
      assert.ok(bad.stderr.includes(retained),'error must identify the exact recovery directory');
    }else{
      assert.deepEqual(await inventory(join(root,'dist')),before);assert.deepEqual(stages,[]);
    }
  }finally{await rm(root,{recursive:true,force:true});}
});
