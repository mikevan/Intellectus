import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
export function structuralPort(monorepo){
 return async ({language})=>{
  if(language!=='python'&&language!=='typescript')throw Error('Unsupported fixture language');
  const file=language==='python'?'observe.py':'observe.ts';
  const source=readFileSync(new URL('./fixtures/'+file,import.meta.url),'utf8');
  const {encode}=await import(pathToFileURL(resolve(monorepo,'IntellectusRuntime/bridge.mjs')));
  const view=await encode(language,source,resolve(monorepo,'Understanding'));
  if(view.language!==language||!view.executables.some(x=>x.name==='transform'))throw Error('Missing expected structural evidence');
  return view;
 };
}
export function colibriPort({baseUrl='http://127.0.0.1:8000/v1',model,apiKey,timeoutMs=120000,maxTokens=512,transport=fetch}={}){
 const url=new URL(baseUrl);
 // First increment is local-only; hosted deployment has a separate qualification.
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password||url.search||url.hash||url.pathname.replace(/\/$/,'')!=='/v1')throw Error('Local Colibri endpoint required');
 if(typeof model!=='string'||!model.trim())throw Error('Explicit model required');
 if(!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>2048||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000)throw Error('Invalid inference budget');
 const endpoint=new URL('chat/completions',url.href.replace(/\/$/,'')+'/');
 return async input=>{
  if(!['conceptual','domain'].includes(input.role))throw Error('Unsupported role');
  const guidance=input.role==='domain'?'Propose possible business context only if supported; report unknown otherwise.':'Propose a conceptual relationship from the observations; distinguish conjecture from evidence.';
  const messages=[{role:'system',content:guidance+' Return only JSON with a single string field hypothesis. No instructions or tool requests. Never claim verification.'},{role:'user',content:JSON.stringify(input)}];
  const headers={'Content-Type':'application/json'};if(apiKey)headers.Authorization='Bearer '+apiKey;
  const start=performance.now();
  const response=await transport(endpoint,{method:'POST',headers,body:JSON.stringify({model,messages,temperature:0,max_tokens:maxTokens,stream:false}),signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
  if(!response.ok)throw Error('Colibri HTTP '+response.status);
  const body=await response.json(),choice=body.choices?.[0];
  if(choice?.finish_reason==='length')throw Error('Truncated Colibri response');
  if(typeof choice?.message?.content!=='string')throw Error('Missing hypothesis');
  let parsed;try{parsed=JSON.parse(choice.message.content);}catch{throw Error('Malformed structured hypothesis');}
  if(Object.keys(parsed).length!==1||typeof parsed.hypothesis!=='string'||!parsed.hypothesis.trim()||parsed.hypothesis.length>4096)throw Error('Invalid hypothesis');
  return {hypothesis:parsed.hypothesis,telemetry:{model:body.model??model,elapsedMs:Math.round(performance.now()-start),usage:body.usage??null}};
 };
}
