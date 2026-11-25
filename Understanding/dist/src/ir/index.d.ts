export declare const IR_SCHEMA = 3;
/** What an unrepresented construct is, in language-neutral terms. An adapter maps its own node types onto this list
 * and the grammar's own vocabulary never reaches the IR: two grammars must not disagree merely because they use
 * different words for what neither of them can yet represent. */
export declare const OPAQUE_CATEGORIES: readonly ["loop", "multi-branch", "exception-handling", "concurrency", "declaration", "other"];
export type OpaqueCategory = (typeof OPAQUE_CATEGORIES)[number];
export type CanonLiteral = {
    type: "number";
    value: string;
} | {
    type: "string";
    value: string;
} | {
    type: "boolean";
    value: boolean;
} | {
    type: "absent";
};
export type CompareOp = "EQ" | "NE" | "GT" | "GE" | "LT" | "LE";
export type Operand = {
    kind: "input";
    index: number;
} | {
    kind: "literal";
    literal: CanonLiteral;
} | {
    kind: "value";
    id: number;
} | {
    kind: "negated";
    operand: Operand;
} | {
    kind: "read";
    object: Operand;
    property: string;
} | {
    kind: "computed";
    expr: Expr;
} | {
    kind: "behaviour";
    inputs: number;
    body: Stmt[];
} | {
    kind: "unknown";
    reason: string;
};
/** What a binding computes. Kept complete enough that a future emitter could render it back; nothing lexical except
 * names that are externally observable (a called operation, a property that names state or protocol). */
export type Expr = {
    kind: "operand";
    operand: Operand;
} | {
    kind: "call";
    operation?: string;
    args: Operand[];
} | {
    kind: "member";
    object: Operand;
    property: string;
} | {
    kind: "index";
    object: Operand;
    at: Operand;
} | {
    kind: "arith";
    op: "ADD" | "SUB" | "MUL" | "DIV" | "MOD" | "CONCAT";
    left: Operand;
    right: Operand;
} | {
    kind: "test";
    predicate: Predicate;
} | {
    kind: "choose";
    predicate: Predicate;
    whenTrue: Operand;
    whenFalse: Operand;
} | {
    kind: "unknown";
    reason: string;
};
export type Predicate = {
    kind: "compare";
    op: CompareOp;
    left: Operand;
    right: Operand;
} | {
    kind: "absent";
    operand: Operand;
    negated: boolean;
} | {
    kind: "and";
    operands: Predicate[];
} | {
    kind: "or";
    operands: Predicate[];
} | {
    kind: "not";
    operand: Predicate;
} | {
    kind: "truthy";
    operand: Operand;
    negated: boolean;
} | {
    kind: "opaque";
    category: OpaqueCategory;
} | {
    kind: "opaque";
    category: OpaqueCategory;
};
export type EffectKind = "READ" | "WRITE" | "EMIT" | "CALL_EXTERNAL" | "THROW" | "RETURN";
export interface Effect {
    kind: EffectKind;
    operation?: string;
    args: Operand[];
}
export type Stmt = {
    kind: "branch";
    predicate: Predicate;
    then: Stmt[];
    else: Stmt[];
} | {
    kind: "bind";
    id: number;
    expr: Expr;
} | {
    kind: "return";
    value?: Operand;
} | {
    kind: "throw";
    value?: Operand;
} | {
    kind: "effect";
    effect: Effect;
} | {
    kind: "opaque";
    category: OpaqueCategory;
};
export interface FunctionIR {
    inputs: number;
    body: Stmt[];
}
/** A value bound once and read once is a name the author chose, not a step in the computation: inline it at its use,
 * so `x = a.b; if (x >= y)` and `if (a.b >= y)` are one shape. A value read more than once, or never, stays: the
 * first because sharing is part of the meaning, the second because a dead binding is a fact about the code. A call
 * is never inlined, because moving an effect moves when it happens. */
export declare function canonicalise(fn: FunctionIR): FunctionIR;
/** Push negations to the atoms and put inputs on the left of comparisons. */
export declare function normalise(p: Predicate, negate?: boolean): Predicate;
/** The semantic projection of a function: every effect and return with the path condition under which it is reached. */
export interface Projection {
    inputs: number;
    outcomes: {
        under: Predicate | null;
        what: Effect | {
            kind: "return";
            value?: Operand;
        } | {
            kind: "throw";
            value?: Operand;
        } | {
            kind: "bind";
            id: number;
            expr: Expr;
        };
    }[];
}
export declare function project(input: FunctionIR): Projection;
/** Effects and bindings, dropping bare returns with no value: the part E1 compares first. */
export declare function effectProjection(fn: FunctionIR): Projection["outcomes"];
export declare function fingerprint(fn: FunctionIR): string;
export declare function canonNumber(text: string): CanonLiteral;
export declare function canonString(text: string): CanonLiteral;
/** A path literal is stored one way on every platform: forward slashes, no drive letter case surprises, no leading "./". */
export declare function canonPath(p: string): string;
