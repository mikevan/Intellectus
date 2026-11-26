import test from 'node:test';
import assert from 'node:assert/strict';
import {contract,behavioralIdentity} from './knowledge.mjs';
import {observeFixture,discoverAffine,verifyAffine} from './observation.mjs';
const c=contract([['0','4'],['-2','2']]);
const initial=[['0','-2'],['1','-2'],['0','-1']];
test('real Python and TypeScript processes agree on complete scoped mappings',()=>{
 const a=observeFixture('python',c),b=observeFixture('typescript',c);
 assert.deepEqual(behavioralIdentity(c,a.rows),behavioralIdentity(c,b.rows));
 assert.notEqual(a.source.digest,b.source.digest);
 assert.equal(a.rows.length,25);
});
test('discover compact relationship without supplying formula to discovery',()=>{
 const training=observeFixture('python',c,initial);
 const found=discoverAffine(c,training.rows);
 assert.equal(found.status,'proposed');
 assert.deepEqual(found.candidate,{type:'affine-integer-v1',intercept:'7',coefficients:['3','-2']});
 const independent=observeFixture('typescript',c);
 assert.equal(verifyAffine(c,found.candidate,independent.rows).status,'verified-in-scope');
});
test('missing intervention is unresolved',()=>assert.equal(discoverAffine(c,observeFixture('python',c,initial.slice(0,2)).rows).status,'unresolved'));
test('held-back disagreement invalidates extrapolation',()=>{
 const {candidate}=discoverAffine(c,observeFixture('python',c,initial).rows);
 const observed=observeFixture('typescript',c).rows;
 observed.at(-1).outcome.value='999';
 const result=verifyAffine(c,candidate,observed);
 assert.equal(result.status,'contradicted');assert.deepEqual(result.counterexample.input,['4','2']);
});
test('unsupported language and out-of-scope input refused',()=>{
 assert.throws(()=>observeFixture('other',c),/Unsupported/);
 assert.throws(()=>observeFixture('python',c,[['5','0']]),/Invalid observation/);
});
