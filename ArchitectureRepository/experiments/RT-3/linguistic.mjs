import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const baseline='C:/workspace-Intellectus';
export const {fingerprint}=await import(pathToFileURL(resolve(baseline,'Understanding/dist/src/ir/index.js')));
const {encode}=await import(pathToFileURL(resolve(baseline,'IntellectusRuntime/bridge.mjs')));
const nameOK=s=>typeof s==='string'&&/^[A-Za-z_][A-Za-z_0-9]*$/.test(s)&&! /^(if|else|return|def|function|const|let|export|class|import|while|for|break|continue|from|global|nonlocal|async|await|new|this|super|var|delete|in|of|int|float|None|True|False)$/.test(s);
export function express(model,lang){
 assert.ok(['python','typescript'].includes(lang));assert.equal(model.irSchema,6);
 const funcs=new Map(model.executables.map(x=>[x.name,x.ir]));assert.equal(funcs.size,model.executables.length);
 const ts=lang==='typescript',lines=[];
 for(const [name,ir] of funcs){
  assert.ok(nameOK(name));assert.ok(Number.isSafeInteger(ir.inputs)&&ir.inputs>=0);
  const args=Array.from({length:ir.inputs},(_,i)=>'p'+i);
  function operand(o,locals){
   switch(o.kind){
    case 'input': assert.ok(args[o.index]);return args[o.index];
    case 'value': assert.ok(locals.has(o.id));return 'v'+o.id;
    case 'literal': assert.equal(o.literal.type,'number');assert.ok(/^-?\d+$/.test(o.literal.value)&&Number.isSafeInteger(Number(o.literal.value)));return String(Number(o.literal.value));
    case 'computed': return expression(o.expr,locals);
    default: throw Error('Unsupported operand: '+o.kind);
   }
  }
  function expression(e,locals){
   if(e.kind==='arith'){assert.equal(e.op,'ADD');return '('+operand(e.left,locals)+' + '+operand(e.right,locals)+')';}
   if(e.kind==='call'){assert.ok(funcs.has(e.operation));assert.equal(e.args.length,funcs.get(e.operation).inputs);return e.operation+'('+e.args.map(a=>operand(a,locals)).join(', ')+')';}
   throw Error('Unsupported expression: '+e.kind);
  }
  function walk(body,depth,locals){
   assert.ok(body.length);const pad='    '.repeat(depth);
   for(const [i,s] of body.entries()){
    if(s.kind==='bind'){assert.ok(i<body.length-1&&Number.isSafeInteger(s.id)&&s.id>=0&&!locals.has(s.id));lines.push(pad+(ts?'const ':'')+'v'+s.id+' = '+expression(s.expr,locals)+(ts?';':''));locals.add(s.id);continue;}
    assert.equal(i,body.length-1);
    if(s.kind==='return'){lines.push(pad+'return '+operand(s.value,locals)+(ts?';':''));continue;}
    assert.equal(s.kind,'branch');assert.equal(s.predicate.kind,'compare');
    const op={EQ:ts?'===':'==',GE:'>='}[s.predicate.op];assert.ok(op);
    const pred=operand(s.predicate.left,locals)+' '+op+' '+operand(s.predicate.right,locals);
    lines.push(pad+(ts?'if ('+pred+') {':'if '+pred+':'));walk(s.then,depth+1,new Set(locals));
    lines.push(pad+(ts?'} else {':'else:'));walk(s.else,depth+1,new Set(locals));if(ts)lines.push(pad+'}');
   }
  }
  lines.push(ts?'export function '+name+'('+args.map(a=>a+': number').join(', ')+'): number {':'def '+name+'('+args.join(', ')+'):');
  walk(ir.body,1,new Set());if(ts)lines.push('}');lines.push('');
 }
 return lines.join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,language]=process.argv.slice(2),input=readFileSync(0,'utf8');
 if(mode==='encode')process.stdout.write(JSON.stringify(await encode(language,input,resolve(baseline,'Understanding')))+'\n');
 else if(mode==='express')process.stdout.write(express(JSON.parse(input),language));
 else throw Error('Unknown operation');
}
