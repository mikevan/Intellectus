import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fingerprint,baseline} from './linguistic.mjs';
const root=dirname(fileURLToPath(import.meta.url)),out=resolve(root,process.argv[2]);
const load=n=>JSON.parse(readFileSync(resolve(out,n),'utf8'));
const models=['semantic-1.json','semantic-2.json','semantic-3.json'].map(load);
const ir=models[0].executables[0].ir;
for(const m of models){
 assert.equal(m.executables.length,1);
 const x=m.executables[0];assert.equal(x.name,'discount');assert.equal(x.fingerprint,'3d87c9d70f031ae2b5603ac6');
 assert.equal(fingerprint(x.ir),x.fingerprint);assert.deepEqual(x.ir,ir);
}
assert.ok(!existsSync(resolve(out,'optimized.json')));
const commands=readFileSync(resolve(out,'commands.gogo'),'utf8');assert.ok(!commands.includes('rt2:optimize'));
const markers=readFileSync(resolve(out,'karaf-console.log'),'utf8').split(/\r?\n/).filter(x=>x.includes('RT2_PASS')).map(x=>x.trim());
assert.equal(markers.length,13);
assert.deepEqual(markers.filter(x=>x.startsWith('RT2_PASS adapters')).map(x=>x.split(' ').at(-1)),['none','python','none','typescript','none','python']);
const cases=[...Array.from({length:20001},(_,i)=>i),1000000000].flatMap(t=>[[t,0],[t,1]]),expected=cases.map(([t,m])=>t>=10000?(m===1?15:5):(m===1?5:0));
const files=[resolve(root,'original.py'),resolve(out,'generated.ts'),resolve(out,'reconstructed.py')];
for(const [i,file] of files.entries()){
 const ts=i===1,p=spawnSync(ts?process.execPath:'python',ts?['--experimental-strip-types',resolve(root,'run-typescript.mjs'),file]:[resolve(root,'run-python.py'),file],{input:JSON.stringify(cases),encoding:'utf8',maxBuffer:8*1024*1024,timeout:30000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(p.status,0,p.stderr);assert.deepEqual(JSON.parse(p.stdout),expected);
}
const req=createRequire(resolve(baseline,'Understanding/package.json'));
const complexity=createRequire(import.meta.url)(resolve(baseline,'complexity/dist/index.js'));
const {Parser,Language}=req('web-tree-sitter');await Parser.init();
const scores=[];
for(const [i,file] of files.entries()){
 const ts=i===1,p=new Parser();p.setLanguage(await Language.load(readFileSync(req.resolve(ts?'tree-sitter-typescript/tree-sitter-typescript.wasm':'tree-sitter-python/tree-sitter-python.wasm'))));
 const tree=p.parse(readFileSync(file,'utf8'));assert.ok(!tree.rootNode.hasError);
 try{const f=ts?complexity.findTypeScriptFunctions(tree.rootNode):complexity.findPythonFunctions(tree.rootNode);
 const [x]=ts?complexity.measureTypeScript(f):complexity.measurePython(f);
 const score={cyclomatic:x.cyclomatic,campbell:x.campbell,mbcc:x.mbcc};assert.deepEqual(score,{cyclomatic:6,campbell:16,mbcc:21});scores.push(score);
 }finally{tree.delete();p.delete();}
}
const [original,,reconstructed]=files.map(f=>readFileSync(f));
const sha=b=>createHash('sha256').update(b).digest('hex');
const result={status:'pass',optimization:'disabled',cases:cases.length,fingerprint:models[0].executables[0].fingerprint,exactIR:true,scores:{original:scores[0],typescript:scores[1],reconstructed:scores[2]},lexical:{byteIdentical:original.equals(reconstructed),originalSHA256:sha(original),reconstructedSHA256:sha(reconstructed),originalBytes:original.length,reconstructedBytes:reconstructed.length,parameterNames:'total/member -> p0/p1',commentPreserved:false},registryMarkers:markers};
writeFileSync(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
