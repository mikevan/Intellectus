import {createHash} from 'node:crypto';
import {behavioralIdentity,evidence,claim,ResearchJournal,tuples} from './knowledge.mjs';
import {predict,verifyAffine,observeFixture} from './observation.mjs';
const digest = v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const integer = s=>typeof s==='string'&&/^(0|-?[1-9][0-9]*)$/.test(s);
function candidateValid(c,v){
 return v&&v.type==='affine-integer-v1'&&integer(v.intercept)&&Array.isArray(v.coefficients)&&v.coefficients.length===c.bounds.length&&v.coefficients.every(integer)&&Object.keys(v).sort().join(',')==='coefficients,intercept,type';
}
function immutable(v){return structuredClone(v);}
export function reconcile(c,initial,evidenceSets){
 // The supplied complete observation sets must already be acquired by an independent
 // trusted observer. This routine checks mapping completeness, not execution authenticity.
 if(!Array.isArray(evidenceSets)||evidenceSets.length===0)throw Error('Independent evidence required');
 for(const set of evidenceSets){
  if(evidence(JSON.stringify(set.rows),'check','bytes','check').digest!==set.artifact.digest)throw Error('Evidence digest mismatch');
  behavioralIdentity(c,set.rows);
 }
 const observationsAgree=evidenceSets.every(s=>behavioralIdentity(c,s.rows).bytes===behavioralIdentity(c,evidenceSets[0].rows).bytes);
 const sealed=immutable(initial),sealedDigest=digest(sealed);
 const results=sealed.map(p=>{
  const base={role:p.role,claimDigest:digest(p),original:immutable(p)};
  if(p.status!=='proposed'||!candidateValid(c,p.candidate))return {...base,status:'unresolved',reason:'No supported machine-checkable mathematical claim'};
  const checks=evidenceSets.map(s=>({source:s.artifact.producer,artifact:s.artifact.digest,...verifyAffine(c,p.candidate,s.rows)}));
  const bad=checks.find(x=>x.status==='contradicted');
  return {...base,status:bad?'contradicted':observationsAgree?'verified-in-scope':'unresolved',checks,...(bad?{counterexample:bad.counterexample}:{})};
 });
 const verified=results.filter(x=>x.status==='verified-in-scope');
 // A checked candidate, not a vote. No preference based on agent identity or confidence.
 const group=observationsAgree&&verified.length?behavioralIdentity(c,evidenceSets[0].rows):null;
 return {sealedDigest,initial:sealed,observationsAgree,results,consensus:group?{status:'verified-in-scope',behavioralId:group.id,claimDigests:verified.map(x=>x.claimDigest)}:{status:'unresolved'},evidence:evidenceSets.map(s=>s.artifact)};
}
export function fullFixtureEvidence(c){return ['python','typescript'].map(language=>observeFixture(language,c));}
// Explicit structured format, no free-text equation parsing and no evaluation of model text.
export function normalizeHypothesis(c,role,response){
 if(!['conceptual','domain','mathematical'].includes(role))throw Error('Unsupported role');
 const p={role,status:'proposed',hypothesis:typeof response?.hypothesis==='string'?response.hypothesis.slice(0,4096):''};
 if(candidateValid(c,response?.candidate))p.candidate=immutable(response.candidate);
 return p;
}
