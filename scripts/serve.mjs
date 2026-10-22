import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runtimeFiles} from './files.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
export function createAppServer({root=path.join(project,'dist'),basePath='/'}={}){
 if(typeof basePath!=='string'||!basePath.startsWith('/')||!basePath.endsWith('/')||basePath.includes('..')||basePath.includes('?')||basePath.includes('#'))throw Error('basePath must be a simple absolute directory path ending with /');
 return http.createServer(async(req,res)=>{
  const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
  const send=(code,text)=>{res.writeHead(code,{...headers,'content-type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:text);};
  let host;try{host=new URL('http://'+req.headers.host).hostname;}catch{send(400,'Invalid Host');return;}
  if(!['127.0.0.1','localhost','[::1]'].includes(host)){send(403,'Local Host required');return;}
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');send(405,'Method not allowed');return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{send(400,'Bad URL');return;}
  if(!pathname.startsWith(basePath)){send(404,'Not found');return;}
  const relative=pathname.slice(basePath.length)||'index.html';
  if(!Object.hasOwn(runtimeFiles,relative)){send(404,'Not found');return;}
  try{
   const [target,realRoot]=await Promise.all([realpath(path.join(root,relative)),realpath(root)]);
   if(!target.startsWith(realRoot+path.sep)){send(404,'Not found');return;}
   const content=await readFile(target);res.writeHead(200,{...headers,'content-type':types[path.extname(relative)]||'application/octet-stream','content-length':content.length,'cache-control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
  }catch{send(404,'Not found');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const port=Number(process.env.PORT||3015);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');const server=createAppServer({basePath:process.env.BASE_PATH||'/'});server.listen(port,'127.0.0.1',()=>console.log(`Physiotherapie: http://127.0.0.1:${port}${process.env.BASE_PATH||'/'}`));}
