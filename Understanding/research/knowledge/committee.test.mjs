import test from 'node:test';
import assert from 'node:assert/strict';
import {contract} from './knowledge.mjs';
import {investigateFixture,specialistRoles} from './committee.mjs';
const c=contract([['0','4'],['-2','2']]);
test('full seven-role coordination; missing AI and structural ports are explicit',async()=>{
 const r=await investigateFixture(c);
 assert.deepEqual(r.packets.map(p=>p.role),specialistRoles);
 assert.equal(r.initial.length,6);assert.equal(r.record.status,'verified-in-scope');
 assert.equal(r.initial.find(p=>p.role==='conceptual').body.status,'unresolved');
 assert.equal(r.initial.find(p=>p.role==='domain').body.status,'unresolved');
 assert.equal(r.initial.find(p=>p.role==='structural').body.status,'unresolved');
});
test('independent AI ports cannot see held-out oracle or each other claims or elevate hypotheses',async()=>{
 const seen=[];
 const r=await investigateFixture(c,{conceptual:async i=>{seen.push(i);i.observations[0].outcome.value='99';return {hypothesis:'The answer is always 99.'};},domain:async i=>{seen.push(i);return {hypothesis:'Unknown business context.'};}});
 assert.equal(seen[1].observations[0].outcome.value,'11');
 assert.deepEqual(Object.keys(seen[1]).sort(),['contract','observations','role']);
 assert.ok(seen.every(x=>x.observations.length===3));
 assert.equal(r.initial.find(p=>p.role==='conceptual').body.status,'proposed');
 assert.equal(r.record.status,'verified-in-scope');
});
test('invalid or unavailable model result becomes unresolved',async()=>{
 const r=await investigateFixture(c,{conceptual:async()=>({verified:true}),domain:async()=>{throw Error('Unavailable');}});
 assert.equal(r.initial.find(p=>p.role==='conceptual').body.status,'unresolved');
 assert.equal(r.initial.find(p=>p.role==='domain').body.status,'unresolved');
});
test('disabled mathematical specialist prevents unsupported assertion',async()=>{
 const r=await investigateFixture(c,{enabled:specialistRoles.filter(x=>x!=='mathematical')});
 assert.equal(r.record,null);assert.equal(r.verification,null);assert.equal(r.packets.at(-1).body.status,'unresolved');
});
test('disabled skeptic prevents promotion',async()=>{
 const r=await investigateFixture(c,{enabled:specialistRoles.filter(x=>x!=='skeptic')});
 assert.equal(r.record,null);assert.equal(r.verification,null);
});
test('static port is evidence not verification',async()=>{
 const r=await investigateFixture(c,{structural:async()=>({fingerprint:'structural-only',status:'partial'})});
 assert.equal(r.initial.find(p=>p.role==='structural').body.view.status,'partial');
 assert.equal(r.record.status,'verified-in-scope');
});
