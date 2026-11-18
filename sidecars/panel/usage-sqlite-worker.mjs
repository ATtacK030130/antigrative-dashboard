// Read-only SQLite trajectory usage extractor for historical backfill.
// Wire-scans numeric usage, timestamps and delegation IDs without loading prompts or tool text.
import {parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {lstat,mkdir,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';
import {usageRecords} from './usage.mjs';

const GUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_DB_BYTES=512*1024*1024,MAX_STEPS=1_000_000,MAX_DISK_ROWS=262144,MAX_DISK_BYTES=64*1024*1024;
const API_PROVIDERS={
 1:'API_PROVIDER_INTERNAL',
 3:'API_PROVIDER_GOOGLE_VERTEX',
 24:'API_PROVIDER_GOOGLE_GEMINI',
 26:'API_PROVIDER_ANTHROPIC_VERTEX',
 30:'API_PROVIDER_GOOGLE_EVERGREEN',
 31:'API_PROVIDER_OPENAI_VERTEX',
 32:'API_PROVIDER_OPENAI_RESPONSES_VERTEX',
};

const cancel=new Int32Array(workerData.cancel),sleeper=new Int32Array(new SharedArrayBuffer(4));
let operations=0;
function check(){
 if(Atomics.load(cancel,0))throw Error('Usage operation cancelled');
 if(++operations%128===0)Atomics.wait(sleeper,0,0,1);
}

function readVarint(buf,i,end=buf.length){
 let val=0n,shift=0n;
 while(i<end){
  const b=buf[i++];
  val|=BigInt(b&0x7f)<<shift;
  if((b&0x80)===0)return [val,i];
  shift+=7n;
  if(shift>63n)throw Error('Malformed varint');
 }
 throw Error('Truncated varint');
}

function readSliceBounds(buf,i,end){
 const [len,start]=readVarint(buf,i,end);
 const sliceEnd=start+Number(len);
 if(len<0n||!Number.isSafeInteger(sliceEnd)||sliceEnd>end)throw Error('Truncated field');
 return [start,sliceEnd];
}

function skipField(buf,i,wt,end){
 if(wt===0){const [,next]=readVarint(buf,i,end);return next;}
 if(wt===1){if(i+8>end)throw Error('Truncated fixed64');return i+8;}
 if(wt===2){const [,next]=readSliceBounds(buf,i,end);return next;}
 if(wt===5){if(i+4>end)throw Error('Truncated fixed32');return i+4;}
 throw Error('Unsupported wire type');
}

function parseTimestampIso(buf,start,end){
 let i=start,seconds=0n,nanos=0n;
 while(i<end){
  const [tag,ni]=readVarint(buf,i,end);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(wt===0){
   const [v,n2]=readVarint(buf,i,end);i=n2;
   if(fn===1)seconds=v;else if(fn===2)nanos=v;
  }else i=skipField(buf,i,wt,end);
 }
 if(seconds<=0n||seconds>253402300799n||nanos>=1000000000n)return undefined;
 return new Date(Number(seconds)*1000+Math.floor(Number(nanos)/1e6)).toISOString();
}

function parseStepCreatedAt(buf){
 let i=0,createdAt;
 while(i<buf.length){
  const [tag,ni]=readVarint(buf,i,buf.length);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(fn===1&&wt===2){const [s,e]=readSliceBounds(buf,i,buf.length);createdAt=parseTimestampIso(buf,s,e);i=e;}
  else i=skipField(buf,i,wt,buf.length);
 }
 return createdAt;
}

function addGuid(buf,start,end,selfId,out){
 if(end-start!==36)return;
 const value=buf.toString('utf8',start,end);
 if(GUID.test(value)){const lower=value.toLowerCase();if(lower!==selfId)out.add(lower);}
}

function parseInvokeResultIds(buf,start,end,selfId,out){
 let i=start;
 while(i<end){
  const [tag,ni]=readVarint(buf,i,end);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(fn===5&&wt===2){const [s,e]=readSliceBounds(buf,i,end);addGuid(buf,s,e,selfId,out);i=e;}
  else i=skipField(buf,i,wt,end);
 }
}

function parseInvokeSubagentPayload(buf,selfId,out){
 let i=0;
 while(i<buf.length){
  const [tag,ni]=readVarint(buf,i,buf.length);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(fn===143&&wt===2){
   const [s,e]=readSliceBounds(buf,i,buf.length);let j=s;
   while(j<e){
    const [it,nj]=readVarint(buf,j,e);j=nj;
    const ifn=Number(it>>3n),iwt=Number(it&7n);
    if(!ifn)throw Error('Invalid field number');
    if(iwt===2&&(ifn===5||ifn===10)){
     const [is,ie]=readSliceBounds(buf,j,e);
     if(ifn===5)addGuid(buf,is,ie,selfId,out);
     else parseInvokeResultIds(buf,is,ie,selfId,out);
     j=ie;
    }else j=skipField(buf,j,iwt,e);
   }
   i=e;
  }else i=skipField(buf,i,wt,buf.length);
 }
}

function parseLabelEntry(buf,start,end){
 let i=start,key='',value='';
 while(i<end){
  const [tag,ni]=readVarint(buf,i,end);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(wt===2&&(fn===1||fn===2)){
   const [s,e]=readSliceBounds(buf,i,end);
   const text=buf.toString('utf8',s,e);
   if(fn===1)key=text;else value=text;
   i=e;
  }else i=skipField(buf,i,wt,end);
 }
 return [key,value];
}

function parseUsageStats(buf,start,end){
 let i=start;const usage={};
 while(i<end){
  const [tag,ni]=readVarint(buf,i,end);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(wt===0){
   const [v,n2]=readVarint(buf,i,end);i=n2;
   if(fn===2)usage.inputTokens=String(v);
   else if(fn===3)usage.outputTokens=String(v);
   else if(fn===4)usage.cacheWriteTokens=String(v);
   else if(fn===5)usage.cacheReadTokens=String(v);
   else if(fn===6){
    const pn=Number(v);
    if(pn!==0){
     const name=API_PROVIDERS[pn];
     if(!name)return null;
     usage.apiProvider=name;
    }
   }
  }else if(wt===2&&(fn===7||fn===11)){
   const [s,e]=readSliceBounds(buf,i,end);
   const text=buf.toString('utf8',s,e);
   if(fn===7)usage.messageId=text;else usage.responseId=text;
   i=e;
  }else i=skipField(buf,i,wt,end);
 }
 return usage;
}

function parseChatStartCreatedAt(buf,start,end){
 let i=start,createdAt;
 while(i<end){
  const [tag,ni]=readVarint(buf,i,end);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(fn===4&&wt===2){const [s,e]=readSliceBounds(buf,i,end);createdAt=parseTimestampIso(buf,s,e);i=e;}
  else i=skipField(buf,i,wt,end);
 }
 return createdAt;
}

function parseChatModel(buf,start,end){
 let i=start,modelDisplayName,responseModel,modelEnum,createdAt,usage;
 while(i<end){
  const [tag,ni]=readVarint(buf,i,end);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(wt===2){
   const [s,e]=readSliceBounds(buf,i,end);
   if(fn===21)modelDisplayName=buf.toString('utf8',s,e);
   else if(fn===19)responseModel=buf.toString('utf8',s,e);
   else if(fn===20){const [k,v]=parseLabelEntry(buf,s,e);if(k==='model_enum'&&v)modelEnum=v;}
   else if(fn===9)createdAt=parseChatStartCreatedAt(buf,s,e);
   else if(fn===4){usage=parseUsageStats(buf,s,e);if(usage===null)return null;}
   i=e;
  }else i=skipField(buf,i,wt,end);
 }
 return {modelDisplayName,responseModel,...(modelEnum?{model:modelEnum}:{}),...(usage?{usage}:{}),...(createdAt?{chatStartMetadata:{createdAt}}:{})};
}

function parseGenMetadataRow(buf){
 let i=0,chatModel=null;const stepIndices=[];
 while(i<buf.length){
  const [tag,ni]=readVarint(buf,i,buf.length);i=ni;
  const fn=Number(tag>>3n),wt=Number(tag&7n);
  if(!fn)throw Error('Invalid field number');
  if(fn===1&&wt===2){
   const [s,e]=readSliceBounds(buf,i,buf.length);
   chatModel=parseChatModel(buf,s,e);
   if(chatModel===null)return null;
   i=e;
  }else if(fn===2&&wt===2){
   const [s,e]=readSliceBounds(buf,i,buf.length);
   let p=s;while(p<e){const [sv,np]=readVarint(buf,p,e);p=np;stepIndices.push(Number(sv));}
   i=e;
  }else if(fn===2&&wt===0){
   const [v,n2]=readVarint(buf,i,buf.length);i=n2;stepIndices.push(Number(v));
  }else i=skipField(buf,i,wt,buf.length);
 }
 return {stepIndices,chatModel};
}

async function verifyRegularOrMissing(file){
 try{const info=await lstat(file);return !info.isSymbolicLink()&&info.isFile();}
 catch(e){return e.code==='ENOENT';}
}

async function loadSummaryParents(dbFiles){
 const parents=new Map(),roots=new Set(dbFiles.map(f=>dirname(dirname(f))));
 for(const root of roots){
  const file=join(root,'conversation_summaries.db');let db=null;
  try{
   const info=await lstat(file);
   if(info.isSymbolicLink()||!info.isFile()||info.size>MAX_DB_BYTES)continue;
   if(!await verifyRegularOrMissing(file+'-wal')||!await verifyRegularOrMissing(file+'-shm'))continue;
   db=new DatabaseSync(file,{readOnly:true});
   db.exec('PRAGMA query_only=ON;PRAGMA cache_size=-1024;PRAGMA mmap_size=0;');
   const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('conversation_parents','conversation_summaries')").all().map(r=>r.name));
   const add=(parentRaw,childRaw)=>{
    const parent=typeof parentRaw==='string'&&GUID.test(parentRaw)?parentRaw.toLowerCase():null;
    const child=typeof childRaw==='string'&&GUID.test(childRaw)?childRaw.toLowerCase():null;
    if(!parent||!child||parent===child)return;
    let set=parents.get(parent);if(!set){set=new Set();parents.set(parent,set);}set.add(child);
   };
   if(tables.has('conversation_parents'))for(const r of db.prepare('SELECT conversation_id, parent_id FROM conversation_parents').iterate()){check();add(r.parent_id,r.conversation_id);}
   if(tables.has('conversation_summaries'))for(const r of db.prepare("SELECT conversation_id, parent_conversation_id FROM conversation_summaries WHERE parent_conversation_id != ''").iterate()){check();add(r.parent_conversation_id,r.conversation_id);}
  }catch{
   // Missing or unreadable summaries index must not block direct step/usage extraction.
  }finally{try{db?.close();}catch{}}
 }
 return parents;
}

async function writeJobDb(stagingDir,rows){
 await mkdir(stagingDir,{recursive:true,mode:0o700});
 const jobDb=join(stagingDir,`sqlite-${randomUUID()}.tmp`);
 const db=new DatabaseSync(jobDb);
 try{
  db.exec('PRAGMA journal_mode=DELETE;PRAGMA synchronous=NORMAL;PRAGMA temp_store=MEMORY;CREATE TABLE usage(j TEXT NOT NULL);');
  const insert=db.prepare('INSERT INTO usage VALUES(?)');
  db.exec('BEGIN');
  for(const row of rows){check();insert.run(JSON.stringify(row));}
  db.exec('COMMIT');
  return jobDb;
 }catch(error){
  try{db.close();}catch{}
  await unlink(jobDb).catch(()=>{});
  throw error;
 }finally{try{db.close();}catch{}}
}

const asBuffer=u=>Buffer.isBuffer(u)?u:Buffer.from(u.buffer,u.byteOffset,u.byteLength);

async function readConversationDb(item,summaryParents){
 const id=String(item.id||'').toLowerCase(),dbFile=item.dbFile;
 if(!GUID.test(id)||typeof dbFile!=='string'||!dbFile)return {id,status:'fallback'};
 let info;
 try{info=await lstat(dbFile);}catch{return {id,status:'fallback'};}
 if(info.isSymbolicLink()||!info.isFile())return {id,status:'fallback'};
 if(info.size>MAX_DB_BYTES)return {id,status:'error',reason:'budget'};
 if(!await verifyRegularOrMissing(dbFile+'-wal')||!await verifyRegularOrMissing(dbFile+'-shm'))return {id,status:'fallback'};
 let db=null;
 try{
  db=new DatabaseSync(dbFile,{readOnly:true});
  db.exec('PRAGMA query_only=ON;PRAGMA cache_size=-2048;PRAGMA mmap_size=0;PRAGMA temp_store=MEMORY;');
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('steps','gen_metadata')").all().map(r=>r.name));
  if(!tables.has('steps')||!tables.has('gen_metadata'))return {id,status:'fallback'};
  const steps=[],delegatedSet=new Set(summaryParents.get(id)||[]);let stepCount=0;
  for(const row of db.prepare('SELECT idx, step_type, has_subtrajectory, metadata, CASE WHEN step_type = 127 OR has_subtrajectory != 0 THEN step_payload ELSE NULL END AS payload FROM steps ORDER BY idx').iterate()){
   check();stepCount++;
   if(row.step_type===15&&row.metadata){
    if(!Number.isSafeInteger(row.idx)||row.idx<0||row.idx>=MAX_STEPS)return {id,status:'fallback'};
    const createdAt=parseStepCreatedAt(asBuffer(row.metadata));
    steps[row.idx]={type:'CORTEX_STEP_TYPE_PLANNER_RESPONSE',metadata:createdAt?{createdAt}:{}};
   }
   if((row.step_type===127||row.has_subtrajectory!==0)&&row.payload){
    parseInvokeSubagentPayload(asBuffer(row.payload),id,delegatedSet);
   }
  }
  if(Number.isSafeInteger(item.expectedSteps)&&stepCount<item.expectedSteps)return {id,status:'fallback'};
  const generatorMetadata=[];let genCount=0;
  for(const row of db.prepare('SELECT data FROM gen_metadata ORDER BY idx').iterate()){
   check();genCount++;
   if(!row.data)continue;
   const parsed=parseGenMetadataRow(asBuffer(row.data));
   if(parsed===null)return {id,status:'fallback'};
   generatorMetadata.push(parsed);
  }
  const delegatedIds=[...delegatedSet];
  const raw={trajectory:{steps,generatorMetadata}};
  const rows=usageRecords(raw,id,{maxRows:workerData.maxRows,maxBytes:workerData.maxBytes});
  if(rows.overflow&&workerData.stagingDir){
   const fullRows=usageRecords(raw,id,{maxRows:MAX_DISK_ROWS,maxBytes:MAX_DISK_BYTES});
   if(fullRows.overflow)return {id,status:'fallback'};
   const jobDb=await writeJobDb(workerData.stagingDir,fullRows);
   return {id,status:'disk',jobDb,delegatedIds};
  }
  return {id,status:'ok',rows,delegatedIds,empty:stepCount===0&&genCount===0};
 }catch(error){
  if(error.message==='Usage operation cancelled')throw error;
  return {id,status:'fallback'};
 }finally{try{db?.close();}catch{}}
}

async function main(){
 const items=Array.isArray(workerData.items)?workerData.items:[];
 const summaryParents=await loadSummaryParents(items.map(i=>i.dbFile).filter(Boolean));
 for(const item of items){
  check();
  const result=await readConversationDb(item,summaryParents);
  parentPort.postMessage({type:'item',result});
 }
 parentPort.postMessage({type:'done'});
}

main().catch(error=>{
 parentPort.postMessage({type:'error',error:error?.message||'Usage sqlite worker failed'});
 process.exitCode=1;
});
