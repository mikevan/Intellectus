import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {encode} from '../bridge.mjs';
const base=process.env.INTELLECTUS_UNDERSTANDING;
if(!base) throw Error('Set INTELLECTUS_UNDERSTANDING to a built Understanding tree');
const {fingerprint}=await import(pathToFileURL(resolve(base,'dist/src/ir/index.js')));
for(const [language, corpus, ext] of [['typescript','ir0-typescript','.ts'],['python','radon-python','.py'],['python','toml-python','.py']]){
  test(language+' '+corpus+' exact encoder preservation',async()=>{
    const direct=await import(pathToFileURL(resolve(base,'dist/src/adapters',language,'index.js')));
    const dir=resolve(base,'corpora',corpus,'src');
    const paths=readdirSync(dir,{recursive:true,withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith(ext));
    assert.ok(paths.length);
    for(const file of paths){
      const source=readFileSync(resolve(file.parentPath??file.path,file.name),'utf8');
      const original=await direct.encodeFunctions(source);
      const actual=await encode(language,source,base);
      assert.deepEqual(actual.executables,[...original].map(([name,ir])=>({name,ir,fingerprint:fingerprint(ir)})));
      assert.equal(actual.status,'partial');
    }
  });
}
test('unsupported JavaScript is explicit',async()=>{await assert.rejects(encode('javascript','',base),/Unsupported language/);});

