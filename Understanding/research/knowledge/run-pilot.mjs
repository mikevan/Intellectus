import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {contract,tuples,behavioralIdentity,evidence} from './knowledge.mjs';
import {discoverAffine,verifyAffine} from './observation.mjs';
const c=contract([['0','4'],['0','1']]);
const all=tuples(c);
const discovery=all.filter(([a])=>a!=='4');
const definitions=[['branch','python'],['iteration','python'],['direct','typescript'],['lookup','typescript'],['shift','typescript'],['late','typescript']];
function observe(name,language,inputs){
 const file=fileURLToPath(new URL(language==='python'?'./pilot.py':'./pilot.ts',import.meta.url));
 const command=language==='python'?'python':process.execPath;
 const args=language==='python'?[file,name]:['--experimental-strip-types',file,name];
 const r=spawnSync(command,args,{input:JSON.stringify(inputs),encoding:'utf8',timeout:10000,maxBuffer:65536});
 if(r.error||r.status!==0||r.stderr)throw Error('Fixed pilot fixture failed: '+name);
 const values=JSON.parse(r.stdout);
 if(!Array.isArray(values)||values.length!==inputs.length||values.some(v=>typeof v!=='string'||!/^(0|-?[1-9][0-9]*)$/.test(v)))throw Error('Invalid observations');
 return {source:evidence(readFileSync(file),language,'fixed pilot fixture',name),rows:inputs.map((input,i)=>({input,outcome:{kind:'return',value:values[i],effects:false}}))};
}
const subjects=[];
for(const [name,language] of definitions){
 const initial=observe(name,language,discovery);
 const candidate=discoverAffine(c,initial.rows);
 const actual=observe(name,language,all);
 const oracle=all.map(input=>{const [a,b]=input.map(Number);return {input,outcome:{kind:'return',value:String(a+3+2*b+(name==='shift'?1:0)+(name==='late'&&a===4&&b===1?1:0)),effects:false}}});
 const id=behavioralIdentity(c,actual.rows);
 const oracleMatch=id.bytes===behavioralIdentity(c,oracle).bytes;
 const verification=candidate.status==='proposed'?verifyAffine(c,candidate.candidate,actual.rows):{status:candidate.status};
 subjects.push({name,language,initial,candidate,actual,oracleMatch,identity:id.id,canonical:id.bytes,verification});
}
const group=subjects.slice(0,4);
const pass=subjects.every(s=>s.oracleMatch)&&group.every(s=>s.canonical===group[0].canonical&&s.verification.status==='verified-in-scope')&&new Set(subjects.map(s=>s.identity)).size===3&&subjects[4].verification.status==='verified-in-scope'&&subjects[5].verification.status==='contradicted';
const result={status:pass?'pilot-pass':'pilot-fail',notRT5:true,contract:c,discoveryCases:48,verificationCases:60,subjects,limitations:['Fixed authored arithmetic only','Purity declared, not independently proven','No AI, structural specialist or business intent tested','Finite mapping is not generalized semantic understanding']};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,subjects:subjects.map(({name,identity,verification,oracleMatch})=>({name,identity,verification:verification.status,counterexample:verification.counterexample,oracleMatch}))},null,2));
if(!pass)process.exitCode=1;
