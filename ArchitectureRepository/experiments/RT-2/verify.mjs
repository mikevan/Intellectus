import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fingerprint,express,baseline} from './linguistic.mjs';
const root=dirname(fileURLToPath(import.meta.url)),out=resolve(root,process.argv[2]??'run-01');
const load=n=>JSON.parse(readFileSync(resolve(out,n),'utf8'));
const one=load('semantic-1.json'),two=load('semantic-2.json'),opt=load('optimized.json'),three=load('semantic-3.json');
const fps=m=>Object.fromEntries(m.executables.map(x=>[x.name,x.fingerprint]));
assert.deepEqual(fps(one),fps(two));assert.deepEqual(fps(opt),fps(three));
assert.notEqual(fps(one).discount,fps(three).discount);assert.equal(fps(one).base,fps(three).base);
for(const m of [one,two,opt,three])for(const x of m.executables)assert.equal(fingerprint(x.ir),x.fingerprint);
const cases=Array.from({length:101},(_,i)=>i).flatMap(t=>[[t,0],[t,1]]),expected=cases.map(([t,m])=>t+3+2*m);
function run(file,ts=false){
 const p=spawnSync(ts?process.execPath:'python',ts?['--experimental-strip-types',resolve(root,'run-typescript.mjs'),file]:[resolve(root,'run-python.py'),file],{input:JSON.stringify(cases),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},timeout:30000});
 assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
}
for(const [file,ts] of [[resolve(root,'original.py'),false],[resolve(out,'generated.ts'),true],[resolve(out,'improved.py'),false]])assert.deepEqual(run(file,ts),expected);
const negative={};
for(const kind of ['base-arithmetic','membership','premium']){
 const m=structuredClone(opt),base=m.executables.find(x=>x.name==='base').ir,discount=m.executables.find(x=>x.name==='discount').ir;
 if(kind==='base-arithmetic')base.body[0].value.expr.right.literal.value='4';
 if(kind==='membership')discount.body[1].predicate.right.literal.value='0';
 if(kind==='premium')discount.body[1].then[0].value.expr.right.literal.value='1';
 const file=resolve(out,'negative-'+kind+'.py');writeFileSync(file,express(m,'python'));
 const actual=run(file),differences=cases.filter((_,i)=>actual[i]!==expected[i]);assert.ok(differences.length);negative[kind]={count:differences.length,example:differences[0]};
}
const req=createRequire(resolve(baseline,'Understanding/package.json'));
const complexity=createRequire(import.meta.url)(resolve(baseline,'complexity/dist/index.js'));
const {Parser,Language}=req('web-tree-sitter');await Parser.init();
async function score(file,ts=false){
 const p=new Parser();p.setLanguage(await Language.load(readFileSync(req.resolve(ts?'tree-sitter-typescript/tree-sitter-typescript.wasm':'tree-sitter-python/tree-sitter-python.wasm'))));
 const tree=p.parse(readFileSync(file,'utf8'));assert.ok(!tree.rootNode.hasError);
 try{
 const f=ts?complexity.findTypeScriptFunctions(tree.rootNode):complexity.findPythonFunctions(tree.rootNode);
 return (ts?complexity.measureTypeScript(f):complexity.measurePython(f)).map(x=>({name:x.name,cyclomatic:x.cyclomatic,campbell:x.campbell,mbcc:x.mbcc}));
 }finally{tree.delete();p.delete();}
}
const scores={original:await score(resolve(root,'original.py')),typescript:await score(resolve(out,'generated.ts'),true),improved:await score(resolve(out,'improved.py'))};
for(const k of ['cyclomatic','campbell','mbcc']){assert.ok(scores.improved[1][k]<scores.original[1][k]);assert.equal(scores.improved[0][k],scores.original[0][k]);}
const result={status:'pass',cases:cases.length,negative,scores,fingerprints:{original:fps(one),typescript:fps(two),improved:fps(three)}};
writeFileSync(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
