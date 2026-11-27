# Research direction — November 26, 2026

Owner decisions: open research publication; preserve experimental failures and raw evidence; ontology is a representation of semantic knowledge, not necessarily the only representation; avoid agreement for its own sake. Build an expansive backend first, qualify it, measure component contributions through ablation, consolidate, then productize. VS Code packaging does not constrain the research architecture. Existing plans remain historical; this decision takes precedence over their sequencing where they differ. No cloud purchase or RT-5 run has occurred.

The canonical documentation is ArchitectureRepository/ in the Intellectus monorepo, with a direct link from MikeVan's profile README. Canonical local hierarchy: C:\workspace-Intellectus\ArchitectureRepository. The former Intellectus-Cognition directory is temporary staging only. Cognition is reserved as a candidate software library name.

## Application flow and contextual explanation

Extract explicit application flows deterministically from the control constructs used by MBCC. Record the decisions evaluated on each path and the function-level MBCC score as separate measures. Verify paths and outcomes before passing them to Colibri.

Give Colibri the established flows, function or method names, and available parameter, attribute, and value evidence one packet at a time. Retain the conversation across packets. Request a contextual explanation only after the final packet.

The first fixture is the existing Python Hello World hello function. It exercises two explicit paths and an omitted-argument control. See the [pilot protocol](../research/Application-Flow/Protocol.md). Standalone P4 schema trials are paused. Their results remain part of the research record.
