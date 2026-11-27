# Semantic-first development

A proposed future workflow could begin with independently declared obligations rather than existing source. A developer-authored semantic view could express: purpose, entities, flows, events, conditions, state transitions, rules, effects, exceptions and accepted outcomes.

[One ontology, multiple implementation targets](semantic-first.svg)

For an inventory system, a developer defines reservation, release and fulfillment behavior once. Applications can then be expressed for different users and environments.

| Target language | Illustrative environment |
|---|---|
| Python | Analytics and forecasting |
| TypeScript | Browser or web service |
| Java | Enterprise systems and integrations |
| C# | Microsoft-oriented environments |
| Rust | Resource-constrained or high-performance systems |

Target languages and integrations are examples, not a supported-language promise. Developers set target-specific requirements such as persistence, accessibility, performance or deployment environment. Maintain shared business obligations; explicitly version any change in meaning. Reverify every generated implementation.
