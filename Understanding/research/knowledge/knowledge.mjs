import {createHash} from 'node:crypto';
import {readFileSync,appendFileSync,existsSync} from 'node:fs';
const sha = b => createHash('sha256').update(b).digest('hex');
const canonical = v => JSON.stringify(v, null, 0);
const int = v => {
  if (typeof v !== 'string' || !/^(0|-?[1-9][0-9]*)$/.test(v)) throw Error('Noncanonical integer');
  return BigInt(v);
};
function immutable(v){return JSON.parse(JSON.stringify(v));}
export function contract(bounds) {
  if (!Array.isArray(bounds) || !bounds.length) throw Error('Missing input bounds');
  const normalized=bounds.map(pair=>{
    if(!Array.isArray(pair)||pair.length!==2)throw Error('Invalid bounds');
    if(int(pair[0])>int(pair[1]))throw Error('Reversed bounds');
    return [...pair];
  });
  const size=normalized.reduce((n,[lo,hi])=>n*(int(hi)-int(lo)+1n),1n);
  if(size>100000n)throw Error('Finite domain exceeds research bound');
  const value={schema:'finite-pure-integer-v1',bounds:normalized,observable:'normal-integer-return',effects:'none',ordering:'not-observed',environment:'declared-pure-deterministic'};
  return {...value,id:sha(canonical(value))};
}
function checkedContract(c){
 const expected=contract(c.bounds);
 if(canonical(c)!==canonical(expected))throw Error('Contract mismatch');
 return expected;
}
export function tuples(c){
 checkedContract(c);
 let result=[[]];
 for(const [lo,hi] of c.bounds){
  const next=[];
  for(const prefix of result)for(let v=int(lo);v<=int(hi);v++)next.push([...prefix,String(v)]);
  result=next;
 }
 return result;
}
function validateRow(c,row){
 if(!row||!Array.isArray(row.input)||row.input.length!==c.bounds.length)throw Error('Invalid input');
 row.input.forEach((v,i)=>{const n=int(v);if(n<int(c.bounds[i][0])||n>int(c.bounds[i][1]))throw Error('Out of domain');});
 if(row.outcome?.kind!=='return'||row.outcome.effects!==false)throw Error('Observation contract violation');
 int(row.outcome.value);
 return {input:[...row.input],value:row.outcome.value};
}
export function behavioralIdentity(c,rows){
 checkedContract(c);
 const mapping=new Map();
 for(const row of rows){const v=validateRow(c,row),key=canonical(v.input);if(mapping.has(key))throw Error('Duplicate input');mapping.set(key,v);}
 const ordered=tuples(c).map(input=>{const row=mapping.get(canonical(input));if(!row)throw Error('Incomplete observation set');return row;});
 const bytes=canonical({schema:'finite-behavior-v1',contract:c.id,observations:ordered});
 return {id:sha(bytes),bytes};
}
export function evidence(bytes,producer,method,run){
 if(typeof producer!=='string'||!producer||!method||!run)throw Error('Missing provenance');
 const b=Buffer.from(bytes);
 return {digest:sha(b),size:b.length,producer,method,run};
}
const kinds=new Set(['observed','structural','inferred','declared','domain-expectation']);
export function claim({subject,contractId,kind,representation,payload,assumptions=[],dependencies=[],evidenceRefs=[]}){
 if(!subject||!contractId||!kinds.has(kind)||!representation?.type||!representation?.version)throw Error('Invalid claim');
 const core={schema:'claim-v1',subject,contractId,kind,representation:immutable(representation),payload:immutable(payload),assumptions:immutable(assumptions),dependencies:[...dependencies].sort()};
 return {...core,id:sha(canonical(core)),evidenceRefs:[...new Set(evidenceRefs)].sort()};
}
// Narrow, independent reference checker: compares complete predicted and observed mappings.
// Does not authenticate observations, prove purity, or infer intent. Report claims only within the declared scope.
export function verifyFinite(c,proposed,observed){
 const expected=behavioralIdentity(c,proposed),actual=behavioralIdentity(c,observed);
 if(expected.bytes===actual.bytes)return {status:'verified-in-scope',checker:'finite-exact-v1',contractId:c.id,expected:expected.id,actual:actual.id};
 const p=JSON.parse(expected.bytes).observations,a=JSON.parse(actual.bytes).observations;
 const i=p.findIndex((r,j)=>r.value!==a[j].value);
 return {status:'contradicted',checker:'finite-exact-v1',contractId:c.id,expected:expected.id,actual:actual.id,counterexample:{input:a[i].input,predicted:p[i].value,observed:a[i].value}};
}
export class ResearchJournal{
 constructor(path){this.path=path;this.events=[];this.claims=new Map();this.artifacts=new Map();this.state=new Map();
  if(path&&existsSync(path)){const raw=readFileSync(path,'utf8');if(raw&&!raw.endsWith('\n'))throw Error('Incomplete journal record');for(const line of raw.split('\n').filter(Boolean))this.#apply(JSON.parse(line));}
 }
 #apply(e){
  if(e.seq!==this.events.length+1)throw Error('Journal sequence mismatch');
  if(e.kind==='artifact'){if(this.artifacts.has(e.record.digest))throw Error('Duplicate artifact');this.artifacts.set(e.record.digest,e.record);}
  else if(e.kind==='claim'){
   const r=e.record;if(this.claims.has(r.id))throw Error('Duplicate claim');
   if(claim(r).id!==r.id)throw Error('Claim identity mismatch');
   for(const id of r.evidenceRefs)if(!this.artifacts.has(id))throw Error('Unknown evidence');
   for(const id of r.dependencies)if(!this.claims.has(id))throw Error('Unknown dependency');
   this.claims.set(r.id,r);this.state.set(r.id,'proposed');
  }else if(e.kind==='assessment'){
   const r=this.claims.get(e.claimId);if(!r)throw Error('Unknown claim');
   if(r.contractId!==e.result.contractId)throw Error('Assessment scope mismatch');
   for(const id of e.evidenceRefs)if(!this.artifacts.has(id))throw Error('Unknown assessment evidence');
   const status=e.result.status;
   if(!['verified-in-scope','contradicted','unresolved'].includes(status))throw Error('Invalid assessment');
   if(status==='verified-in-scope'&&r.dependencies.some(id=>this.state.get(id)!=='verified-in-scope'))throw Error('Unverified dependency');
   this.state.set(r.id,status);
   if(status!=='verified-in-scope')this.#invalidate(r.id);
  }else throw Error('Unknown event');
  this.events.push(immutable(e));
 }
 #invalidate(id){
  for(const [key,r] of this.claims)if(r.dependencies.includes(id)){this.state.set(key,'unresolved');this.#invalidate(key);}
 }
 #append(event){
  const e={...immutable(event),seq:this.events.length+1};
  // Validate against a replayed in-memory projection before persisting.
  const dry=new ResearchJournal();for(const prior of this.events)dry.#apply(prior);dry.#apply(e);
  if(this.path)appendFileSync(this.path,canonical(e)+'\n',{encoding:'utf8'});
  this.#apply(e);
 }
 recordArtifact(record){this.#append({kind:'artifact',record});}
 recordClaim(record){this.#append({kind:'claim',record});}
 assessFinite(id,c,proposed,observed,refs){
  const r=this.claims.get(id);if(!r||r.contractId!==c.id||r.kind!=='inferred'||r.representation.type!=='finite-mapping')throw Error('Unsupported claim or scope');
  if(r.payload.behavioralId!==behavioralIdentity(c,proposed).id)throw Error('Prediction differs from claim');
  if(!refs.includes(sha(JSON.stringify(observed))))throw Error('Assessment must reference exact observed rows');
  const result=verifyFinite(c,proposed,observed);
  this.#append({kind:'assessment',claimId:id,result,evidenceRefs:refs});return result;
 }
}
