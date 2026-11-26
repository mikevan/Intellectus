import type { StatementClass } from "../ir/index.js";
export type Language = "python" | "typescript";
export interface HiddenStatement {
    file: string;
    line: number;
    column: number;
    nodeType: string;
    construct: string;
    classification: StatementClass;
    /** The opaque container immediately above it, with its line: what conceals this statement. */
    nearestContainer: string;
    nearestContainerLine: number;
    /** How many opaque containers are above it, within the same function. 1 means directly inside one. */
    depth: number;
}
export interface ContainerReport {
    files: number;
    /** SOURCE statements in encoded function bodies that lie under no opaque container. NOT the same population as
     * the measure's statement count and not comparable one to one with it: one source statement can become several
     * IR statements, because a tuple assignment becomes one binding per target and a conditional expression becomes
     * a branch with two arms. On radon: 430 source statements here against 435 IR statements there. */
    sourceStatementsRepresented: Record<StatementClass, number>;
    hidden: HiddenStatement[];
    /** Hidden statements by the container immediately above them: what each opaque construct conceals. */
    byNearestContainer: Record<string, {
        total: number;
    } & Record<StatementClass, number>>;
    /** Hidden statements by IR-9 classification: what meaning the IR fails to expose. */
    byClassification: Record<StatementClass, number>;
    /** Hidden statements by construct, worst first, so `yield` and `await` are visible as themselves. */
    byConstruct: Record<string, number>;
    /** Not hidden by the definition above, and not represented either. Counted apart, never mixed in. */
    outsideAnyFunction: number;
    inUnencodedFunctionBodies: number;
    limits: string[];
}
export declare function measureContainers(files: {
    path: string;
    source: string;
    language: Language;
}[]): Promise<ContainerReport>;
