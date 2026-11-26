const D = process.env.HOME + "/und-p0-base/dist/src";
const { canonicalise, effectProjection } = await import(D + "/ir/index.js");
const py = await import(D + "/adapters/python/index.js");
const ts = await import(D + "/adapters/typescript/index.js");
const src = { py: `
def neg_ret(a):
    return -f(a)

def attr_ret(a):
    return f(a).x

def thr(a):
    raise g(a).err

def dup(a):
    f(a)
    return f(a)

def same_key(a):
    x = f(a)
    f(a)
    return x

def nested(a):
    h(g(a))

def twice(a):
    f(a)
    f(a)
`, ts: `
function negRet(a: number) { return -f(a); }
function thr(a: number) { throw g(a).err; }
function attrRet(a: any) { return f(a).x; }
` };
for (const [lang, enc] of [["py", py], ["ts", ts]])
  for (const [n, fn] of await enc.encodeFunctions(src[lang])) console.log(lang, n, JSON.stringify(canonicalise(fn).body), "\n   proj", JSON.stringify(effectProjection(fn).map(o=>[o.what.kind,o.what.operation??"",o.what.value?.kind??""])));
