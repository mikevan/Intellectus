// The journal is the truth about everything Understanding has ever believed. The projection is what it believes now.
// Events are immutable and append-only; transactions are atomic; an uncommitted transaction is ignored on replay.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { isConceptKind, newConceptId } from "../concepts/index.js";
import { SCHEMA_VERSION, checkAssertion } from "../schema/index.js";
export class JournalError extends Error {
}
export class Journal {
    path;
    seq = 0;
    txSeq = 0;
    open;
    tornTail = false;
    concepts = new Map();
    live = new Map();
    all = [];
    dependents = new Map(); // assertion id -> derived assertions that depend on it
    constructor(path) {
        this.path = path;
        if (path && existsSync(path)) {
            const text = readFileSync(path, "utf8");
            this.replay(text);
            if (this.tornTail) {
                // Truncate the incomplete trailing bytes. They were never part of a committed transaction, so this removes
                // no history; leaving them in place would put an unparseable line in the middle of the file the moment the
                // next transaction is appended, and every later load would read it as corruption rather than as a crash.
                const keep = text.slice(0, text.lastIndexOf("\n") + 1);
                writeFileSync(path, keep);
            }
        }
    }
    /** Replay a journal text. Uncommitted transactions are ignored; nothing else is validated again, because it was
     * validated when written. A torn line is treated as the crash it is: it and everything after it are discarded, and
     * the transaction it belongs to is discarded whole, because appendFileSync is one call and not an atomic durable
     * append across a process, OS, or power failure. A torn line anywhere but the tail is corruption, not a crash, and
     * is refused. */
    replay(text) {
        const raw = text.split("\n").filter((l) => l.length > 0);
        const events = [];
        let torn = false;
        for (let i = 0; i < raw.length; i++) {
            let e;
            try {
                e = JSON.parse(raw[i]);
            }
            catch {
                if (i === raw.length - 1) {
                    torn = true;
                    break;
                } // the tail: a crash mid-append
                throw new JournalError(`Journal line ${i + 1} is not valid JSON and is not the last line: the journal is corrupt, not torn.`);
            }
            if (typeof e.kind !== "string") {
                if (i === raw.length - 1) {
                    torn = true;
                    break;
                }
                throw new JournalError(`Journal line ${i + 1} is not an event.`);
            }
            events.push(e);
        }
        this.tornTail = torn;
        let pending = [];
        let inTx = false;
        for (const e of events) {
            if (e.kind === "BEGIN") {
                pending = [];
                inTx = true;
                continue;
            }
            if (e.kind === "COMMIT") {
                for (const p of pending)
                    this.apply(p);
                pending = [];
                inTx = false;
                this.txSeq = Math.max(this.txSeq, e.tx);
                continue;
            }
            if (!inTx)
                throw new JournalError(`Event outside a transaction at sequence ${"id" in e ? e.id : "?"}.`);
            pending.push(e);
        }
        // a trailing pending set with no COMMIT is dropped, whether the tail was torn or simply absent: the crash rule
    }
    /** True when the last line of the journal was incomplete on load, so a transaction was discarded. */
    get hadTornTail() { return this.tornTail; }
    apply(e) {
        this.all.push(e);
        if ("id" in e)
            this.seq = Math.max(this.seq, e.id);
        if (e.kind === "CONCEPT")
            this.concepts.set(e.concept.id, e.concept);
        else if (e.kind === "ASSERT") {
            if (e.supersedes !== undefined)
                this.live.delete(e.supersedes);
            this.live.set(e.id, e);
            for (const d of e.derived_from ?? []) {
                let s = this.dependents.get(d);
                if (!s)
                    this.dependents.set(d, (s = new Set()));
                s.add(e.id);
            }
        }
        else if (e.kind === "RETRACT")
            this.live.delete(e.target);
    }
    begin(label) {
        if (this.open)
            throw new JournalError("A transaction is already open; one writer, one transaction at a time.");
        const tx = ++this.txSeq;
        this.open = { tx, events: [{ kind: "BEGIN", tx, schema: SCHEMA_VERSION, at: now(), label }], staged: new Map() };
        return tx;
    }
    inTx() {
        if (!this.open)
            throw new JournalError("No transaction is open; call begin() first.");
        return this.open;
    }
    lookup = (id) => this.open?.staged.get(id) ?? this.concepts.get(id);
    concept(kind) {
        const t = this.inTx();
        if (!isConceptKind(kind))
            throw new JournalError(`Unknown concept kind ${kind}.`);
        const c = { id: newConceptId(), kind };
        t.staged.set(c.id, c);
        t.events.push({ kind: "CONCEPT", id: ++this.seq, tx: t.tx, schema: SCHEMA_VERSION, at: now(), concept: c });
        return c;
    }
    assert(a) {
        const t = this.inTx();
        checkAssertion(a, this.lookup);
        if (a.supersedes !== undefined && !this.live.has(a.supersedes) && !t.events.some((e) => e.kind === "ASSERT" && e.id === a.supersedes))
            throw new JournalError(`Cannot supersede ${a.supersedes}: it is not live.`);
        const e = { ...a, verification: a.verification ?? "NONE", kind: "ASSERT", id: ++this.seq, tx: t.tx, schema: SCHEMA_VERSION, at: now() };
        t.events.push(e);
        return e.id;
    }
    /** Retract a live assertion. Derived assertions that depend on it are retracted in the same transaction: one rule, applied by the store. */
    retract(target, reason) {
        const t = this.inTx();
        if (!this.live.has(target))
            throw new JournalError(`Cannot retract ${target}: it is not live.`);
        const done = [];
        const visit = (id) => {
            for (const d of this.dependents.get(id) ?? [])
                if (this.live.has(d) && !done.includes(d))
                    visit(d);
            t.events.push({ kind: "RETRACT", id: ++this.seq, tx: t.tx, schema: SCHEMA_VERSION, at: now(), target: id, reason: done.length ? { ...reason, evidence: { ...(reason.evidence ?? {}), invalidatedBy: target } } : reason });
            done.push(id);
        };
        visit(target);
        return done;
    }
    commit() {
        const t = this.inTx();
        t.events.push({ kind: "COMMIT", tx: t.tx, schema: SCHEMA_VERSION, at: now() });
        const text = t.events.map((e) => JSON.stringify(e)).join("\n") + "\n";
        if (this.path)
            appendFileSync(this.path, text); // BEGIN..COMMIT lands as one write; a crash before it leaves nothing committed
        for (const e of t.events)
            if (e.kind !== "BEGIN" && e.kind !== "COMMIT")
                this.apply(e);
        this.open = undefined;
    }
    abort() { this.open = undefined; }
    // ---- the projection ----
    getConcept(id) { return this.concepts.get(id); }
    liveAssertions() { return [...this.live.values()]; }
    about(id) { return this.liveAssertions().filter((a) => a.subject === id || a.object === id); }
    history() { return this.all; }
    get sequence() { return this.seq; }
}
export function literal(type, value) { return { type, value }; }
function now() { return new Date().toISOString(); }
