# Projects and modules

The following is a map of responsibilities, not a claim that all named capabilities are implemented.

| Component | Responsibility | Evidence status |
|---|---|---|
| Intellectus runtime | Karaf/OSGi service discovery, lifecycle, investigation coordination | Restricted lifecycle proof; coordinator proposed |
| Understanding | Authoritative retained semantic knowledge and evidence | Existing journal and IR; semantic redesign proposed |
| LinguisticPython / LinguisticTypeScript | Interpret and express language-specific representations | Restricted round-trip proof |
| LinguisticJavaScript / LinguisticJava | Language-specific interpretation and expression | Named conventions; scope to verify |
| Lexicon modules | Versioned framework and domain knowledge | Proposed expansion |
| Witness | Observation and instrumentation | Existing component; integration to qualify |
| DeepTest | Independent behavioral evaluation | Existing component; headless integration to qualify |
| Complexity | Measure structural complexity | Used in RT-1–4 |
| Colibri | Model inference boundary | Interface inventoried; serving qualification pending |
| Specialist SLMs and LoRA adapters | Independent semantic hypotheses and domain analysis | Development and qualification proposed |

## Modularity
Providers may activate and deactivate without destroying retained knowledge. Version modules independently, document dependencies and distinguish a framework lexicon from a language adapter. Follow the [developer guide](developer-guide.md).
