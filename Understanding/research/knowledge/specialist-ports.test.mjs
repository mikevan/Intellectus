import test from 'node:test';
import assert from 'node:assert/strict';
import {structuralPort,colibriPort} from './specialist-ports.mjs';
import {contract} from './knowledge.mjs';
import {investigateFixture} from './committee.mjs';
const root=process.env.INTELLECTUS_MONOREPO??'C:/workspace-Intellectus';
const c=contract([['0','4'],['-2','2']]);
test('actual existing structural encoder returns partial evidence, not semantic equivalence',async()=>{
 const port=structuralPort(root),a=await port({language:'python'}),b=await port({language:'typescript'});
 assert.equal(a.status,'partial');assert.equal(b.status,'partial');
 assert.notEqual(a.sourceHash,b.sourceHash);
 assert.ok(a.executables.some(x=>x.name==='transform'));
 assert.ok(b.executables.some(x=>x.name==='transform'));
});
test('Colibri request uses explicit configured model and bounded local transport',async()=>{
 const port=colibriPort({model:'test-model',transport:async(url,options)=>{
  assert.equal(url.href,'http://127.0.0.1:8000/v1/chat/completions');
  assert.equal(options.redirect,'error');
  const req=JSON.parse(options.body);assert.equal(req.model,'test-model');assert.equal(req.max_tokens,512);
  return {ok:true,json:async()=>({model:'test-model',choices:[{finish_reason:'stop',message:{content:'{"hypothesis":"unknown"}'}}],usage:{total_tokens:23}})};
 }});
 const result=await port({role:'domain',contract:c,observations:[]});assert.equal(result.hypothesis,'unknown');assert.equal(result.telemetry.usage.total_tokens,23);
});
test('reject remote endpoint, absent model, and malformed response',async()=>{
 assert.throws(()=>colibriPort({baseUrl:'https://example.com/v1',model:'x'}),/Local/);
 assert.throws(()=>colibriPort({}),/Explicit/);
 const p=colibriPort({model:'x',transport:async()=>({ok:true,json:async()=>({choices:[{message:{content:'not JSON'}}]})})});
 await assert.rejects(()=>p({role:'conceptual',contract:c,observations:[]}),/Malformed/);
});
test('real structural integration with deterministic committee and independently mocked AI',async()=>{
 const model=colibriPort({model:'test',transport:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"hypothesis":"Not established"}'}}]})})});
 const result=await investigateFixture(c,{structural:structuralPort(root),conceptual:model,domain:model});
 assert.equal(result.initial.find(x=>x.role==='structural').body.view.status,'partial');
 assert.equal(result.initial.find(x=>x.role==='domain').body.status,'proposed');
 assert.equal(result.record.status,'verified-in-scope');
});
