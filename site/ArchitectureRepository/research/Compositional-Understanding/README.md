# Compositional understanding

The next phase asks whether Intellectus can verify what cooperating activities accomplish together and reuse that knowledge across implementations. KeepSafe and MVS provide existing workflows with persistent state, observable outcomes, and enough differences to test the limits of conceptual equivalence. Initial discovery takes place independently for each subject. Subject descriptions and declared requirements enter only in a controlled later condition.

## Source inventory

| Subject | Pinned checkout | Entry point and scope |
| --- | --- | --- |
| KeepSafe 0.1.0 | Intellectus `414fd785fb18f42c188c2ff90ccf8c3015b35263`. Most recent commit touching the directory is `c7c07f59d8bc517b2c41c6757a60104f409e63b8`, attributed to mikevan. Working tree clean for this subtree. | `keepsafe` and `ks` resolve to `keepsafe.cli:main`. The module entry point also imports it. The CLI imports `checkpointing.py`. The separate `core.py` needs a runtime reachability check scoped to each workflow. The CLI includes creation, listing, comparison, restoration, metadata rebuild and ignore configuration. Python 3.10 or later. |
| MVS 0.4.0 | Separate repository at `C:/workspace/MVS/mvs` with origin `mikevan/mvs`. Clean checkout `176e4d345bd20031abffa42477fc2c8852464547`. The two local commits are attributed to VS Code User and package metadata lists Michael Van Geertruy. | `mvs.cli:main` imports `core.py`, which imports `model.py` and `errors.py`. The CLI includes initialization, checkpoint creation, listing, comparison, status, verification and restoration. Python 3.11 or later and `pathspec>=0.12.1`. |

The Git histories establish distinct source locations and recorded attribution. The local evidence leaves shared development lineage, reuse and independent authorship unresolved. CU-1 treats the applications as separate observational subjects. Later comparisons must test equivalence at the level of individual claims and document lineage uncertainty.

## Specialist architecture

| Execution group | Roles |
| --- | --- |
| Deterministic | Structural maps reachable source and runtime paths using AST, call graphs and MBCC where applicable. Behavioral captures reproducible state and outcomes using instrumentation and, where applicable, Witness and DeepTest. Mathematical checks exact or formal relationships. |
| Hybrid | Causal proposes and tests dependencies through controlled interventions. Skeptic proposes counterexamples and checks them against independent evidence. |
| Colibri | Conceptual proposes abstractions spanning activities. Domain interprets independently supplied context in CU-6. |

```mermaid
flowchart LR
    Source[Source and synthetic workflows] --> D[Deterministic specialists]
    D --> H[Hybrid specialists]
    D --> C[Colibri specialists]
    H <--> C
    H --> V[Independent verification]
    C --> V
    V --> U[Understanding]
```

Understanding retains qualified knowledge with provenance, scope, contradictions and revision history. Specialist assignments are hypotheses to evaluate by ablation. A future comparison may test purpose-trained small language models for conceptual and domain interpretation.

## Curriculum

| Stage | Question |
| --- | --- |
| [CU-1 protocol](CU-1-Protocol.md) and [findings](CU-1-Run-01/Findings.md) | Can independent evidence establish relationships spanning activities in each application? |
| CU-2 | Do the relationships support a capability that predicts complete workflows under independently defined obligations? |
| CU-3 | Which capabilities converge across applications and under which conditions? |
| CU-4 | Which similar activities serve materially different capabilities or obligations? |
| CU-5 | Does frozen knowledge transfer increase coverage or accuracy or reduce cost versus unaided, deterministic, targeted-AI and full-AI investigations? Reverse direction where practical. |
| CU-6 | What verifiable knowledge does independently supplied context add about purpose? |

Freeze each protocol before execution. Advance on evidence. Potential later subjects are Delos for subsystem coordination, CARES for accounting obligations, MasterScrum.net for organizational processes, and historical financial records for temporal reasoning.

## Hello World closeout

[Qualification 01](../Application-Flow/Qualification-01/) retains its failed qualification and exploratory probe selection and evidence-driven correction. [Transfer 01](../Application-Flow/Qualification-01/Transfer-01/) verified bounded predictions for the original implementations. Its TypeScript comparison used a project port with unconfirmed independent authorship. The outstanding comparison requires an existing implementation with documented independent lineage, or a separately authored implementation based on a neutral interface brief without access to either prior implementation or the frozen hypothesis. Use the existing frozen hypothesis and probes and report any obligations the candidate does not share. Close after one qualifying comparator. Keep all historical acceptance criteria and records intact.

Preparation evidence includes the [isolated runtime and baseline qualification](Environment-Qualification.md). The [evaluator preparation](Evaluator-Preparation.md) is for investigators and stays outside discovery packets. Runtime results, raw captures, comparative charts, failed hypotheses and architectural decisions belong in dated run records as evidence becomes available.


