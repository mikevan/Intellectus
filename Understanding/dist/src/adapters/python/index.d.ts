import { type FunctionIR } from "../../ir/index.js";
export declare const ENCODER = "python-adapter/0.9";
export declare function encodeFunctions(source: string): Promise<Map<string, FunctionIR>>;
