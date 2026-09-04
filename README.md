# lazy-senior-dev.github.io

**Live site:** https://lazy-senior-dev.github.io/

The front door for [lazy-senior-dev](https://github.com/lazy-senior-dev): persona plugins that make an AI coding agent behave like a specific senior engineer with a specific job. A character changes how an agent behaves more than a list of rules does; this org builds a cast of them, one persona per repository, each benchmarked on the number that engineer cares about.

This repository is the org site at [lazy-senior-dev.github.io](https://lazy-senior-dev.github.io/): one hand-written HTML page that renders `personas.json`. Adding a persona is one entry in that file. Shared styles live in `assets/site.css` and are copied into each persona's project site so they look like one family.

## The cast

| Persona | Status | One line | Measured on | Install |
|---|---|---|---|---|
| [grumpy-reviewer](https://github.com/lazy-senior-dev/grumpy-reviewer) | live | The staff engineer who reviews every write before it reaches your branch. *Show me where it breaks.* | defects caught before commit | `/plugin marketplace add lazy-senior-dev/grumpy-reviewer` then `/plugin install grumpy-reviewer@lazy-senior-dev` |
$1`/plugin marketplace add lazy-senior-dev/paranoid-sre` then `/plugin install paranoid-sre@lazy-senior-dev` |
$1`/plugin marketplace add lazy-senior-dev/tenured` then `/plugin install tenured@lazy-senior-dev` |

Everything here is Apache-2.0; keep the NOTICE file when you redistribute. Built and maintained by [Sandeep Bazar](https://www.linkedin.com/in/sandeepbazar/). The same table is meant to be copied into the org profile README when that repository is created.
