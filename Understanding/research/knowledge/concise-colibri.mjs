import {performance} from 'node:perf_hooks';
const integer=s=>typeof s==='string'&&/^(0|-?[1-9][0-9]*)$/.test(s);
export function conciseColibriPort({model,apiKey,transport=fetch,timeoutMs=240000,maxTokens=512}){
 if(typeof model!=='string'||!model.trim())throw Error('Explicit model required');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000||!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>1024)throw Error('Invalid budget');
 return async input=>{
  if(!['conceptual','domain'].includes(input.role))throw Error('Unsupported role');
  const n=input.contract.bounds.length;
  const instructions=input.role==='conceptual'
   ?'From the observations propose an affine candidate if possible. Do calculations privately. Output the candidate first, then a hypothesis of at most 12 words. If unsupported use null.'
   :'Only infer business context from supplied evidence. If context is absent reply exactly {"candidate":null,"hypothesis":"Business context unknown."} Do not solve the equation.';
  const system=instructions+' Output one compact JSON object, no markdown or explanation. Shape: {"candidate":{"type":"affine-integer-v1","intercept":"INTEGER","coefficients":["INTEGER", "..."]},"hypothesis":"BRIEF"} or {"candidate":null,"hypothesis":"BRIEF"}. Coefficients must be '+n+' decimal integer strings in input order. Never claim verification.';
  const payload={role:input.role,bounds:input.contract.bounds,observations:input.observations.map(r=>[r.input,r.outcome.value])};
  if(input.previous)payload.previous=input.previous.candidate??null;
  if(input.counterexample)payload.counterexample=input.counterexample;
  const headers={'Content-Type':'application/json'};if(apiKey)headers.Authorization='Bearer '+apiKey;
  const start=performance.now();
  const response=await transport('http://127.0.0.1:8000/v1/chat/completions',{method:'POST',headers,body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(payload)}],temperature:0,stream:false,max_tokens:maxTokens}),signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
  if(!response.ok)throw Error('Colibri HTTP '+response.status);
  const body=await response.json(),choice=body.choices?.[0],raw=choice?.message?.content;
  const telemetry={model:body.model??model,elapsedMs:Math.round(performance.now()-start),usage:body.usage??null};
  // Retain malformed or untyped output for research; never fabricate a candidate.
  const fail=reason=>({hypothesis:JSON.stringify({hypothesis:typeof raw==='string'?raw.slice(0,3000):'Missing response'}),telemetry:{...telemetry,typed:false,reason}});
  if(choice?.finish_reason==='length'||typeof raw!=='string')return fail('Incomplete response');
  let obj;try{obj=JSON.parse(raw);}catch{return fail('Not a JSON object');}
  if(!obj||typeof obj!=='object'||Object.keys(obj).sort().join(',')!=='candidate,hypothesis'||typeof obj.hypothesis!=='string'||!obj.hypothesis.trim()||obj.hypothesis.length>512)return fail('Invalid response envelope');
  const c=obj.candidate;
  if(c!==null&&(!c||Object.keys(c).sort().join(',')!=='coefficients,intercept,type'||c.type!=='affine-integer-v1'||!integer(c.intercept)||!Array.isArray(c.coefficients)||c.coefficients.length!==n||!c.coefficients.every(integer)))return fail('Invalid candidate');
  // Adapt directly typed response to the existing internal hypothesis port.
  return {hypothesis:JSON.stringify(obj),telemetry:{...telemetry,typed:c!==null,validEnvelope:true}};
 };
}
