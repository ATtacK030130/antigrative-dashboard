// Discover IDs and local archive locations. SQLite contents are never read on the main thread.
import {opendir,lstat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const conversationId=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const digest=value=>createHash('sha256').update(value).digest('hex');
async function stamp(file,directory=false){
 try{const s=await lstat(file,{bigint:true});if(s.isSymbolicLink()||!(directory?s.isDirectory():s.isFile()))return null;
  return [s.size,s.mtimeNs,s.ctimeNs,s.ino].map(String).join(':');
 }catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')return null;throw e;}
}
export async function discoverLocalConversations({host,home=homedir(),limit=20000}={}){
 if(!['app','ide'].includes(host))throw Error('Explicit conversation host is required');
 const base=join(home,'.gemini',host==='ide'?'antigravity-ide':'antigravity');
 const files=new Map(),pbFiles=new Map();let errors=0,visited=0;
 for(const [name,directory] of [['conversations',false],['brain',true]]){
  const root=join(base,name);
  try{
   // Do not follow a redirected host root into another installation.
   if(!await stamp(base,true)||!await stamp(root,true))continue;
   const dir=await opendir(root);
   for await(const entry of dir){
    if(++visited>limit)throw Error('Conversation discovery budget exceeded');
    if(entry.isSymbolicLink()||!(directory?entry.isDirectory():entry.isFile()))continue;
    if(!directory&&entry.name.endsWith('.pb')){
     const pbId=entry.name.slice(0,-3);
     if(conversationId.test(pbId))pbFiles.set(pbId.toLowerCase(),join(root,entry.name));
     continue;
    }
    const id=directory?entry.name:entry.name.endsWith('.db')?entry.name.slice(0,-3):'';
    if(!conversationId.test(id))continue;
    const key=id.toLowerCase(),parts=files.get(key)||[];
    parts.push({file:join(root,entry.name),directory});files.set(key,parts);
   }
  }catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))errors++;}
  if(visited>limit)break;
 }
 const conversations=[];
 for(const [id,parts]of files){
  const dbPart=parts.find(p=>!p.directory),dbFile=dbPart?.file||null;
  const pbFile=!dbFile?pbFiles.get(id):null;
  const readSignature=async()=>{
   const values=[];
   for(const {file,directory}of parts){const value=await stamp(file,directory);if(value===null)return null;
    values.push([directory?'brain':'db',value]);
    if(!directory)values.push(['wal',await stamp(file+'-wal')]);
   }
   if(pbFile){const pb=await stamp(pbFile,false);if(pb!==null)values.push(['pb',pb]);}
   return digest(JSON.stringify(values));
  };
  try{
   const signature=await readSignature();
   if(!signature)continue;
   const hasArchive=Boolean(dbFile||(pbFile&&await stamp(pbFile,false)!==null));
   conversations.push({id,signature,readSignature,hasArchive,...(dbFile?{dbFile}:{})});
  }
  catch{errors++;}
 }
 return {conversations,errors};
}
