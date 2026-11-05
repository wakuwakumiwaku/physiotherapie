import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createAppServer} from '../scripts/serve.mjs';
function request(port,host,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:'/fixture/',method,headers:{Host:host}},res=>{
   const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()}));
  });req.on('error',reject);req.setTimeout(3000,()=>req.destroy(Error('request timed out')));req.end();
 });
}
test('server checks the literal Host authority rather than URL-normalizing it',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'host-authority-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(path.join(root,'index.html'),'SYNTHETIC public fixture');
 const server=createAppServer({root,basePath:'/fixture/'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const port=server.address().port;
 for(const host of ['localhost','LOCALHOST:123','127.0.0.1','127.0.0.1:65535','[::1]','[::1]:80']){
  const r=await request(port,host);assert.equal(r.status,200,host);assert.equal(r.body,'SYNTHETIC public fixture');
 }
 for(const host of ['attacker.invalid@localhost','localhost/attacker.invalid','localhost?attacker.invalid','localhost#attacker.invalid','127.1','2130706433','0x7f000001','%31%32%37.0.0.1','localhost:0','localhost:65536','attacker.invalid']){
  for(const method of ['GET','HEAD']){
   const r=await request(port,host,method);assert.equal(r.status,403,`${method} must reject nonliteral authority ${host}`);assert.ok(!r.body.includes('public fixture'));
  }
 }
});
