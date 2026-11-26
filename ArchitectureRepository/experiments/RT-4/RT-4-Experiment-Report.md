# RT-4 — Unoptimized multi-function semantic reconstruction
**Date:** November 25, 2026 (Central time). **Status:** Pass, independently reproduced.

RT-4 repeats RT-2's exact Python fixture (SHA-256 C9AD91DF9A111FDA2EA04A83DF6B2AA39DF72F14C3D5BC10AC0BD526BA97096F), with optimization disabled. It uses the unchanged RT-2 language bundles, Understanding snapshot service and worker and RT-3 local-only Karaf configuration. The frozen protocol was recorded before the first run. No earlier experimental evidence was edited.

## Original
~~~python
def base(total):
    return total + 3

def discount(total, member):
    amount = base(total)
    if member == 1:
        if total >= 10:
            return amount + 2
        else:
            return amount + 2
    else:
        return amount
~~~
## Reconstructed
~~~python
def base(p0):
    return (p0 + 3)

def discount(p0, p1):
    v0 = base(p0)
    if p1 == 1:
        if p0 >= 10:
            return (v0 + 2)
        else:
            return (v0 + 2)
    else:
        return v0
~~~

Both functions' encoded executable objects compare deep-equal across original Python, generated TypeScript, and reconstructed Python. The call, arithmetic, local binding, redundant conditional and both equal arms survive unchanged. Identifier spelling and formatting do not: total/member become p0/p1, amount becomes v0; parentheses and line endings are normalized. Original 244 bytes, reconstructed 211; not byte-identical. No comment was present in this fixture. Keyword-argument compatibility was not established.

## Results
| Function | Metric | Original | TypeScript | Reconstructed |
|---|---|---:|---:|---:|
| base | Cyclomatic | 1 | 1 | 1 |
| base | Campbell | 0 | 0 | 0 |
| base | MBCC | 0 | 0 | 0 |
| discount | Cyclomatic | 3 | 3 | 3 |
| discount | Campbell | 5 | 5 | 5 |
| discount | MBCC | 6 | 6 | 6 |

All 202 input pairs (integer total 0..100, membership 0/1) matched the independent formula total+3+2*member in every implementation, 606 comparisons per run. Fingerprints: base ff1f89439ef6967f15034b25, discount 767d9fd06e6439d4833b0cdd across all three. No optimized model or optimization command was present.

Both fresh Karaf runs produced all 13 expected runtime markers, including registry states none, Python, none, TypeScript, none, Python and matching snapshot recall hashes with language adapters inactive. All six deterministic files matched SHA-256 across both runs: three models, generated TypeScript, reconstructed Python and results JSON. Local-only configuration omitted SSH and management boot features and cleared remote Maven repository URLs; no matching network service or external URL entries appeared in inspected logs. Not a packet-level network test. Both runs shut down.

## Comparison of the four trials
| Trial | Fixture | Optimization | Discount complexity before → after (cyclomatic / Campbell / MBCC) |
|---|---|---|---|
| RT-1 | Single function | Enabled | 6/16/21 → 4/8/7 |
| RT-2 | Two functions | Enabled | 3/5/6 → 2/2/1 |
| RT-3 | Single function | Disabled | 6/16/21 → 6/16/21 |
| RT-4 | Two functions | Disabled | 3/5/6 → 3/5/6 |

The experiment supports separation of semantic reconstruction and explicit optimization. It does not establish arbitrary language translation, exact source reproduction, or a production persistence implementation. No sharding was introduced. Sharding remains a separately documented future spike.

## Evidence and reproduction
Root: C:\workspace\Intellectus-RT-4. FROZEN-PROTOCOL.md, original.py, Run-RT4.ps1, verify.mjs, run-01 and run-02 semantic snapshots and logs, reproduction.json. Runtime bundle repository: C:\workspace\Intellectus-RT-2\build\features.xml. Reproduce with a new directory:
~~~powershell
& C:\workspace\Intellectus-RT-4\Run-RT4.ps1 -Run run-NEW
node C:\workspace\Intellectus-RT-4\verify.mjs run-NEW
~~~
