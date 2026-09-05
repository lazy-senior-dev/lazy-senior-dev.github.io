#!/usr/bin/env node
// Build SIGNS.md: what coding agents actually get wrong, from the author-tier benchmark records in
// the three persona repositories. Every count and every code sample comes from a captured run, so
// the page cannot drift from the evidence. Prose for each sign lives in SIGNS_NOTES.json next to
// this script; the numbers never do.
//   node scripts/build-signs.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const REPOS = ["grumpy-reviewer", "paranoid-sre", "tenured"];
const NOTES = JSON.parse(readFileSync(join(HERE, "SIGNS_NOTES.json"), "utf8"));
const LABEL = { claude: "Claude Code", codex: "Codex CLI", agy: "Antigravity CLI", bob: "IBM Bob Shell" };

const signs = new Map();
let totalRuns = 0;

for (const repo of REPOS) {
  const dir = join(ROOT, repo, "benchmarks", "results", "author", "raw");
  if (!existsSync(dir)) continue;
  const persona = JSON.parse(readFileSync(join(ROOT, repo, "persona.json"), "utf8"));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
    // One record per task, arm and run: a rerun appends rather than replacing, and counting the
    // older rows too would inflate both the totals and every sign's frequency.
    const byKey = new Map();
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let rec;
      try { rec = JSON.parse(line); } catch { continue; }
      byKey.set(`${rec.task}|${rec.arm}|${rec.run}`, rec);
    }
    for (const r of byKey.values()) {
      if (r.error) continue;
      totalRuns++;
      if (!r.shipped) continue;
      const key = `${repo}/${r.task}`;
      const s = signs.get(key) || { key, repo, task: r.task, persona, defect: r.defect, hits: 0, agents: new Set(), arms: new Set(), sample: null };
      s.hits++;
      s.agents.add(r.agent);
      s.arms.add(r.arm);
      // Keep the shortest added-lines sample: the clearest illustration, not the longest.
      const added = (r.diff || "").split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
      if (added.length && (!s.sample || added.length < s.sample.lines.length)) s.sample = { lines: added.slice(0, 12), agent: r.agent, arm: r.arm };
      signs.set(key, s);
    }
  }
}

const ordered = [...signs.values()].sort((a, b) => b.hits - a.hits);
const shipped = ordered.reduce((n, s) => n + s.hits, 0);
const agentsSeen = [...new Set(ordered.flatMap((s) => [...s.agents]))].map((a) => LABEL[a] || a).sort();
const today = new Date().toISOString().slice(0, 10);

let md = `# What coding agents actually get wrong

An open catalogue of the mistakes AI coding agents make **when they write the code themselves**, with
a captured example of each.

Every entry here was produced by an agent during a benchmark run in one of the sibling repositories,
not written from memory or imagined for illustration. The counts, the agents, and the code samples
are read straight from the stored transcripts, so this page cannot drift away from its evidence. As
of ${today} it covers **${ordered.length} recurring mistakes** seen **${shipped} times** across
**${totalRuns} recorded runs** on ${agentsSeen.join(", ")}.

This is deliberately modelled on the community catalogues that document the tells of AI-written
prose. The difference is that these entries are measured rather than observed: each one names how
often it happened, on which agents, and under which conditions.

## How to read an entry

**Seen** is the number of recorded runs in which an agent shipped this mistake. **Arms** says
whether it happened with no guardrail, with a generic "be careful" prompt, or with a persona
installed; a mistake that only appears in the bare arm is one a reviewer reliably prevents.
**Caught by** names which of the three reviewers has a rule for it.

`;

for (const s of ordered) {
  const note = NOTES[s.task] || {};
  const armNames = { bare: "no guardrail", generic: "generic prompt", grump: "persona loaded", gate: "persona gate" };
  md += `## ${note.title || s.task}

**Seen** ${s.hits} time${s.hits === 1 ? "" : "s"} · **Agents** ${[...s.agents].map((a) => LABEL[a] || a).join(", ")} · **Arms** ${[...s.arms].map((a) => armNames[a] || a).join(", ")} · **Caught by** [${s.persona.name}](https://github.com/lazy-senior-dev/${s.repo})

${note.what || s.defect}

`;
  if (s.sample) {
    md += `What an agent actually wrote, from the \`${s.task}\` task on ${LABEL[s.sample.agent] || s.sample.agent}:

\`\`\`${note.lang || ""}
${s.sample.lines.join("\n")}
\`\`\`

`;
  }
  if (note.why) md += `**Why an agent does this.** ${note.why}\n\n`;
  if (note.instead) md += `**What to do instead.** ${note.instead}\n\n`;
  if (note.refs?.length) md += `**Standards** ${note.refs.map((r) => (typeof r === "string" ? r : `[${r.t}](${r.u})`)).join(" · ")}\n\n`;
}

md += `## Adding to this catalogue

A sign belongs here when an agent can be recorded producing it, not when it sounds plausible. To add
one, open a task in the relevant repository's \`benchmarks/author/tasks/\` with a ticket, a scaffold,
and a check that decides mechanically whether the mistake is present, then run the benchmark. If an
agent ships it, the entry appears here on the next build with its own count and captured sample.

Prose for an entry lives in \`scripts/SIGNS_NOTES.json\`. Numbers, agents, and code samples are read
from the recorded runs and cannot be edited by hand.

Rebuild with \`node scripts/build-signs.mjs\`.
`;

writeFileSync(join(HERE, "..", "SIGNS.md"), md);
console.log(`SIGNS.md: ${ordered.length} signs, ${shipped} instances, ${totalRuns} runs`);
