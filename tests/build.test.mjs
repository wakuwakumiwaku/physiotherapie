import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rename,rm,symlink,readdir,lstat,readlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';

// External regression runners may select an exact archived tree without editing it.
const source=process.env.BUILD_SOURCE_ROOT?path.resolve(process.env.BUILD_SOURCE_ROOT):fileURLToPath(new URL('../',import.meta.url));
const {runtimeFiles}=await import(pathToFileURL(path.join(source,'scripts/files.mjs')).href);
const hash=data=>createHash('sha256').update(data).digest('hex');
async function fixture(){
 const owner=await mkdtemp(path.join(os.tmpdir(),'build-integrity-')),root=path.join(owner,'project');
 await mkdir(root);
 for(const file of new Set([...Object.values(runtimeFiles),...['scripts/build.mjs','scripts/check.mjs','scripts/files.mjs'],'package.json'])){
  const dest=path.join(root,file);await mkdir(path.dirname(dest),{recursive:true});await cp(path.join(source,file),dest);
 }
 return {owner,root};
}
async function inventory(root){
 const result={};
 async function walk(dir,prefix=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const name=prefix+entry.name;
   if(entry.isDirectory())await walk(path.join(dir,entry.name),name+'/');
   else result[name]=hash(await readFile(path.join(dir,entry.name)));
  }
 }
 await walk(root);return result;
}
function cli(root,label){
 const r=spawnSync(process.execPath,[path.join(root,'scripts/build.mjs')],{cwd:root,env:process.env,encoding:'utf8',timeout:30000});
 assert.equal(r.error,undefined,label+': build process must actually execute');
 console.log(JSON.stringify({label,command:[process.execPath,path.join(root,'scripts/build.mjs')],cwd:root,status:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr}));
 assert.equal(r.signal,null,label+': no timeout or signal');return r;
}
async function exactOutput(root){
 const expected={};for(const [dest,src]of Object.entries(runtimeFiles))expected[dest]=hash(await readFile(path.join(root,src)));
 assert.deepEqual(await inventory(path.join(root,'dist')),expected,'successful build contains only allowlisted original bytes');
}
async function absent(file){await assert.rejects(lstat(file),{code:'ENOENT'});}

for(const directory of ['src','public','public/data'])test('build CLI rejects inward symlink directory '+directory+' before replacing output',async()=>{
 const {owner,root}=await fixture();
 try{
  assert.equal(cli(root,'initial valid '+directory).status,0);await exactOutput(root);const before=await inventory(path.join(root,'dist'));
  const target=path.join(root,'.local','synthetic-'+directory.replaceAll('/','-'));await mkdir(path.dirname(target),{recursive:true});await rename(path.join(root,directory),target);
  // Synthetic code, not private source data: passing an ignored directory into an allowlisted path must not publish it.
  if(directory==='src')await writeFile(path.join(target,'app.js'),'export const syntheticIgnoredCanary = true;\n');
  await symlink(target,path.join(root,directory),'dir');
  const r=cli(root,'inward symlink '+directory);
  if(r.status===0)console.log(JSON.stringify({label:'unexpectedly published symlink input '+directory,outputSha256:await inventory(path.join(root,'dist')),syntheticCodePublished:directory==='src'&&(await readFile(path.join(root,'dist/src/app.js'),'utf8')).includes('syntheticIgnoredCanary')}));
  assert.notEqual(r.status,0,'build must reject a symlinked source directory, even inside the project');
  assert.match(r.stderr,/Runtime input|symlink/i);assert.deepEqual(await inventory(path.join(root,'dist')),before,'last good build must survive rejected source');
  await rm(path.join(root,'dist'),{recursive:true});assert.notEqual(cli(root,'fresh inward symlink '+directory).status,0);await absent(path.join(root,'dist'));
 }finally{await rm(owner,{recursive:true,force:true});}
});
test('build CLI rejects external directory and leaf symlinks without changing good output',async()=>{
 const {owner,root}=await fixture();
 try{
  assert.equal(cli(root,'initial controls').status,0);const before=await inventory(path.join(root,'dist'));
  await rename(path.join(root,'src'),path.join(owner,'external-src'));await symlink(path.join(owner,'external-src'),path.join(root,'src'),'dir');
  assert.notEqual(cli(root,'external directory').status,0);assert.deepEqual(await inventory(path.join(root,'dist')),before);
  await rm(path.join(root,'src'));await rename(path.join(owner,'external-src'),path.join(root,'src'));
  await rename(path.join(root,'src/app.js'),path.join(root,'src/held.js'));await symlink('held.js',path.join(root,'src/app.js'));
  assert.notEqual(cli(root,'leaf link').status,0);assert.deepEqual(await inventory(path.join(root,'dist')),before);
 }finally{await rm(owner,{recursive:true,force:true});}
});
test('normal build remains byte-exact and supports a caller-selected root alias',async()=>{
 const {owner,root}=await fixture();
 try{
  await mkdir(path.join(root,'.local'));await writeFile(path.join(root,'.local/synthetic-canary.txt'),'must not publish');
  const alias=path.join(owner,'project-alias');await symlink(root,alias,'dir');
  assert.equal(cli(root,'valid ordinary root').status,0);await exactOutput(root);
  // The exported build(root) contract supports an explicit root alias; the CLI's entrypoint identity is separate.
  const command=[process.execPath,'--input-type=module','--eval',`const {build}=await import(${JSON.stringify(pathToFileURL(path.join(root,'scripts/build.mjs')).href)});await build({root:${JSON.stringify(alias)}});`];
  const r=spawnSync(command[0],command.slice(1),{cwd:root,env:process.env,encoding:'utf8',timeout:30000});
  console.log(JSON.stringify({label:'explicit root alias',command,cwd:root,status:r.status,stdout:r.stdout,stderr:r.stderr}));
  assert.equal(r.error,undefined);assert.equal(r.status,0);await exactOutput(root);
  assert.deepEqual((await readdir(root)).filter(n=>n.startsWith('.build-')),[]);
 }finally{await rm(owner,{recursive:true,force:true});}
});
