# Intellectus RT-3 Experiment Report

**Date:** November 25, 2026 (Central time)
**Result:** Pass, independently reproduced.
**Question:** Does a round trip preserve intentionally bad code when optimization is disabled?
**Scope:** Exact RT-1 fixture, RT-2 runtime and adapters, no optimization.

## Frozen prediction and setup

The RT-1 original Python fixture was copied byte-for-byte (SHA-256 AB2B99F3BFDA82F1F3103C7D4564126E8CEF05224067CEF4C0EC473F5DC89177). RT-2's exact five OSGi bundles were reused; linguistic.mjs SHA-256 matched RT-2 (41034FB08AC9B8CCCD297D10F836EAC25F8E8058574E83C8E3A0F4A0EE7D3017). No prior experimental artifact was edited. Only the orchestration switched from optimized to direct expression of the persisted TypeScript-derived model. No optimization command ran and no optimized model existed.

Karaf used a separate configuration omitting SSH and management boot features and clearing remote Maven repository URLs. Examined logs contain no SSH/management boot entries or external URL references. This is not a packet-level proof of no traffic. Both Karaf runs shut down.

## Original Python

~~~python
# Intentionally redundant implementation; returns integer discount percentage.
def discount(total, member):
    if total >= 10000:
        if member == 1:
            if total >= 10000:
                return 15
            else:
                return 15
        else:
            if total >= 10000:
                return 5
            else:
                return 5
    else:
        if member == 1:
            return 5
        else:
            return 0
~~~

## Reconstructed Python

~~~python
def discount(p0, p1):
    if p0 >= 10000:
        if p1 == 1:
            if p0 >= 10000:
                return 15
            else:
                return 15
        else:
            if p0 >= 10000:
                return 5
            else:
                return 5
    else:
        if p1 == 1:
            return 5
        else:
            return 0
~~~

Every branch and return remains in place. Both redundant comparisons remain, including the identical terminating arms. Parameter names were synthesized, not retained; the comment and original line endings/formatting were not reconstructed. Original 461 bytes, reconstructed 357 bytes; comparing file size alone does not measure semantic fidelity. Original and reconstructed SHA-256 differ, as expected for normalized source.

## Measured results

| Measurement | Original Python | Generated TypeScript | Reconstructed Python |
|---|---:|---:|---:|
| Cyclomatic | 6 | 6 | 6 |
| Campbell cognitive | 16 | 16 | 16 |
| MBCC | 21 | 21 | 21 |
| Independent obligation cases passed | 40,004 | 40,004 | 40,004 |

All three intrinsic fingerprints are identical: 3d87c9d70f031ae2b5603ac6. The actual encoded executable IR objects also compare deep-equal, a stronger check than fingerprint equality alone. Independent execution tested integer totals 0 through 20,000 plus 1,000,000,000, each with member 0 and 1. The oracle is independent of the original implementation and identical to RT-1's documented obligations. The domain partitions are covered for this decision tree, but this is not exhaustive sampling of all possible integers in the declared range or arbitrary programs.

## Runtime lifecycle

Both runs passed 13 service assertions/operations. The expected registry states (none, Python, none, TypeScript, none, Python) were observed. The original and TypeScript-derived model hashes matched after the originating provider stopped. Python was expressed directly from persisted semantic-2, then re-encoded. The experimental snapshot service remains distinct from a full Understanding journal integration.

## Independent reproduction

All six deterministic artifacts matched by SHA-256 across fresh Karaf data directories run-01 and run-02: semantic-1.json, semantic-2.json, semantic-3.json, generated.ts, reconstructed.py, results.json. See reproduction.json. Both runs executed 120,012 successful business-oracle comparisons. Earlier experiments remain unchanged; RT-1 report hash reconfirmed.

## Conclusions and limitations

RT-3 supports controlled structural and behavioral reconstruction fidelity for the tested decision tree. Understanding did not implicitly optimize it. The bad code remains bad. This is not exact source reconstruction, preservation of keyword argument names/API compatibility, comments or formatting. The positional-only business contract is the one tested. Future research may distinguish intrinsic semantic knowledge from optional lexical/provenance knowledge needed for exact reconstruction. No sharding was introduced. RT-4 is the corresponding unoptimized RT-2 fixture experiment and remains next.

## Evidence

Root C:\workspace\Intellectus-RT-3. FROZEN-PROTOCOL.md, original.py, Run-RT3.ps1, verify.mjs, linguistic.mjs, per-run Karaf console/logs and persisted models, reproduction.json. The runtime bundle repository is C:\workspace\Intellectus-RT-2\build\features.xml. Reproduce in a fresh run directory:
~~~powershell
& C:\workspace\Intellectus-RT-3\Run-RT3.ps1 -Run run-NEW
node C:\workspace\Intellectus-RT-3\verify.mjs run-NEW
~~~
