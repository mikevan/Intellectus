import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { Parser, Language } from "web-tree-sitter";
const require = createRequire(import.meta.url);
let ready;
const languages = new Map();
export async function loadLanguage(name) {
    if (!ready)
        ready = Parser.init();
    await ready;
    let lang = languages.get(name);
    if (!lang) {
        const path = name === "python" ? require.resolve("tree-sitter-python/tree-sitter-python.wasm") : require.resolve("tree-sitter-typescript/tree-sitter-typescript.wasm");
        lang = await Language.load(readFileSync(path));
        languages.set(name, lang);
    }
    return lang;
}
export async function parse(name, source) {
    const lang = await loadLanguage(name);
    const parser = new Parser();
    parser.setLanguage(lang);
    const tree = parser.parse(source);
    if (!tree)
        throw new Error("parse failed");
    return tree.rootNode;
}
export function children(n) { const out = []; for (let i = 0; i < n.namedChildCount; i++) {
    const c = n.namedChild(i);
    if (c)
        out.push(c);
} return out; }
export function text(n) { return n.text; }
