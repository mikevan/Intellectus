import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { Parser, Language, type Node } from "web-tree-sitter";

const require = createRequire(import.meta.url);
let ready: Promise<void> | undefined;
const languages = new Map<string, Language>();

export async function loadLanguage(name: "python" | "typescript"): Promise<Language> {
  if (!ready) ready = Parser.init();
  await ready;
  let lang = languages.get(name);
  if (!lang) {
    const path = name === "python" ? require.resolve("tree-sitter-python/tree-sitter-python.wasm") : require.resolve("tree-sitter-typescript/tree-sitter-typescript.wasm");
    lang = await Language.load(readFileSync(path));
    languages.set(name, lang);
  }
  return lang;
}

export async function parse(name: "python" | "typescript", source: string) {
  const lang = await loadLanguage(name);
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(source);
  if (!tree) throw new Error("parse failed");
  return tree.rootNode;
}

export function children(n: Node): Node[] { const out: Node[] = []; for (let i = 0; i < n.namedChildCount; i++) { const c = n.namedChild(i); if (c) out.push(c); } return out; }
export function text(n: Node): string { return n.text; }
