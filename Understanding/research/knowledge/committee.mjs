import {createHash} from 'node:crypto';
import {contract,tuples,evidence,behavioralIdentity,claim,ResearchJournal} from './knowledge.mjs';
import {observeFixture,discoverAffine,predict,verifyAffine} from './observation.mjs';
const hash = v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clone=v=>structuredClone(v);
const roles=['structural','behavioral','causal','mathematical','conceptual','domain','skeptic'];
export const specialistRoles=Object.freeze([...roles]);
function packet(role,method,body){const value={role,method,body:clone(body)};return {...value,digest:hash(value)};}
function validatePacket(p,role){
 if(p.role!==role||typeof p.method!=='string'||typeof p.body!=='object'||p.digest!==hash({role:p.role,method:p.method,body:p.body}))throw Error('Invalid specialist packet');
 return clone(p);
}
function interventions(c){
 const origin=c.bounds.map(x=>x[0]);
 return [origin,...origin.flatMap((_,i)=>{
  if(c.bounds[i][0]===c.bounds[i][1])return [];
  const next=[...origin];next[i]=String(BigInt(next[i])+1n);return [next];
 })];
}
// Fixed synthetic research fixture only; no arbitrary source execution or external tools supplied to models.
export async function investigateFixture(c,{structural,conceptual,domain,enabled=roles}={}){
 const active=new Set(enabled);
 if([...active].some(r=>!roles.includes(r)))throw Error('Unknown specialist');
 const packets=[];
 const add=(r,m,b)=>{const p=validatePacket(packet(r,m,b),r);packets.push(p);return p;};
 // Discovery receives only selected training observations. Separate full-domain verifier runs after sealing packets.
 const inputs=interventions(c);
 const training=active.has('behavioral')?observeFixture('python',c,inputs):null;
 if(active.has('structural')){
  if(structural){const view=await structural({language:'python'});add('structural','provided-static-adapter',{status:'observed',view});}
  else add('structural','not-configured',{status:'unresolved',reason:'Structural adapter unavailable'});
 }
 if(training)add('behavioral','fixed-subprocess-v1',{status:'observed',inputs:training.rows,artifact:training.artifact,source:training.source});
 if(active.has('causal'))add('causal','unit-interventions-v1',{status:training?'observed':'unresolved',requested:inputs,observed:training?.rows??[]});
 const relation=active.has('mathematical')&&training?discoverAffine(c,training.rows):null;
 if(active.has('mathematical'))add('mathematical','affine-v1',relation??{status:'unresolved',reason:'No training observations'});
 // AI ports supply hypotheses only. They receive independent copies of observations, not each other's claims or held-out truth.
 for(const [role,port] of [['conceptual',conceptual],['domain',domain]]){
  if(!active.has(role))continue;
  if(!port){add(role,'not-configured',{status:'unresolved',reason:'Inference port unavailable'});continue;}
  try{
   const response=await port(clone({role,contract:c,observations:training?.rows??[]}));
   if(!response||typeof response.hypothesis!=='string'||response.hypothesis.length>4096)throw Error('Invalid hypothesis');
   add(role,'inference-port',{status:'proposed',hypothesis:response.hypothesis});
  }catch(e){add(role,'inference-port',{status:'unresolved',reason:String(e.message??e)});}
 }
 const initial=clone(packets);
 const sealedDigest=hash(initial);
 // Independently execute the reference implementation only after the initial predictions are sealed.
 let verification=null,record=null,verificationEvidence=null;
 if(active.has('skeptic')&&relation?.status==='proposed'){
  const fullPython=observeFixture('python',c);
 const observed=observeFixture('typescript',c);
 const pythonCheck=verifyAffine(c,relation.candidate,fullPython.rows);
  verificationEvidence=observed;
  const tsCheck=verifyAffine(c,relation.candidate,observed.rows);
 verification=pythonCheck.status==='contradicted'?pythonCheck:tsCheck;
  add('skeptic','independent-complete-domain-v1',{...verification,artifact:observed.artifact,source:observed.source,pythonCheck,tsCheck,pythonArtifact:fullPython.artifact});
  // Persist only a separately checked finite mapping; compact candidate linked via evidence, not promoted by AI text.
  const predicted=tuples(c).map(input=>({input,outcome:{kind:'return',value:predict(relation.candidate,input),effects:false}}));
  const journal=new ResearchJournal();
  for(const a of [training.artifact,training.source,fullPython.artifact,observed.artifact,observed.source])if(!journal.artifacts.has(a.digest))journal.recordArtifact(a);
  const claimRecord=claim({subject:'fixed-research-fixture-pair',contractId:c.id,kind:'inferred',
   representation:{type:'finite-mapping',version:1},payload:{behavioralId:behavioralIdentity(c,predicted).id,candidate:relation.candidate},evidenceRefs:[training.artifact.digest]});
  journal.recordClaim(claimRecord);
  const failed=pythonCheck.status==='contradicted'?fullPython:observed;
  journal.assessFinite(claimRecord.id,c,predicted,failed.rows,[failed.artifact.digest]);
  record={claim:claimRecord,status:journal.state.get(claimRecord.id),events:journal.events};
 }else if(active.has('skeptic'))add('skeptic','independent-complete-domain-v1',{status:'unresolved',reason:'No proposed supported relation'});
 return {contract:c,initial,sealedDigest,packets,verification,record,verificationEvidence,enabled:[...active]};
}
