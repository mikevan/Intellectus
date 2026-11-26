import {contract,tuples,behavioralIdentity,evidence,verifyFinite} from './knowledge.mjs';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const key = v => JSON.stringify(v);
const integer = v => {if(typeof v!=='string'||!/^(0|-?[1-9][0-9]*)$/.test(v))throw Error('Invalid integer');return BigInt(v);};
const runners = Object.freeze({
 python:{command:'python',file:fileURLToPath(new URL('./fixtures/observe.py',import.meta.url))},
 typescript:{command:process.execPath,file:fileURLToPath(new URL('./fixtures/observe.ts',import.meta.url))}
});
// Fixed, authored research fixtures only. No arbitrary program path, shell, or generated execution.
export function observeFixture(language,c,inputs=tuples(c)){
 const runner=runners[language];if(!runner)throw Error('Unsupported fixture language');
 const allowed=new Set(tuples(c).map(key)),seen=new Set();
 for(const input of inputs){const k=key(input);if(!allowed.has(k)||seen.has(k))throw Error('Invalid observation input');seen.add(k);}
 const args=language==='typescript'?['--experimental-strip-types',runner.file]:[runner.file];
 const result=spawnSync(runner.command,args,{input:JSON.stringify(inputs),encoding:'utf8',timeout:10000,maxBuffer:1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 if(result.error||result.status!==0||result.stderr)throw Error('Fixture observation failed: '+(result.error?.message??result.stderr));
 const values=JSON.parse(result.stdout);
 if(!Array.isArray(values)||values.length!==inputs.length)throw Error('Unexpected observation count');
 const rows=inputs.map((input,i)=>{integer(values[i]);return {input:[...input],outcome:{kind:'return',value:values[i],effects:false}};});
 const run=language+'-fixture-v1',source=evidence(readFileSync(runner.file),language,'authored fixture',run);
 return {rows,source,artifact:evidence(JSON.stringify(rows),language,'subprocess execution',run)};
}
// Learn an affine candidate from an origin and independent unit perturbations.
// A missing perturbation means unresolved, not a guessed coefficient.
export function discoverAffine(c,rows){
 const points=new Map();
 const allowed=new Set(tuples(c).map(key));
 for(const row of rows){
  const k=key(row.input);if(!allowed.has(k)||points.has(k)||row.outcome?.kind!=='return'||row.outcome.effects!==false)throw Error('Invalid experiment row');
  points.set(k,integer(row.outcome.value));
 }
 const origin=c.bounds.map(x=>x[0]),base=points.get(key(origin));
 if(base===undefined)return {status:'unresolved',reason:'Missing origin'};
 const coefficients=[];
 for(let i=0;i<origin.length;i++){
  if(c.bounds[i][0]===c.bounds[i][1])return {status:'unresolved',reason:'Constant dimension cannot identify coefficient'};
  const next=[...origin];next[i]=String(integer(next[i])+1n);
  const value=points.get(key(next));
  if(value===undefined)return {status:'unresolved',reason:'Missing unit intervention'};
  coefficients.push(String(value-base));
 }
 const intercept=String(base-coefficients.reduce((sum,v,i)=>sum+integer(v)*integer(origin[i]),0n));
 const candidate={type:'affine-integer-v1',intercept,coefficients};
 const mismatch=rows.find(r=>predict(candidate,r.input)!==r.outcome.value);
 return mismatch?{status:'contradicted',candidate,counterexample:{input:mismatch.input,predicted:predict(candidate,mismatch.input),observed:mismatch.outcome.value}}:{status:'proposed',candidate};
}
export function predict(candidate,input){
 if(candidate.type!=='affine-integer-v1'||candidate.coefficients.length!==input.length)throw Error('Unsupported candidate');
 return String(integer(candidate.intercept)+candidate.coefficients.reduce((sum,v,i)=>sum+integer(v)*integer(input[i]),0n));
}
export function verifyAffine(c,candidate,observed){
 const predicted=tuples(c).map(input=>({input,outcome:{kind:'return',value:predict(candidate,input),effects:false}}));
 return verifyFinite(c,predicted,observed);
}
