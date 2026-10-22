import {mkdir,mkdtemp,writeFile,rename,rm,lstat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {preflight,project} from './check.mjs';
export async function build({root=project}={}){
 const {buffers}=await preflight(root); // Read/validate ALL inputs before touching the last good output.
 const destination=path.join(root,'dist');
 try{const stat=await lstat(destination);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Refusing non-directory/symlink dist');}catch(error){if(error.code!=='ENOENT')throw error;}
 const stage=await mkdtemp(path.join(root,'.build-')),backup=path.join(stage,'previous');let moved=false;
 try{
  const output=path.join(stage,'output');await mkdir(output);
  for(const [name,data] of buffers){const filename=path.join(output,name);await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,data,{flag:'wx'});}
  try{await rename(destination,backup);moved=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  try{await rename(output,destination);}catch(error){if(moved)await rename(backup,destination);throw error;}
 }finally{await rm(stage,{recursive:true,force:true});}
 console.log(`BUILD OK: ${buffers.size} explicitly allowlisted files -> dist/`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await build();
