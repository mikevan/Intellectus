// Transport-neutral first experiment: preserve the exact existing encoder output.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
export async function encode(language, source, understandingRoot) {
  const names = {python:'python', typescript:'typescript'};
  if (!Object.hasOwn(names,language)) throw new Error('Unsupported language: '+language);
  const base = resolve(understandingRoot,'dist/src');
  const adapter = await import(pathToFileURL(resolve(base,'adapters',names[language],'index.js')));
  const {IR_SCHEMA,fingerprint} = await import(pathToFileURL(resolve(base,'ir/index.js')));
  const encoded = await adapter.encodeFunctions(source);
  return {contractVersion:'0.1',language,encoder:adapter.ENCODER,irSchema:IR_SCHEMA,
    sourceHash:createHash('sha256').update(source,'utf8').digest('hex'),
    status:'partial', limitations:['Legacy encoder does not expose complete source spans or reconstruction; no equivalence claimed.'],
    executables:[...encoded].map(([name,ir])=>({name,ir,fingerprint:fingerprint(ir)}))};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [language,root]=process.argv.slice(2);
    if(!language || !root) throw new Error('Usage: node bridge.mjs <python|typescript> <Understanding root>');
    const result=await encode(language,readFileSync(0,'utf8'),root);
    process.stdout.write(JSON.stringify(result)+'\n');
  } catch (e) {console.error(e.message);process.exitCode=1;}
}

