# Intellectus RT-2 Experiment Report

**Date:** November 25, 2026 (Central time)
**Outcome:** Passed restricted round-trip and service-lifecycle feasibility tests; reproduced in a second fresh Karaf data directory.
**Scope:** Internal research. RT-1 unchanged.

## Question and method

RT-2 tests whether two cooperating functions, integer arithmetic, local bindings and a redundant decision can be represented and reconstructed through separately provisioned LinguisticPython and LinguisticTypeScript OSGi services, retaining semantic knowledge across provider deactivation. The fixture and protocol were frozen before implementation (FROZEN-PROTOCOL.md). No existing Understanding source, Complexity definitions, or RT-1 artifacts were edited.

The independent business obligation is discount(total, member) = total + 3 + 2 * member, for each integer total 0 through 100 and member 0 or 1. All 202 permitted pairs were executed by all three implementations. The base function itself adds 3. All calls are pure for the declared domain; the optimization removes a duplicate-arm conditional.

## Source and result

Original:
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

Generated TypeScript:
~~~typescript
export function base(p0: number): number {
    return (p0 + 3);
}

export function discount(p0: number, p1: number): number {
    const v0 = base(p0);
    if (p1 === 1) {
        if (p0 >= 10) {
            return (v0 + 2);
        } else {
            return (v0 + 2);
        }
    } else {
        return v0;
    }
}
~~~

Improved Python:
~~~python
def base(p0):
    return (p0 + 3)

def discount(p0, p1):
    v0 = base(p0)
    if p1 == 1:
        return (v0 + 2)
    else:
        return v0
~~~

## Actual lifecycle evidence

Apache Karaf 4.4.13 on Java 17 registered the independently packaged language bundles and an Understanding snapshot service. Registry assertions passed in this order: none, Python, none, TypeScript, none, Python. Exact service bundle identity appears in each encode and express trace. After stopping Python, the stored original semantic model was recalled by hash; after stopping TypeScript, its model and the optimized model were recalled. The reactivated Python service expressed the optimized persisted IR without original source as input. The model was then re-encoded by the Python service.

Each run produced 15 RT2_PASS markers. The command harness and Karaf logs retain service provisioning and stop/start evidence. Both test runs shut down cleanly.

The Understanding experimental service persists the complete serialized bridge result to a dedicated OSGi bundle data directory, not the existing Understanding journal. This demonstrates snapshot persistence across language-provider stop/start; it is not a full production knowledge-store implementation, nor evidence of recovery across restarting the same Understanding service or container. The fresh second run independently creates its own store.

## Behavioral and complexity results

All 202 cases matched the independent oracle for each original Python, generated TypeScript and improved Python (606 correct comparisons per run).

| Function | Metric | Original Python | TypeScript | Improved Python |
|---|---|---:|---:|---:|
| base | Cyclomatic | 1 | 1 | 1 |
| base | Campbell | 0 | 0 | 0 |
| base | MBCC | 0 | 0 | 0 |
| discount | Cyclomatic | 3 | 3 | 2 |
| discount | Campbell | 5 | 5 | 2 |
| discount | MBCC | 6 | 6 | 1 |

Complexity reduction for discount: 33.3%, 60%, 83.3%, respectively. No timing claim.

| Control | Detected differing cases |
|---|---:|
| Base arithmetic +3 changed to +4 | 202 |
| Membership predicate inverted | 202 |
| Membership premium +2 changed to +1 | 101 |

Unsupported opaque statement was rejected during the optimization validation. This is a targeted negative test, not comprehensive rejection coverage.

| Function | Original Python / TypeScript fingerprint | Improved Python fingerprint |
|---|---|---|
| base | ff1f89439ef6967f15034b25 | ff1f89439ef6967f15034b25 |
| discount | 767d9fd06e6439d4833b0cdd | ba1fcec209501ab1cb9b6ea4 |

Improved re-encoding matched the optimized model fingerprints by function. Exactly one identical-arm branch was removed.

## Reproduction and RT-1 preservation

Runs run-03 and run-04 used fresh Karaf data directories; run-01 and run-02 were startup failures before the experiment. The initial build also failed because jar.exe was not on PATH. These environment corrections are recorded in attempt-log.md, not retroactively hidden.

All 11 deterministic artifacts matched by SHA-256, including generated sources, four semantic models, three negative sources, transformation trace and result JSON. See reproduction.json. Both runs independently executed all cases and the actual service lifecycle. The original RT-1 report hash is unchanged (2B2275BC25C2BCEF372348341E6143F0EB67C513847A273E0C45DE0578F44371) and all 16 manifest-listed RT-1 artifacts matched.

## Remaining limitations

- Language services are independently provisioned bundles sharing a transitional Node worker; they are not independent native Java implementations. The renderer covers only the small supported IR fragment and does not constitute a general language emitter or complete validation of arbitrary programs.
- Semantic representation is still partial. Parameter names are synthesized, original function names carried in the bridge output; knowledge of the integer domain and oracle is externally declared.
- The store is a snapshot service, not integration with the durable assertion journal. The optimized document inherits source provenance from its input; the separate transformation trace is required to explain the derivation. It should not be interpreted as a newly parsed source record.
- The test stops and starts language providers, not fully uninstalls the bundles. It does not demonstrate restart recovery of Understanding or an entire Karaf process.
- Optimization is a programmed equal-arm rule, not an autonomous discovery. Framework/domain Lexicons were intentionally absent in this language-only trial.
- Full source-to-source behavior is proven only for this finite fixture and domain. No general cross-language equivalence, security, performance or production qualification is claimed.

## Network observation

The user noticed a Java network-access prompt during the test. Karaf's standard distribution boot configuration includes SSH and management features; its SSH configuration binds 0.0.0.0 on port 8101, and RMI management is configured for localhost. The recorded logs show the SSH feature being provisioned and the RMI hostname set to 127.0.0.1. The default Maven resolver also lists public repositories. No external download or outbound transmission was observed in the examined logs; the exact event that triggered the prompt was not captured. All experimental bundles were installed from local file URLs, and both runs ended. Future qualification should use a local-only configuration without unnecessary network services or remote dependency resolution.

## Evidence and reproduction

Root: C:\workspace\Intellectus-RT-2
- FROZEN-PROTOCOL.md, original.py
- java/ (service contracts and three implementation roles), linguistic.mjs, optimize.mjs, verify.mjs
- Run-RT2.ps1, build/features.xml, build/*.jar
- run-03 and run-04 (Karaf logs, persisted snapshot stores, sources, semantic models, results)
- attempt-log.md, reproduction.json

Commands used:
~~~powershell
& C:\workspace\Intellectus-RT-2\Run-RT2.ps1 -Run run-03 -SkipBuild
node C:\workspace\Intellectus-RT-2\verify.mjs run-03
& C:\workspace\Intellectus-RT-2\Run-RT2.ps1 -Run run-04 -SkipBuild
node C:\workspace\Intellectus-RT-2\verify.mjs run-04
~~~

Use a new run directory for any reproduction. Do not reuse these historical run paths.
