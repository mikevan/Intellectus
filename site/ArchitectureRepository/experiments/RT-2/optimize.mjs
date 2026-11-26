import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fingerprint,express} from './linguistic.mjs';
const d=process.argv[2],load=n=>JSON.parse(readFileSync(resolve(d,n),'utf8')),save=(n,v)=>writeFileSync(resolve(d,n),JSON.stringify(v,null,2)+'\n');
const one=load('semantic-1.json'),two=load('semantic-2.json');
const fps=m=>Object.fromEntries(m.executables.map(x=>[x.name,x.fingerprint]));
assert.deepEqual(fps(one),fps(two));
const output=structuredClone(two),trace=[];
function pure(o){return ['input','literal','value'].includes(o.kind);}
function optimize(body,path){
 return body.flatMap((s,i)=>{
  if(s.kind!=='branch')return [s];
  const at=path+'.'+i,yes=optimize(s.then,at+'.then'),no=optimize(s.else,at+'.else');
  if(pure(s.predicate.left)&&pure(s.predicate.right)&&JSON.stringify(yes)===JSON.stringify(no)){trace.push({path:at,rule:'eliminate-identical-arms'});return yes;}
  return [{...s,then:yes,else:no}];
 });
}
for(const x of output.executables){x.ir.body=optimize(x.ir.body,x.name);x.fingerprint=fingerprint(x.ir);}
assert.equal(trace.length,1);save('optimized.json',output);save('transformations.json',trace);
const bad=structuredClone(output);bad.executables[0].ir.body[0].kind='opaque';assert.throws(()=>express(bad,'python'));
