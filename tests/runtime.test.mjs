import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {runtimeFiles} from '../scripts/files.mjs';
import {build} from '../scripts/build.mjs';
import {createAppServer} from '../scripts/serve.mjs';
import http from 'node:http';
const project=path.resolve(new URL('../',import.meta.url).pathname);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(){const root=await mkdtemp(path.join(os.tmpdir(),'physio-tests-'));for(const src of Object.values(runtimeFiles)){const target=path.join(root,src);await mkdir(path.dirname(target),{recursive:true});await cp(path.join(project,src),target);}return root;}
async function inventory(root){const output={};async function walk(directory,prefix=''){for(const item of await readdir(directory,{withFileTypes:true})){const rel=prefix+item.name;if(item.isDirectory())await walk(path.join(directory,item.name),rel+'/');else output[rel]=hash(await readFile(path.join(directory,item.name)));}}await walk(root);return output;}
function request(port,url,method='GET',host='127.0.0.1'){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{Host:host}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();});}

test('allowlist excludes canaries and failed input never replaces last good build',async()=>{
 const root=await fixture();try{await mkdir(path.join(root,'sources'));await writeFile(path.join(root,'sources','private-canary.txt'),'private');await writeFile(path.join(root,'public','private-canary.txt'),'private');await build({root});const before=await inventory(path.join(root,'dist'));assert.deepEqual(Object.keys(before).sort(),Object.keys(runtimeFiles).sort());
 const file=path.join(root,'public/data/catalog.json'),original=await readFile(file);
 for(const bad of ['{','{}',JSON.stringify({...JSON.parse(original),positions:[]})]){await writeFile(file,bad);await assert.rejects(build({root}));assert.deepEqual(await inventory(path.join(root,'dist')),before);assert.equal((await readFile(file)).toString(),bad);}
 await rm(file);await assert.rejects(build({root}));assert.deepEqual(await inventory(path.join(root,'dist')),before);await writeFile(file,original);
 const jsfile=path.join(root,'src/app.js'),jsoriginal=await readFile(jsfile);await writeFile(jsfile,'export {{{');await assert.rejects(build({root}));assert.deepEqual(await inventory(path.join(root,'dist')),before);await writeFile(jsfile,jsoriginal);
 const pfile=path.join(root,'public/data/provenance.json'),p=JSON.parse(await readFile(pfile));p.sources[0].sha256={toString:null};await writeFile(pfile,JSON.stringify(p));await assert.rejects(build({root}));assert.deepEqual(await inventory(path.join(root,'dist')),before);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('read-only exact runtime server supports Pages subpath and blocks private/writes/foreign hosts',async()=>{
 const root=await fixture();let server;try{await build({root});server=createAppServer({root:path.join(root,'dist'),basePath:'/physiotherapie/'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
 for(const name of Object.keys(runtimeFiles)){const r=await request(port,'/physiotherapie/'+(name==='index.html'?'':name));assert.equal(r.status,200,name);assert.equal(hash(r.body),hash(await readFile(path.join(root,'dist',name))));assert.equal(r.headers['x-content-type-options'],'nosniff');}
 for(const url of ['/','/physiotherapie/sources/manifest.json','/physiotherapie/.local/canary','/physiotherapie/public/data/catalog.json','/physiotherapie/%2e%2e/package.json','/physiotherapie/package.json'])assert.equal((await request(port,url)).status,404,url);
 assert.equal((await request(port,'/physiotherapie/','POST')).status,405);assert.equal((await request(port,'/physiotherapie/','GET','attacker.invalid')).status,403);const head=await request(port,'/physiotherapie/','HEAD');assert.equal(head.status,200);assert.equal(head.body.length,0);assert.ok(head.headers['content-security-policy'].includes("connect-src 'self'"));
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
