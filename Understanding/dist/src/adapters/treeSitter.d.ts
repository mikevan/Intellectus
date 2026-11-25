import { Language, type Node } from "web-tree-sitter";
export declare function loadLanguage(name: "python" | "typescript"): Promise<Language>;
export declare function parse(name: "python" | "typescript", source: string): Promise<Node>;
export declare function children(n: Node): Node[];
export declare function text(n: Node): string;
