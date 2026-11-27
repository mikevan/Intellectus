# Documentation and research standard

## Information architecture
Organize the site around Projects, Get Started, Documentation, Research, Downloads and Community. Manuals use explicit versions; examples separate intended behavior from results. Use accessible navigation and consistent Intellectus navy/blue styling. Canonical source documents live in ArchitectureRepository; a generated static site is a publication view.

## Test and research workflow

Do not create Git branches for tests or research experiments. Work on main and keep each research experiment in a dedicated directory within the research area.

## Required records
| Record | Required fields |
|---|---|
| Architecture | Context, boundaries, interfaces, ADRs, dependencies |
| Experiment | Question, hypotheses, protocol, oracle, controls, falsifiers, results |
| Evidence | Run ID, environment, source revision, raw artifact hashes, scope |
| Metric | Definition, unit, sampling, baseline, repetitions, limitations |
| Model/dataset | Version, provenance, license, training/evaluation separation |
| Release | Version, build, test results, checksums, notices, approval |

## Writing rules
Use plain language and concrete examples. Define unfamiliar technical terms. Distinguish a proposed capability from an observation and a verified conclusion. Never retroactively edit a frozen report to match a later hypothesis. Keep internal research evidence private until approved for publication. Publish negative findings as carefully as successful ones.

## Visual style
Use the Project Revive Solutions (PRS) visual identity: near-black and charcoal surfaces, gold and vivid green accents, angular layered geometry, high-contrast text, and the official Intellectus semantic modelling emblem. Maintain Intellectus as the independent project name. Brand tokens, layout, components and chart styling live in separate CSS files under the theme directory; charts inherit semantic color roles. Use only project-owned branding; no third-party logos or affiliation claims.
