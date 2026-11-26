import test from 'node:test';
import assert from 'node:assert/strict';
import {contract} from './knowledge.mjs';
import {conciseColibriPort} from './concise-colibri.mjs';
import {deliberate} from './revision.mjs';
const c=contract([['0','4'],['-2','2']]);
const response=v=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(v)}}],usage:{total_tokens:20}})});
test('direct typed response and counterexample repair',async()=>{
 let calls=0;
 const p=conciseColibriPort({model:'test',transport:async(url,opts)=>{
  const req=JSON.parse(opts.body),input=JSON.parse(req.messages[1].content);
  assert.ok(req.messages[0].content.includes('compact JSON object'));
  if(input.role==='domain')return response({hypothesis:'Unknown',candidate:null});
  calls++;
  if(calls===1)return response({hypothesis:'Incorrect',candidate:{type:'affine-integer-v1',intercept:'11',coefficients:['3','5']}});
  assert.deepEqual(input.counterexample,{input:['0','-2'],predicted:'1',observed:'11'});
  return response({hypothesis:'Corrected',candidate:{type:'affine-integer-v1',intercept:'7',coefficients:['3','-2']}});
 }});
 const r=await deliberate(c,{conceptual:p,domain:p},2);
 assert.equal(r.initial.deliberation.results[0].status,'contradicted');assert.equal(r.rounds[0].checked.results[0].status,'verified-in-scope');assert.equal(calls,2);
});
test('plain text retained without inventing typed candidate',async()=>{
 const p=conciseColibriPort({model:'test',transport:async()=>({ok:true,json:async()=>({choices:[{message:{content:'f(x)=something'}}]})})});
 const r=await p({role:'conceptual',contract:c,observations:[]});assert.equal(JSON.parse(r.hypothesis).hypothesis,'f(x)=something');assert.equal(r.telemetry.typed,false);
});
test('invalid candidate is not repaired or accepted',async()=>{
 const p=conciseColibriPort({model:'test',transport:async()=>response({hypothesis:'bad',candidate:{type:'affine-integer-v1',intercept:'7',coefficients:[3,-2]}})});
 const r=await p({role:'conceptual',contract:c,observations:[]});assert.equal(r.telemetry.typed,false);assert.equal(r.telemetry.reason,'Invalid candidate');
});


test('truncated typed JSON is retained but cannot be accepted',async()=>{
 const raw='{"candidate":{"type":"affine-integer-v1","intercept":"7","coefficients":["3","-2"]}';
 const p=conciseColibriPort({model:'test',transport:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:raw}}]})})});
 const r=await p({role:'conceptual',contract:c,observations:[]});
 assert.equal(r.telemetry.typed,false);assert.equal(r.telemetry.reason,'Incomplete response');assert.equal(JSON.parse(r.hypothesis).hypothesis,raw);
});
