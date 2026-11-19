// App-independent preferences: no renderer origin, account or conversation data.
import { readFile, mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { platformPaths } from './platform.mjs';

export function validateUsageScope(value) {
  if(!['local','account'].includes(value))throw new Error('Invalid usage scope preference');
  return value;
}
function storedUsageScope(value) {
  return ['local','account'].includes(value)?value:undefined;
}
export function validateLanguage(value) {
  if (value!=='en'&&value!=='zh-CN'&&value!=='zh-TW') throw new Error('Invalid language preference');
  return value;
}

export function validateSpeedStyle(value) {
  if (value!=='minimal'&&value!=='cat') throw new Error('Invalid speed style preference');
  return value;
}
const storedSpeedStyle=value=>value==='minimal'||value==='cat'?value:null;
export function validateNeonMascot(value) {
  if(!['off','on'].includes(value))throw new Error('Invalid neon mascot preference');
  return value;
}
const storedNeonMascot=value=>['off','on'].includes(value)?value:undefined;
export function validateContextLimitOverride(raw) {
  if(Number.isSafeInteger(raw))raw=String(raw);
  if(typeof raw!=='string')throw new Error('Invalid context limit preference');
  const trimmed=raw.trim().toLowerCase();
  if(trimmed==='auto'||trimmed==='256k'||trimmed==='512k'||trimmed==='734k')return trimmed;
  const match=/^(\d+)([km])?$/.exec(trimmed);
  if(!match)throw new Error('Invalid context limit preference');
  const mult=match[2]==='m'?1000000:match[2]==='k'?1000:1;
  const tokens=Number(match[1])*mult;
  if(!Number.isSafeInteger(tokens)||tokens<65536||tokens>2097152)throw new Error('Invalid context limit preference');
  if(tokens===256000)return '256k';
  if(tokens===512000)return '512k';
  if(tokens===734000)return '734k';
  return String(tokens);
}
function storedContextLimitOverride(value) {
  try{return value===undefined||value===null?undefined:validateContextLimitOverride(value);}catch{return undefined;}
}

export class PreferencesStore {
  constructor({file=join(dirname(platformPaths().settings),'preferences.json')}={}) {
    this.file=file;this.queue=Promise.resolve();
  }
  async get() {
    await this.queue;
    try {
      const value=JSON.parse((await readFile(this.file,'utf8')).replace(/^\uFEFF/,''));
      if(value.schema!==1)throw new Error('Invalid preferences schema');
      const usageScope=storedUsageScope(value.usageScope);
      const neonMascot=storedNeonMascot(value.neonMascot);
      const contextLimitOverride=storedContextLimitOverride(value.contextLimitOverride);
      return {language:value.language===null?null:validateLanguage(value.language),languageGuideDismissed:value.languageGuideDismissed===true,usageGuideDismissed:value.usageGuideDismissed===true,speedStyle:storedSpeedStyle(value.speedStyle),...(usageScope?{usageScope}:{}),...(neonMascot?{neonMascot}:{}),...(contextLimitOverride?{contextLimitOverride}:{}),revision:Number.isSafeInteger(value.revision)&&value.revision>=0?value.revision:0};
    } catch(error) {
      if(error.code==='ENOENT')return {language:null,languageGuideDismissed:false,usageGuideDismissed:false,speedStyle:null,revision:0};
      throw new Error('Language preference could not be read');
    }
  }
  async set(input) {
    if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length||Object.keys(input).some(key=>!['language','languageGuideDismissed','usageGuideDismissed','speedStyle','usageScope','neonMascot','contextLimitOverride'].includes(key)))throw new Error('Invalid preferences request');
    if(Object.hasOwn(input,'language'))validateLanguage(input.language);
    if(Object.hasOwn(input,'speedStyle'))validateSpeedStyle(input.speedStyle);
    if(Object.hasOwn(input,'usageScope'))validateUsageScope(input.usageScope);
    if(Object.hasOwn(input,'neonMascot'))validateNeonMascot(input.neonMascot);
    if(Object.hasOwn(input,'contextLimitOverride'))validateContextLimitOverride(input.contextLimitOverride);
    if(Object.hasOwn(input,'languageGuideDismissed')&&input.languageGuideDismissed!==true)throw new Error('Invalid guide preference');
    if(Object.hasOwn(input,'usageGuideDismissed')&&input.usageGuideDismissed!==true)throw new Error('Invalid usage guide preference');
    const operation=this.queue.then(async()=>{
      await mkdir(dirname(this.file),{recursive:true});
      let prior=0,previous={language:null,languageGuideDismissed:false,usageGuideDismissed:false,speedStyle:null,usageScope:undefined,neonMascot:undefined,contextLimitOverride:undefined};
      try {const value=JSON.parse((await readFile(this.file,'utf8')).replace(/^\uFEFF/,''));if(Number.isSafeInteger(value.revision))prior=value.revision;previous={language:['en','zh-CN','zh-TW'].includes(value.language)?value.language:null,languageGuideDismissed:value.languageGuideDismissed===true,usageGuideDismissed:value.usageGuideDismissed===true,speedStyle:storedSpeedStyle(value.speedStyle),usageScope:storedUsageScope(value.usageScope),neonMascot:storedNeonMascot(value.neonMascot),contextLimitOverride:storedContextLimitOverride(value.contextLimitOverride)};}catch{}
      const language=Object.hasOwn(input,'language')?input.language:previous.language;
      const languageGuideDismissed=previous.languageGuideDismissed||Object.hasOwn(input,'language')||input.languageGuideDismissed===true;
      const usageGuideDismissed=previous.usageGuideDismissed||input.usageGuideDismissed===true;
      const speedStyle=Object.hasOwn(input,'speedStyle')?input.speedStyle:previous.speedStyle;
      const usageScope=Object.hasOwn(input,'usageScope')?input.usageScope:previous.usageScope;
      const neonMascot=Object.hasOwn(input,'neonMascot')?input.neonMascot:previous.neonMascot;
      const contextLimitOverride=Object.hasOwn(input,'contextLimitOverride')?validateContextLimitOverride(input.contextLimitOverride):previous.contextLimitOverride;
      const revision=Math.max(Date.now(),prior+1);
      const temporary=this.file+'.'+process.pid+'.'+randomUUID()+'.tmp';
      try {
        const handle=await open(temporary,'wx',0o600);
        try {await handle.writeFile(JSON.stringify({schema:1,language,languageGuideDismissed,usageGuideDismissed,speedStyle,...(usageScope?{usageScope}:{}),...(neonMascot?{neonMascot}:{}),...(contextLimitOverride?{contextLimitOverride}:{}),revision})+'\n','utf8');await handle.sync();}
        finally {await handle.close();}
        await rename(temporary,this.file);
      } finally {await rm(temporary,{force:true});}
      return {language,languageGuideDismissed,usageGuideDismissed,speedStyle,...(usageScope?{usageScope}:{}),...(neonMascot?{neonMascot}:{}),...(contextLimitOverride?{contextLimitOverride}:{}),revision};
    });
    this.queue=operation.catch(()=>{});
    return operation;
  }
  async snapshot() {
    try {return await this.get();}catch{return {error:'Language preference could not be read'};}
  }
}
