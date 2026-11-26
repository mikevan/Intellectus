import {createHash} from 'node:crypto';
import {investigateAndReconcile} from './deliberation.mjs';
import {reconcile,normalizeHypothesis,fullFixtureEvidence} from './reconciliation.mjs';
import {behavioralIdentity} from './knowledge.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const format={hypothesis:'string',candidate:{type:'affine-integer-v1',intercept:'decimal integer string',coefficients:'decimal integer strings in input order'},candidateOptional:true};
function decode(c,role,response){
 const raw=response?.hypothesis;
 if(typeof raw!=='string'||raw.length>4096)throw Error('Invalid revision');
 let parsed;try{parsed=JSON.parse(raw);}catch{}
 return {...normalizeHypothesis(c,role,parsed&&typeof parsed.hypothesis==='string'?parsed:response),rawHypothesis:raw};
}
export async function deliberate(c,options={},maxRounds=2){
 if(!Number.isSafeInteger(maxRounds)||maxRounds<0||maxRounds>5)throw Error('Invalid revision budget');
 const initial=await investigateAndReconcile(c,options);
 if(!initial.deliberation)return {initial,rounds:[],status:'unresolved',reason:'Independent verification disabled'};
 if(!initial.deliberation.observationsAgree)return {initial,rounds:[],status:'unresolved',reason:'Conflicting independent observations'};
 const full=fullFixtureEvidence(c);
 if(full.some(s=>behavioralIdentity(c,s.rows).id!==initial.deliberation.consensus.behavioralId)&&initial.deliberation.consensus.status==='verified-in-scope')return {initial,rounds:[],status:'unresolved',reason:'Observation changed between rounds'};
 const training=initial.result.initial.find(p=>p.role==='behavioral')?.body.inputs??[];
 const history=[];const outstanding=new Map();
 let pending=initial.deliberation.results.filter(r=>r.status==='contradicted'&&['conceptual','domain'].includes(r.role));
 for(const p of pending)outstanding.set(p.role,p.claimDigest);
 for(let round=1;round<=maxRounds&&pending.length;round++){
  const revisions=[];
  for(const prior of pending){
   const port=options[prior.role];
   if(!port)continue;
   const feedback={role:prior.role,contract:c,observations:structuredClone(training),previous:structuredClone(prior.original),counterexample:structuredClone(prior.counterexample),requestedHypothesisFormat:format};
   try{
    const revision=decode(c,prior.role,await port(feedback));
    revisions.push({...revision,revisionOf:prior.claimDigest});
   }catch(e){revisions.push({role:prior.role,status:'unresolved',revisionOf:prior.claimDigest,reason:String(e.message??e)});}
  }
  if(!revisions.length)break;
  const checked=reconcile(c,revisions,full);
  const record={round,previousDigest:history.length?history.at(-1).digest:initial.deliberation.sealedDigest,revisions,checked};
  history.push({...record,digest:digest(record)});
  for(const q of checked.results){if(q.status==='verified-in-scope')outstanding.delete(q.role);else if(q.status==='contradicted')outstanding.set(q.role,q.claimDigest);}
  pending=checked.results.filter(r=>r.status==='contradicted'&&['conceptual','domain'].includes(r.role));
 }
 const assessments=[...initial.deliberation.results,...history.flatMap(r=>r.checked.results)];
 const verified=assessments.filter(r=>r.status==='verified-in-scope');
 const latest=initial.deliberation.consensus.status==='verified-in-scope'?initial.deliberation.consensus:history.find(r=>r.checked.consensus.status==='verified-in-scope')?.checked.consensus;
 return {initial,rounds:history,status:latest?'verified-in-scope':'unresolved',consensus:latest??{status:'unresolved'},verifiedClaimDigests:verified.map(x=>x.claimDigest),unresolvedContradictions:[...outstanding.values()],maxRounds};
}
