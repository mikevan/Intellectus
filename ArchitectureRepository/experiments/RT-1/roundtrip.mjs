import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]??'C:/workspace-Intellectus');
const out=resolve(process.argv[3]??resolve(here,'results-'+Date.now()));
if(existsSync(out))throw Error('Output directory already exists');
mkdirSync(out,{recursive:true});
const understanding=resolve(root,'Understanding');
const {encode}=await import(pathToFileURL(resolve(root,'IntellectusRuntime/bridge.mjs')));
const {fingerprint,IR_SCHEMA}=await import(pathToFileURL(resolve(understanding,'dist/src/ir/index.js')));
const save=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n');
const load=name=>JSON.parse(readFileSync(resolve(out,name),'utf8'));
const source=readFileSync(resolve(here,'original.py'),'utf8');
const model1=await encode('python',source,understanding);
assert.equal(model1.irSchema,IR_SCHEMA);
assert.equal(model1.executables.length,1);
assert.equal(model1.executables[0].name,'discount');
save('semantic-1.json',model1);
// Narrow IR renderer: only pure decision trees over bounded integer inputs and integer returns.
// Explicitly refuse anything else, including unknown/opaque values and effects.
const op={EQ:'==',NE:'!=',GT:'>',GE:'>=',LT:'<',LE:'<='};
function integer(o){
 assert.equal(o.kind,'literal');assert.equal(o.literal.type,'number');
 const n=Number(o.literal.value);assert.ok(Number.isSafeInteger(n));return n;
}
function pred(p,language){
 assert.equal(p.kind,'compare');assert.equal(p.left.kind,'input');
 assert.ok(p.left.index===0||p.left.index===1);assert.ok(Object.hasOwn(op,p.op));
 const symbol=language==='typescript'&&p.op==='EQ'?'===':language==='typescript'&&p.op==='NE'?'!==':op[p.op];
 return 'p'+p.left.index+' '+symbol+' '+integer(p.right);
}
function validate(body){
 assert.ok(Array.isArray(body)&&body.length===1,'Only a terminating decision tree is supported');
 const s=body[0];if(s.kind==='return'){integer(s.value);return;}
 assert.equal(s.kind,'branch');pred(s.predicate,'python');validate(s.then);validate(s.else);
}
function render(model,language){
 assert.equal(model.inputs,2);validate(model.body);
 const lines=[language==='python'?'def discount(p0, p1):':'export function discount(p0: number, p1: number): number {'];
 function walk(body,depth){
   const s=body[0],pad='    '.repeat(depth);
   if(s.kind==='return'){lines.push(pad+'return '+integer(s.value)+(language==='typescript'?';':''));return;}
   if(language==='python'){
     lines.push(pad+'if '+pred(s.predicate,language)+':');walk(s.then,depth+1);
     lines.push(pad+'else:');walk(s.else,depth+1);
   }else{
     lines.push(pad+'if ('+pred(s.predicate,language)+') {');walk(s.then,depth+1);
     lines.push(pad+'} else {');walk(s.else,depth+1);lines.push(pad+'}');
   }
 }
 walk(model.body,1);if(language==='typescript')lines.push('}');return lines.join('\n')+'\n';
}
const originalModel=load('semantic-1.json').executables[0].ir;
const typescript=render(originalModel,'typescript');writeFileSync(resolve(out,'generated.ts'),typescript);
const model2=await encode('typescript',readFileSync(resolve(out,'generated.ts'),'utf8'),understanding);
assert.equal(model2.executables.length,1);assert.equal(model2.executables[0].fingerprint,model1.executables[0].fingerprint);
save('semantic-2.json',model2);
const roundtrip=load('semantic-2.json').executables[0].ir;
validate(roundtrip.body);
// Bottom-up equal-arm elimination: a pure test with identical terminating results adds no behavior.
const transformations=[];
function optimize(body,path='body'){
 const s=body[0];if(s.kind==='return')return structuredClone(body);
 const yes=optimize(s.then,path+'.then'),no=optimize(s.else,path+'.else');
 if(JSON.stringify(yes)===JSON.stringify(no)){
   transformations.push({rule:'eliminate-identical-arms',path,predicate:s.predicate});return yes;
 }
 return [{...s,then:yes,else:no}];
}
const optimized={inputs:roundtrip.inputs,body:optimize(roundtrip.body)};
assert.ok(transformations.length>0);save('semantic-optimized.json',optimized);save('transformations.json',transformations);
const final=render(load('semantic-optimized.json'),'python');writeFileSync(resolve(out,'improved.py'),final);
const finalModel=await encode('python',final,understanding);
assert.equal(finalModel.executables[0].fingerprint,fingerprint(optimized));save('semantic-3.json',finalModel);
// Negative control changes exactly one effective threshold at the semantic level.
const negative=structuredClone(optimized);negative.body[0].predicate.right.literal.value='10001';
writeFileSync(resolve(out,'negative.py'),render(negative,'python'));
const negativeModel=await encode('python',readFileSync(resolve(out,'negative.py'),'utf8'),understanding);
assert.notEqual(negativeModel.executables[0].fingerprint,finalModel.executables[0].fingerprint);
// Independent obligation oracle: two inputs; bounded integer cents 0..1e9 and member 0/1.
// Exhaustive 0..20000 plus boundary representatives above; all decision-cell representatives
// derived from each IR threshold, including negative control, cover this restricted domain.
const points=new Set(Array.from({length:20001},(_,i)=>i));points.add(1000000000);
function collect(body){const s=body[0];if(s.kind==='return')return;
 if(s.predicate.left.index===0){const n=integer(s.predicate.right);for(const x of [n-1,n,n+1])if(x>=0&&x<=1000000000)points.add(x);}
 collect(s.then);collect(s.else);}
for(const ir of [originalModel,roundtrip,optimized,negative])collect(ir.body);
const cases=[...points].sort((a,b)=>a-b).flatMap(x=>[[x,0],[x,1]]);
const expected=cases.map(([total,m])=>total>=10000?(m===1?15:5):(m===1?5:0));
const input=JSON.stringify(cases);
function run(command,args){
 const result=spawnSync(command,args,{input,encoding:'utf8',maxBuffer:16*1024*1024,timeout:60000});
 if(result.status!==0)throw Error(String(result.error??result.stderr));
 return JSON.parse(result.stdout);
}
const python=process.env.INTELLECTUS_PYTHON??'python';
const pyRunner=resolve(here,'run-python.py'),tsRunner=resolve(here,'run-typescript.mjs');
const observed={original:run(python,[pyRunner,resolve(here,'original.py')]),typescript:run(process.execPath,['--experimental-strip-types',tsRunner,resolve(out,'generated.ts')]),improved:run(python,[pyRunner,resolve(out,'improved.py')]),negative:run(python,[pyRunner,resolve(out,'negative.py')])};
for(const key of ['original','typescript','improved'])assert.deepEqual(observed[key],expected,key+' failed independent obligations');
const differences=cases.filter((_,i)=>observed.negative[i]!==expected[i]);assert.ok(differences.length>0);
const complexityRoot=resolve(process.env.INTELLECTUS_COMPLEXITY??resolve(root,'complexity'));
const complexity=createRequire(import.meta.url)(resolve(complexityRoot,'dist/index.js'));
const req=createRequire(resolve(understanding,'package.json'));
const {Parser,Language}=req('web-tree-sitter');
await Parser.init();
function scoresFor(source,language){
 const parser=new Parser();return (async()=>{
 const grammar=req.resolve(language==='python'?'tree-sitter-python/tree-sitter-python.wasm':'tree-sitter-typescript/tree-sitter-typescript.wasm');
 parser.setLanguage(await Language.load(readFileSync(grammar)));const tree=parser.parse(source);
 try{assert.ok(tree&&!tree.rootNode.hasError);const fn=language==='python'?complexity.findPythonFunctions(tree.rootNode):complexity.findTypeScriptFunctions(tree.rootNode);
 const [score]=language==='python'?complexity.measurePython(fn):complexity.measureTypeScript(fn);
 return {cyclomatic:score.cyclomatic,campbell:score.campbell,mbcc:score.mbcc};}finally{tree?.delete();parser.delete();}
 })();
}
const scores={original:await scoresFor(source,'python'),typescript:await scoresFor(typescript,'typescript'),improved:await scoresFor(final,'python')};
for(const key of Object.keys(scores.original))assert.ok(scores.improved[key]<scores.original[key],key+' did not improve');
const report={status:'passed',domain:{totalCents:[0,1000000000],membership:[0,1],output:'integer discount percentage'},cases:cases.length,negativeDifferences:differences,transformations:transformations.length,scores,fingerprints:{original:model1.executables[0].fingerprint,typescript:model2.executables[0].fingerprint,optimized:finalModel.executables[0].fingerprint,negative:negativeModel.executables[0].fingerprint},limitations:['Only pure terminating decision trees with input-to-integer comparisons and integer returns.','Not unrestricted semantic equivalence; obligation oracle and decision partitions apply to the declared domain.','No runtime performance claim.']};
save('results.json',report);console.log(JSON.stringify(report,null,2));

