import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {UsageLedger,DesktopUsage} from '../usage.mjs';
import {TrajectoryReader} from '../trajectory-reader.mjs';
import {discoverLocalConversations} from '../local-conversations.mjs';

const account='a'.repeat(64);
const id='11111111-1111-1111-1111-111111111111';
const childId='22222222-2222-2222-2222-222222222222';
const thirdId='33333333-3333-3333-3333-333333333333';
const key=value=>createHash('sha256').update(value).digest('hex');

function varint(n){
 let v=BigInt(n);const out=[];
 while(v>=0x80n){out.push(Number((v&0x7fn)|0x80n));v>>=7n;}
 out.push(Number(v));return Buffer.from(out);
}
const ld=(fn,buf)=>Buffer.concat([varint((fn<<3)|2),varint(buf.length),buf]);
const vi=(fn,n)=>Buffer.concat([varint((fn<<3)|0),varint(n)]);
const str=(fn,s)=>ld(fn,Buffer.from(s,'utf8'));
function ts(iso){
 const ms=Date.parse(iso),sec=Math.floor(ms/1000),nanos=(ms%1000)*1e6;
 return Buffer.concat([vi(1,sec),...(nanos?[vi(2,nanos)]:[])]);
}
function encodeGenRow({stepIndices=[0],model='Gemini 3.8',startIso=null,input=100,cacheRead=900,cacheWrite=20,output=80,provider=24,responseId='resp-1',blobBytes=0}={}){
 const usage=Buffer.concat([
  ...(input!==null?[vi(2,input)]:[]),
  ...(output!==null?[vi(3,output)]:[]),
  ...(cacheWrite!==null?[vi(4,cacheWrite)]:[]),
  ...(cacheRead!==null?[vi(5,cacheRead)]:[]),
  ...(provider!==null?[vi(6,provider)]:[]),
  ...(responseId?[str(11,responseId)]:[]),
 ]);
 const cmParts=[
  ld(4,usage),
  ...(startIso?[ld(9,ld(4,ts(startIso)))]:[]),
  ...(model?[str(21,model)]:[]),
 ];
 if(blobBytes>0)cmParts.push(ld(8,Buffer.alloc(blobBytes,0x61)));
 const packedSteps=Buffer.concat(stepIndices.map(s=>varint(s)));
 return Buffer.concat([ld(1,Buffer.concat(cmParts)),ld(2,packedSteps)]);
}
function createConversationDb(filePath,{steps=[],gens=[]}={}){
 const db=new DatabaseSync(filePath);
 try{
  db.exec('CREATE TABLE steps(idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, has_subtrajectory NUMERIC NOT NULL DEFAULT false, metadata BLOB, step_payload BLOB);');
  db.exec('CREATE TABLE gen_metadata(idx INTEGER PRIMARY KEY, data BLOB);');
  const insStep=db.prepare('INSERT INTO steps(idx, step_type, has_subtrajectory, metadata, step_payload) VALUES(?,?,?,?,?)');
  for(const s of steps)insStep.run(s.idx,s.type,s.hasSub?1:0,s.metadata||null,s.payload||null);
  const insGen=db.prepare('INSERT INTO gen_metadata(idx, data) VALUES(?,?)');
  gens.forEach((g,idx)=>insGen.run(idx,g));
 }finally{db.close();}
}
async function setup(t){
 const home=await mkdtemp(join(tmpdir(),'ag-sqlite-backfill-'));
 t.after(()=>rm(home,{recursive:true,force:true}));
 const convDir=join(home,'.gemini','antigravity','conversations');
 const brainDir=join(home,'.gemini','antigravity','brain');
 await mkdir(convDir,{recursive:true});await mkdir(brainDir,{recursive:true});
 const ledger=new UsageLedger(join(home,'ledger'));
 return {home,convDir,brainDir,ledger};
}

test('SQLite worker backfills multi-MB gen_metadata and PLANNER_RESPONSE fallback without RPC calls',async t=>{
 const {home,convDir,ledger}=await setup(t);
 const plannerMeta=ld(1,ts('2026-10-10T16:05:00Z'));
 createConversationDb(join(convDir,id+'.db'),{
  steps:[{idx:0,type:15,metadata:plannerMeta}],
  gens:[
   encodeGenRow({stepIndices:[0],startIso:null,input:100,cacheRead:900,cacheWrite:20,output:80,responseId:'r-planner',blobBytes:4*1024*1024}),
   encodeGenRow({stepIndices:[0],startIso:'2026-10-11T01:00:00Z',input:50,cacheRead:450,cacheWrite:0,output:50,responseId:'r-start'}),
  ],
 });
 let rpcCalls=0;
 const store={identity:account,epoch:1,listConversations:async()=>[],client:{trajectory:async()=>{rpcCalls++;throw Error('RPC should not be called');}}};
 const usage=new DesktopUsage(store,ledger,{host:'app',discoverLocal:()=>discoverLocalConversations({home,host:'app'})});
 t.after(()=>usage.dispose());
 await usage.sync(true);
 assert.equal(rpcCalls,0);
 assert.equal(usage.status,'ready');
 const summary=await ledger.summary(account,Date.parse('2026-10-11T08:00:00Z'));
 assert.equal(summary.requests,2);
 assert.equal(summary.totalTokens,1100+550);
 assert.equal(summary.todayTokens,1100+550);
 const journal=await ledger.backfillState(account,'app');
 assert.equal(journal[key(id)].state,'complete');
});

test('SQLite worker discovers CortexStepInvokeSubagent child IDs and imports child archive',async t=>{
 const {home,convDir,ledger}=await setup(t);
 const invokePayload=ld(143,ld(10,str(5,childId)));
 createConversationDb(join(convDir,id+'.db'),{
  steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T02:00:00Z'))},{idx:1,type:127,payload:invokePayload}],
  gens:[encodeGenRow({stepIndices:[0],startIso:'2026-10-11T02:00:00Z',responseId:'parent-r1'})],
 });
 createConversationDb(join(convDir,childId+'.db'),{
  steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T02:01:00Z'))}],
  gens:[encodeGenRow({stepIndices:[0],startIso:'2026-10-11T02:01:00Z',input:20,cacheRead:0,cacheWrite:0,output:30,responseId:'child-r1'})],
 });
 let rpcCalls=0;
 const store={identity:account,epoch:1,listConversations:async()=>[],client:{trajectory:async()=>{rpcCalls++;throw Error('Unexpected RPC');}}};
 const usage=new DesktopUsage(store,ledger,{host:'app',discoverLocal:()=>discoverLocalConversations({home,host:'app'})});
 t.after(()=>usage.dispose());
 await usage.sync(true);
 assert.equal(rpcCalls,0);
 assert.equal(usage.status,'ready');
 assert.equal((await ledger.summary(account)).totalTokens,1100+50);
 assert.equal((await ledger.backfillState(account,'app'))[key(id)].hasDelegates,true);
});

test('empty SQLite DB and unlisted brain-only directories checkpoint complete and reimport once DB appears',async t=>{
 const {home,convDir,brainDir,ledger}=await setup(t);
 createConversationDb(join(convDir,id+'.db'));
 await mkdir(join(brainDir,childId),{recursive:true});
 await mkdir(join(brainDir,thirdId),{recursive:true});
 await writeFile(join(convDir,thirdId+'.pb'),'legacy-pb');
 const localBefore=await discoverLocalConversations({home,host:'app'});
 const byId=Object.fromEntries(localBefore.conversations.map(c=>[c.id,c]));
 assert.equal(byId[id].hasArchive,true);
 assert.equal(byId[childId].hasArchive,false);
 assert.equal(byId[thirdId].hasArchive,true);

 const rpcIds=[];
 const store={identity:account,epoch:1,listConversations:async()=>[],client:{trajectory:async cid=>{
  rpcIds.push(cid);
  return {trajectory:{steps:[{type:'PLANNER_RESPONSE',metadata:{createdAt:'2026-10-11T03:00:00Z'}}],generatorMetadata:[{stepIndices:[0],chatModel:{modelDisplayName:'Fixture',usage:{responseId:'pb-1',inputTokens:10,outputTokens:10,cacheReadTokens:0,cacheWriteTokens:0}}}]}};
 }}};
 const usage=new DesktopUsage(store,ledger,{host:'app',discoverLocal:()=>discoverLocalConversations({home,host:'app'})});
 t.after(()=>usage.dispose());
 await usage.sync(true);
 assert.deepEqual(rpcIds,[thirdId]);
 assert.equal(usage.status,'ready');
 assert.equal(usage.retryingConversations,0);
 const journal=await ledger.backfillState(account,'app');
 assert.equal(journal[key(id)].state,'complete');
 assert.equal(journal[key(childId)].state,'complete');
 assert.equal(journal[key(thirdId)].state,'complete');

 // Adding a .db later for the previously brain-only conversation changes its signature and imports its usage.
 createConversationDb(join(convDir,childId+'.db'),{
  steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T04:00:00Z'))}],
  gens:[encodeGenRow({stepIndices:[0],startIso:'2026-10-11T04:00:00Z',input:40,cacheRead:0,cacheWrite:0,output:60,responseId:'late-db'})],
 });
 await usage.sync(false);
 assert.deepEqual(rpcIds,[thirdId]);
 assert.equal((await ledger.summary(account)).totalTokens,20+100);
});

test('unknown apiProvider, non-SQLite DB, and RUNNING conversation fall back cleanly to RPC',async t=>{
 const {home,convDir,ledger}=await setup(t);
 const unknownId='44444444-4444-4444-4444-444444444444';
 const runningId='55555555-5555-5555-5555-555555555555';
 await writeFile(join(convDir,id+'.db'),'not-sqlite');
 createConversationDb(join(convDir,unknownId+'.db'),{
  steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T05:00:00Z'))}],
  gens:[encodeGenRow({stepIndices:[0],startIso:'2026-10-11T05:00:00Z',provider:99,responseId:'unknown-prov'})],
 });
 createConversationDb(join(convDir,runningId+'.db'),{
  steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T05:01:00Z'))}],
  gens:[encodeGenRow({stepIndices:[0],startIso:'2026-10-11T05:01:00Z',responseId:'running-r'})],
 });
 const rpcIds=[];
 const store={
  identity:account,epoch:1,
  listConversations:async()=>[{id:runningId,status:'CASCADE_RUN_STATUS_RUNNING',modifiedAt:'2026-10-11T05:01:00Z',stepCount:1}],
  client:{trajectory:async cid=>{
   rpcIds.push(cid);
   return {trajectory:{steps:[{type:'PLANNER_RESPONSE',metadata:{createdAt:'2026-10-11T05:00:00Z'}}],generatorMetadata:[{stepIndices:[0],chatModel:{modelDisplayName:'Fixture',usage:{responseId:'rpc-'+cid,inputTokens:5,outputTokens:5,cacheReadTokens:0,cacheWriteTokens:0}}}]}};
  }},
 };
 const usage=new DesktopUsage(store,ledger,{host:'app',discoverLocal:()=>discoverLocalConversations({home,host:'app'})});
 t.after(()=>usage.dispose());
 await usage.sync(true);
 assert.equal(usage.status,'ready');
 assert.equal(new Set(rpcIds).size,3);
 assert.equal((await ledger.summary(account)).requests,3);
});

test('TrajectoryReader cold read with cache:false does not retain entry in memory',async()=>{
 const client={
  now:Date.now,
  discover:async()=>({pid:1,port:2,csrf:'fixture'}),
  call:async method=>method.includes('Steps')?{steps:[{type:'PLANNER_RESPONSE',metadata:{createdAt:'2026-10-11T06:00:00Z'}}]}:{generatorMetadata:[]},
 };
 const reader=new TrajectoryReader(client);
 const value=await reader.read(id,{summary:{stepCount:1,status:'CASCADE_RUN_STATUS_IDLE',lastModifiedTime:'2026-10-11T06:00:00Z'},cache:false});
 assert.equal(value.numTotalSteps,1);
 assert.equal(reader.entries.size,0);
 assert.equal(reader.cachedBytes,0);
});

async function settledSummary(ledger,scope=account){
 for(let i=0;i<50;i++){
  const res=await ledger.summary(scope);
  if(!ledger.diskSummaryPending)return res;
  await ledger.diskSummaryPending;
 }
 throw Error('Disk summary did not settle');
}

test('SQLite worker spills oversized rows to disk ledger and follows conversation_summaries parent links',async t=>{
 const {home,convDir,ledger}=await setup(t);
 const gens=Array.from({length:6},(_,i)=>encodeGenRow({stepIndices:[0],startIso:'2026-10-11T07:00:00Z',input:10,cacheRead:0,cacheWrite:0,output:10,responseId:'spill-'+i}));
 createConversationDb(join(convDir,id+'.db'),{steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T07:00:00Z'))}],gens});
 const sumDb=new DatabaseSync(join(home,'.gemini','antigravity','conversation_summaries.db'));
 try{
  sumDb.exec('CREATE TABLE conversation_summaries(conversation_id TEXT PRIMARY KEY, parent_conversation_id TEXT NOT NULL);');
  sumDb.prepare('INSERT INTO conversation_summaries VALUES(?,?)').run(childId,id);
 }finally{sumDb.close();}
 createConversationDb(join(convDir,childId+'.db'),{
  steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T07:01:00Z'))}],
  gens:[encodeGenRow({stepIndices:[0],startIso:'2026-10-11T07:01:00Z',input:5,cacheRead:0,cacheWrite:0,output:5,responseId:'sum-child'})],
 });
 let rpcCalls=0;
 const store={identity:account,epoch:1,listConversations:async()=>[],client:{trajectory:async()=>{rpcCalls++;throw Error('Unexpected RPC');}}};
 const usage=new DesktopUsage(store,ledger,{host:'app',liveMaxRows:2,discoverLocal:()=>discoverLocalConversations({home,host:'app'})});
 t.after(()=>usage.dispose());
 await usage.sync(true);
 assert.equal(rpcCalls,0);
 assert.equal(usage.status,'ready');
 assert.equal((await settledSummary(ledger)).totalTokens,120+10);
});

test('symlinked SQLite database or WAL falls back without reading linked target directly',async t=>{
 const {home,convDir,ledger}=await setup(t);
 const target=join(home,'outside.db');
 createConversationDb(target,{
  steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T08:00:00Z'))}],
  gens:[encodeGenRow({stepIndices:[0],startIso:'2026-10-11T08:00:00Z',responseId:'sym-target'})],
 });
 createConversationDb(join(convDir,id+'.db'),{
  steps:[{idx:0,type:15,metadata:ld(1,ts('2026-10-11T08:00:00Z'))}],
  gens:[encodeGenRow({stepIndices:[0],startIso:'2026-10-11T08:00:00Z',responseId:'sym-main'})],
 });
 try{await symlink(target,join(convDir,id+'.db-wal'));}
 catch(e){if(['EPERM','EACCES'].includes(e.code))return;throw e;}
 let rpcCalls=0;
 const store={identity:account,epoch:1,listConversations:async()=>[],client:{trajectory:async()=>{
  rpcCalls++;
  return {trajectory:{steps:[{type:'PLANNER_RESPONSE',metadata:{createdAt:'2026-10-11T08:00:00Z'}}],generatorMetadata:[{stepIndices:[0],chatModel:{modelDisplayName:'Fixture',usage:{responseId:'rpc-sym',inputTokens:1,outputTokens:1,cacheReadTokens:0,cacheWriteTokens:0}}}]}};
 }}};
 const usage=new DesktopUsage(store,ledger,{host:'app',discoverLocal:()=>discoverLocalConversations({home,host:'app'})});
 t.after(()=>usage.dispose());
 await usage.sync(true);
 assert.equal(rpcCalls,1);
 assert.equal((await ledger.summary(account)).totalTokens,2);
});
