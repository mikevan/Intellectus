import { type FunctionIR } from "../../ir/index.js";
export declare const ENCODER = "typescript-adapter/0.5";
export declare function encodeFunctions(source: string): Promise<Map<string, FunctionIR>>;
