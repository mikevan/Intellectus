import test from 'node:test';
import assert from 'node:assert/strict';
import {contract} from './knowledge.mjs';
import {deliberate} from './revision.mjs';
const c=contract([['0','4'],['-2','2']]);
const candidate=(intercept,coefficients)=>({hypothesis:JSON.stringify({hypothesis:'candidate',candidate:{type:'affine-integer-v1',intercept,coefficients}})});
const wrong=candidate('11',['3','5']),right=candidate('7',['3','-2']);
test('counterexample-driven revision retains original contradicted claim',async()=>{
 let calls=0;
 const r=await deliberate(c,{conceptual:async input=>{calls++;if(calls===1)return wrong;assert.deepEqual(input.counterexample,{input:['0','-2'],predicted:'1',observed:'11'});assert.equal(input.observations.length,3);assert.equal(input.previous.role,'conceptual');return right;}},2);
 assert.equal(calls,2);assert.equal(r.initial.deliberation.results[0].status,'contradicted');assert.equal(r.rounds[0].checked.results[0].status,'verified-in-scope');
 assert.equal(r.rounds[0].revisions[0].revisionOf,r.initial.deliberation.results[0].claimDigest);assert.equal(r.unresolvedContradictions.length,0);
});
test('persistent disagreement ends at budget, not forced consensus',async()=>{
 let calls=0;const r=await deliberate(c,{conceptual:async()=>{calls++;return wrong;}},2);
 assert.equal(calls,3);assert.equal(r.rounds.length,2);assert.equal(r.unresolvedContradictions.length,1);
 assert.equal(r.rounds[1].previousDigest,r.rounds[0].digest);
 assert.ok(r.rounds.every(x=>x.checked.results[0].status==='contradicted'));
 assert.equal(r.status,'verified-in-scope'); // mathematical relation remains independently verified
});
test('revision unavailable remains unresolved',async()=>{
 let calls=0;const r=await deliberate(c,{conceptual:async()=>{if(++calls===1)return wrong;throw Error('unavailable');}},2);
 assert.equal(r.rounds[0].checked.results[0].status,'unresolved');
 assert.equal(r.initial.deliberation.results[0].status,'contradicted');
});
test('zero budget retains contradiction; invalid budget refused',async()=>{
 const r=await deliberate(c,{conceptual:async()=>wrong},0);assert.equal(r.rounds.length,0);assert.equal(r.unresolvedContradictions.length,1);
 await assert.rejects(()=>deliberate(c,{},6),/budget/);
});
