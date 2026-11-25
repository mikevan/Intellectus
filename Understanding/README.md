# Understanding

Michael Van Geertruy, with Claude. Project Revive Solutions, LLC.

A database that does not store meaning. It stores evidence about persistent concepts, from which meaning can be reconstructed. The design is `docs/founding-design.md` (draft 4, frozen), and that document is this repository's first declared intent.

Rules from day one:

- Understanding receives no privileged encoder path. Its own TypeScript goes through the same TypeScript adapter as any other project. No hand-authored graph, no internal shortcuts, no bootstrap metadata other users do not get.
- Only what the design requires a person to declare is seeded: authority scopes and initial intent. Everything structural comes from the encoder.
- `understanding/` holds this repository's own semantic record, encoded by itself, from the first day the adapter can represent enough of the repository to try.

The toolkit (KeepSafe, DeepTest, UntangleIt, CommentIt) is the first consumer of this repository, not its parent.
