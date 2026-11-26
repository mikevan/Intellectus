import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [mode,root,file]=process.argv.slice(2);
const url=p=>pathToFileURL(resolve(root,'dist/src',p));
const {Journal,literal}=await import(url('journal/index.js'));
const {IR_SCHEMA,fingerprint,effectProjection}=await import(url('ir/index.js'));
const expected='e65298394ded8fe272f143ba';
function check(c,m){if(!c)throw new Error(m);}
function readEncoded(){
  const e=JSON.parse(readFileSync(0,'utf8'));
  check(e.language==='python'&&e.irSchema===IR_SCHEMA&&e.executables.length===1,'Wrong fixture');
  const x=e.executables[0];check(x.name==='eligible'&&fingerprint(x.ir)===x.fingerprint&&x.fingerprint===expected,'Fingerprint mismatch');
  return {e,x};
}
function recall(){
  check(existsSync(file),'No persisted journal');
  const j=new Journal(file), a=j.liveAssertions();
  check(!j.hadTornTail,'Unexpected torn journal');
  const names=a.filter(x=>x.relation==='RENDERS_AS'&&x.object.value==='eligible');
  check(names.length===1,'Missing executable name');
  const id=names[0].subject, facts=j.about(id);
  const f=facts.find(x=>x.relation==='HAS_FINGERPRINT');
  check(f?.object.value===expected&&f.derived_from.includes(names[0].id),'Missing fingerprint evidence');
  const predicates=facts.filter(x=>x.relation==='HAS_PREDICATE').map(x=>x.object.value);
  const gt=predicates.find(p=>p.kind==='compare'&&p.op==='GT'&&p.left.kind==='input'&&p.left.index===0&&p.right.kind==='literal'&&p.right.literal.type==='number');
  check(gt?.right.literal.value==='100','Missing threshold');
  check(predicates.some(p=>p.op==='LE'&&p.right.literal.value==='100'),'Missing complementary predicate');
  // A narrow, explicit query over stored predicate evidence, not program execution.
  const threshold=Number(gt.right.literal.value);
  check(!(100>threshold)&&101>threshold,'Predicate query failed');
  return {concept:id,fingerprint:f.object.value,threshold,predicateAt100:false,predicateAt101:true,assertions:facts.length};
}
try{
 if(mode==='learn'){
   check(!existsSync(file),'Trial journal already exists; use a new bundle data directory');
   const {e,x}=readEncoded(),j=new Journal(file);
   j.begin('Karaf lifecycle persistence trial');
   const c=j.concept('executable'),base={subject:c.id,source:'PARSED',asserter:e.encoder,confidence:1,ir_schema:e.irSchema,encoder:e.encoder,evidence:{sourceHash:e.sourceHash,fixture:'eligible'}};
   const nameId=j.assert({...base,relation:'RENDERS_AS',object:literal('identifier',x.name),attributes:{language:e.language}});
   j.assert({...base,relation:'HAS_FINGERPRINT',object:literal('fingerprint',x.fingerprint),attributes:{kind:'intrinsic',valid_from:j.sequence+1},derived_from:[nameId]});
   for(const outcome of effectProjection(x.ir)) if(outcome.under)j.assert({...base,relation:'HAS_PREDICATE',object:literal('predicate',outcome.under)});
   j.commit();
   console.log(JSON.stringify(recall()));
 }else if(mode==='recall'){console.log(JSON.stringify(recall()));}
 else if(mode==='compare'){const {x}=readEncoded(); const saved=recall();check(saved.fingerprint===x.fingerprint,'Reactivated adapter differs');console.log(JSON.stringify(saved));}
 else throw Error('Unknown trial mode');
}catch(e){console.error(e.message);process.exitCode=1;}

