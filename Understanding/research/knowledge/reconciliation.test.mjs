import test from 'node:test';
import assert from 'node:assert/strict';
import {contract,evidence} from './knowledge.mjs';
import {reconcile,fullFixtureEvidence,normalizeHypothesis} from './reconciliation.mjs';
const c=contract([['0','4'],['-2','2']]);
const correct={type:'affine-integer-v1',intercept:'7',coefficients:['3','-2']};
const incorrect={type:'affine-integer-v1',intercept:'11',coefficients:['3','5']};
const packet=(role,candidate)=>normalizeHypothesis(c,role,{hypothesis:'candidate',candidate});
test('live-run incorrect formula is falsified; deterministic correct candidate is verified',()=>{
 const r=reconcile(c,[packet('conceptual',incorrect),packet('mathematical',correct)],fullFixtureEvidence(c));
 assert.equal(r.results[0].status,'contradicted');assert.equal(r.results[1].status,'verified-in-scope');
 assert.deepEqual(r.results[0].counterexample,{input:['0','-2'],predicted:'1',observed:'11'});
 assert.equal(r.consensus.status,'verified-in-scope');
});
test('false majority cannot override one verified candidate',()=>{
 const r=reconcile(c,[...Array.from({length:5},()=>packet('conceptual',incorrect)),packet('mathematical',correct)],fullFixtureEvidence(c));
 assert.equal(r.results.filter(x=>x.status==='contradicted').length,5);assert.equal(r.consensus.claimDigests.length,1);
});
test('unsupported free-text hypothesis stays unresolved, not rejected as false',()=>{
 const r=reconcile(c,[normalizeHypothesis(c,'domain',{hypothesis:'Business context unknown.'})],fullFixtureEvidence(c));
 assert.equal(r.results[0].status,'unresolved');assert.equal(r.consensus.status,'unresolved');
});
test('independent observers with conflicting outcomes cannot establish consensus',()=>{
 const sets=fullFixtureEvidence(c);sets[1].rows.at(-1).outcome.value='99';
 sets[1].artifact=evidence(JSON.stringify(sets[1].rows),'typescript','test mutation','negative-control');
 const r=reconcile(c,[packet('mathematical',correct)],sets);
 assert.equal(r.observationsAgree,false);assert.equal(r.consensus.status,'unresolved');
});
test('refuses altered evidence bytes and incomplete observation set',()=>{
 const sets=fullFixtureEvidence(c);sets[0].rows.pop();assert.throws(()=>reconcile(c,[packet('mathematical',correct)],sets),/digest mismatch/);
 sets[0].artifact=evidence(JSON.stringify(sets[0].rows),'python','test','x');assert.throws(()=>reconcile(c,[packet('mathematical',correct)],sets),/Incomplete/);
});
test('input packets are preserved without allowing candidate executable text',()=>{
 const p=normalizeHypothesis(c,'conceptual',{hypothesis:'untrusted text',candidate:{type:'javascript',code:'1+1'}});
 const before=structuredClone(p),r=reconcile(c,[p],fullFixtureEvidence(c));assert.deepEqual(r.initial,[before]);assert.deepEqual(p,before);assert.equal(r.results[0].status,'unresolved');
});
import {investigateAndReconcile} from './deliberation.mjs';
test('committee captures structured candidate and reconciles against newly acquired evidence',async()=>{
 const r=await investigateAndReconcile(c,{conceptual:async()=>({hypothesis:JSON.stringify({hypothesis:'linear conjecture',candidate:incorrect})}),domain:async()=>({hypothesis:'Context unknown'})});
 assert.equal(r.deliberation.results.find(x=>x.role==='conceptual').status,'contradicted');
 assert.equal(r.deliberation.results.find(x=>x.role==='mathematical').status,'verified-in-scope');
 assert.equal(r.deliberation.results.find(x=>x.role==='domain').status,'unresolved');
 assert.equal(r.deliberation.consensus.status,'verified-in-scope');
});
