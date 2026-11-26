# Phase I specialist port integration

24 component tests passed, including the actual Python and TypeScript structural encoders from the existing Intellectus bridge. Their results are explicitly partial structural evidence. The real committee accepts these alongside behavioral observations.

Colibri port uses its documented OpenAI-compatible chat completion contract, an explicitly configured model, loopback HTTP only, structured hypotheses, completion and timeout budgets, refusal of redirects, and token/time telemetry. HTTP transport tests use simulated responses; no live model inference was completed. The loopback models endpoint did not respond within two seconds in the review environment. No weights were downloaded and no external API was invoked. The configured live runner writes a new result file, records both inference attempts, and fails if either AI role does not return a valid hypothesis. It is a benign fixture smoke test, not RT-5; no domain Lexicon or full deliberation is qualified.

Run installation first, then start an existing local Colibri server with the intended model. Discover its actual model ID via GET http://127.0.0.1:8000/v1/models. Run live-committee.mjs with the monorepo path, that model ID, and a fresh result file. API key if configured is read from COLI_API_KEY and not recorded. Keep the result for review.
