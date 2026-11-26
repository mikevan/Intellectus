export declare const IR_SCHEMA = 6;
/** What an unrepresented construct is, in language-neutral terms. An adapter maps its own node types onto this list
 * and the grammar's own vocabulary never reaches the IR: two grammars must not disagree merely because they use
 * different words for what neither of them can yet represent. */
export declare const OPAQUE_CATEGORIES: readonly ["loop", "multi-branch", "exception-handling", "concurrency", "declaration", "value-stream-emission", "scoped-resource-handoff", "scoped-resource", "local-function-construction", "completion-dependency", "other"];
export type OpaqueCategory = (typeof OPAQUE_CATEGORIES)[number];
/** IR-9. What kind of statement this is, decided on execution semantics and nothing else.
 *
 *  SEMANTIC      execution behaviour: an assignment, a call, a yield, a raise, a loop, a branch, a with, a try.
 *                Only an unrepresented SEMANTIC statement counts toward opacity.
 *  NON_SEMANTIC  no execution semantics at all: a docstring, a bare string statement, `pass`, a comment. That a
 *                docstring is readable at runtime as __doc__ does not make the statement execution behaviour; a
 *                program that reads __doc__ does so through an attribute access, which is semantic in its own right.
 *  METADATA      binds or annotates without being execution behaviour: an import, a bare type annotation,
 *                `global`, `nonlocal`. Counted separately and outside the opacity numerator and denominator.
 *
 *  The boundaries were decided before the measurement; see docs/experiment-log.md, IR-9. */
export declare const STATEMENT_CLASSES: readonly ["SEMANTIC", "NON_SEMANTIC", "METADATA"];
export type StatementClass = (typeof STATEMENT_CLASSES)[number];
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
    receiver?: Operand;
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
    kind: "awaited";
    of: Expr;
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
    receiver?: Operand;
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
    kind: "evaluate";
    expr: Expr;
} | {
    kind: "opaque";
    category: OpaqueCategory;
    statementClass: StatementClass;
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
/** R-1A. What a completion dependency depends on: a tagged union, never an overloaded field. `outcome` when the
 * awaited evaluation already produces a projected outcome (a call), identified by content because the projection is
 * sorted and a position is not stable; `evaluation` when it produces none (`await ready`), carrying the operand. No
 * outcome is ever manufactured for the second case to make it look like the first. */
export type DependencyTarget = {
    kind: "outcome";
    outcome: {
        under: Predicate | null;
        what: Effect;
    };
} | {
    kind: "evaluation";
    operand: Operand;
};
/** R-1A. Where the await point sits: the carrier it lives in and the ordinal of that statement in the walk, which is
 * formatting-invariant provenance. Source lines are not in the IR by design. */
export interface AwaitPoint {
    form: "evaluate" | "bind" | "return" | "throw";
    statement: number;
}
export type Outcome = Effect | {
    kind: "return";
    value?: Operand;
} | {
    kind: "throw";
    value?: Operand;
} | {
    kind: "bind";
    id: number;
    expr: Expr;
} | {
    kind: "COMPLETION_DEPENDENCY";
    on: DependencyTarget;
    at: AwaitPoint;
    depth: number;
};
export interface Projection {
    inputs: number;
    outcomes: {
        under: Predicate | null;
        what: Outcome;
    }[];
}
/** Strip every `awaited` wrapper. What remains is the evaluation whose facts must be unchanged by R-1A. */
export declare function unwrapAwaited(e: Expr): {
    inner: Expr;
    depth: number;
};
export declare function project(input: FunctionIR): Projection;
/** Effects and bindings, dropping bare returns with no value: the part E1 compares first. */
export declare function effectProjection(fn: FunctionIR): Projection["outcomes"];
/** R-1A. Provenance is not semantics. The await point's \`at\` is kept on the projected outcome for auditing and left
 * out of the fingerprint, because the walk ordinal of a statement differs between a nested-if spelling and an
 * early-return chain of the same logic. X2 caught exactly that: the section-16 pair diverged on \`at.statement\` alone. */
export declare function withoutProvenance(outcomes: Projection["outcomes"]): Projection["outcomes"];
export declare function fingerprint(fn: FunctionIR): string;
export declare function canonNumber(text: string): CanonLiteral;
export declare function canonString(text: string): CanonLiteral;
/** A path literal is stored one way on every platform: forward slashes, no drive letter case surprises, no leading "./". */
export declare function canonPath(p: string): string;
