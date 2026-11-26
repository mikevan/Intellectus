const D = process.env.HOME + "/und-p0-base/dist/src";
const { canonicalise } = await import(D + "/ir/index.js");
const py = await import(D + "/adapters/python/index.js");
const ts = await import(D + "/adapters/typescript/index.js");
const s = { py: `
def noop(a):
    a[0](a)

def noop2(a):
    (lambda: 1)()

def loop(a):
    for i in a:
        h(i)

def ret(a):
    return f(a)
`, ts: `
function noop(a: any) { a[0](a); }
function loop(a: any) { for (const i of a) { h(i); } }
function ret(a: number) { return f(a); }
` };
for (const [lang, enc] of [["py", py], ["ts", ts]])
  for (const [n, fn] of await enc.encodeFunctions(s[lang])) console.log(lang, n, JSON.stringify(canonicalise(fn).body));
