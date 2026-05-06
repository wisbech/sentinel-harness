<p align="center">
  <img src="https://raw.githubusercontent.com/wisbech/sentinel-harness/main/docs/logo.svg" alt="Sentinel Harness" width="128" />
</p>

<h1 align="center">Sentinel Harness</h1>

<p align="center">
  <strong>My-org bootstrap + recursive agent orchestration — tool-agnostic, SOLID, simple.</strong><br />
  Detect or create my-org company structures, then drive them with recursive task decomposition.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#transports">Transports</a> ·
  <a href="#api">API</a>
</p>

---

## What Is This?

A **recursive work decomposition engine** powered by LLMs. Drop it into any directory — if a [my-org](https://github.com/wisbech/my-org) structure exists, it loads the personas and routes tasks to the right agents. If nothing exists, it infers what you're building from your description and bootstraps a complete my-org company scaffold.

One tool. Singleton bootstrap. No separate scaffolding step.

```bash
$ sentinel --bootstrap "OSINT-powered advisory consultancy for enterprise tech strategy"
Analyzing: "OSINT-powered advisory consultancy for enterprise tech strategy"...

Blueprint for "Sentinel Research Group":
  OSINT-powered advisory consultancy helping organizations navigate exponential technological change.

  strategy/ (Boardroom, client strategy, market intelligence)
    - CEO: Vision, direction, final strategic calls
    - CTO: Technology strategy, radar interpretation
    - CIO: Information strategy, OSINT methodology governance
    - Strategist: GTM frameworks, client strategy models

  intelligence/ (OSINT research room with source-audit protocol)
    - Intel Analyst: Lead OSINT researcher, source discovery
    - Data Analyst: Financial and statistical analysis
    - Tech Scout: Emerging technology identification
    - Source Validator: Claims verification, confidence scoring

  engineering/ (Platform, tooling, data pipelines)
    - Platform Engineer: Devbox, infrastructure, internal tools
    - Data Engineer: Data pipelines, ingestion, APIs

  commercial/ (Publications, brand, media, client delivery)
    - Editor-in-Chief: Editorial strategy, quality control
    - Content Strategist: Writing, narrative structure
    - Media Director: Multimedia production, visual identity
    - Client Partner: Client relationships, engagement delivery

Bootstrapping Sentinel Research Group in /Users/alice/sentinel-research-group...
Done. Run 'sentinel' to start.
```

Then run tasks through the harness:

```bash
$ cd sentinel-research-group/
$ sentinel

Sentinel Harness — 4 divisions, 15 personas active
Type your task or 'help' for commands, 'quit' to exit.

> Research enterprise AI adoption rates in financial services

  [task-001] Decomposing task...
  [task-001] 3 sub-tasks created: Research tasks decompose into landscape scan, metrics, and verification
  [task-001-a1] Spawning agent: Intel Analyst
  [task-001-a2] Spawning agent: Data Analyst
  [task-001-a3] Spawning agent: Source Validator
  [task-001] Synthesizing results...

━━━ Result ━━━
  Enterprise AI adoption in financial services reached 52% in Q1 2026,
  up from 34% a year ago. Use cases cluster around fraud detection (78%),
  risk modeling (64%), and customer service automation (53%)...
```

---

## Quick Start

```bash
# Install globally
npm install -g sentinel-harness

# Configure your transport (interactive picker)
sentinel launch

# Or configure directly
sentinel launch claude --model claude-sonnet-4-20250514
sentinel launch pi --model anthropic/claude-sonnet-4-20250514
sentinel launch ollama --model llama3.1

# Bootstrap a new company structure
sentinel --bootstrap "Describe what you're building"

# Run in an existing my-org workspace
cd /path/to/my-org-workspace
sentinel

# Or run a single task non-interactively
sentinel "Research AI adoption in financial services"
```

```bash
# Alternative: Run directly from source
git clone https://github.com/wisbech/sentinel-harness.git
cd sentinel-harness
bun install
./bin/sentinel launch
```

**Requirements:**
- [Bun](https://bun.sh) >= 1.0.0 (runtime)
- At least one of: `claude`, `pi`, `opencode`, `codex`, `openai`, `copilot`, `hermes` — or Ollama or an Anthropic/OpenAI API key as fallback

---

## How It Works

### The Recursive Engine

```
harness(task, org)
  │
  ├─ analyze: can an agent execute this directly?
  │     ├─ YES → spawnAgent(persona, task) → return result
  │     └─ NO  → decompose(task) → sub-tasks
  │                ├─ sub-1 → harness(sub-1)    ← RECURSE
  │                ├─ sub-2 → harness(sub-2)    ← RECURSE
  │                └─ sub-3 → harness(sub-3)    ← RECURSE
  │
  └─ synthesize(all results) → deliver to parent or user
```

The recursion depth is determined at runtime based on task complexity. Simple tasks hit an agent directly. Complex tasks decompose into sub-tasks, each of which may decompose further, down to leaf nodes handled by persona-driven agents.

### Singleton Bootstrap Contract

| State | Behavior |
|-------|----------|
| Empty dir | Detects no my-org → infers blueprint from your description → bootstraps → runs |
| Bootstrapped dir | Detects CLAUDE.md + AGENTS.md + divisions → loads personas → runs |
| Partial dir | Detects fragments → warns → requires `--bootstrap` to complete |
| `--rebuild` | Tears down and reboots from new inference |

### Hybrid Decomposition

1. **Rule cache** — Pre-defined patterns for common workflows (research, publishing, strategy)
2. **LLM decomposition** — For novel tasks, asks an LLM to generate sub-tasks from available personas
3. **Fallback** — Routes to division default if all else fails

Patterns are cached so repeated tasks run instantly.

---

## Architecture

```
sentinel-harness/
├── bin/
│   └── sentinel              # CLI launcher
├── src/
│   ├── index.ts              # CLI entry — args, interactive loop, routing
│   ├── harness.ts            # Recursive orchestrator — the core (75 lines)
│   ├── scanner.ts            # Detects and loads my-org from filesystem
│   ├── bootstrap.ts          # Infers blueprint → creates full my-org scaffold
│   ├── transport.ts          # Tool-agnostic: pi / claude / opencode / copilot / bun
│   ├── decomposer.ts         # Hybrid: rule cache → LLM → fallback
│   ├── spawner.ts            # Persona → agent invocation with system prompt
│   ├── bus.ts                # Pub/sub message bus for agent↔agent comms
│   ├── synthesizer.ts        # Sub-task results → unified output
│   └── types.ts              # SOLID type contracts (no circular deps)
├── docs/
│   ├── architecture.md       # Detailed architecture guide
│   └── personas.md           # Persona authoring guide
├── tests/
│   └── harness.test.ts       # Core harness tests
├── package.json
├── LICENSE
└── README.md
```

**1,118 lines of TypeScript across 12 source files.** Zero framework dependencies. Just `typebox` for schema validation and `yaml` for parsing (optional).

### Component Responsibility

| Component | Lines | Responsibility |
|-----------|-------|---------------|
| `types.ts` | 82 | Type contracts — Org, Task, Persona, AgentResult, Transport |
| `scanner.ts` | 135 | Filesystem → detect my-org pattern, parse personas, routing table |
| `bootstrap.ts` | 242 | LLM inference → my-org scaffold generation with full agent personas |
| `transport.ts` | 143 | Auto-detect available CLI, provide unified `invoke(prompt)` interface |
| `decomposer.ts` | 128 | Rule cache + LLM fallback for task → sub-task breakdown |
| `spawner.ts` | 51 | Persona → system prompt → agent invocation |
| `bus.ts` | 55 | Typed pub/sub for inter-agent queries and signals |
| `synthesizer.ts` | 33 | Merge sub-task results into unified deliverable |
| `harness.ts` | 75 | Recursive orchestrator tying everything together |
| `index.ts` | 174 | CLI, arg parsing, interactive loop |

---

## Transports

The harness auto-detects which LLM interface is available and uses it. No lock-in.

| Priority | Transport | Invocation |
|----------|-----------|------------|
| 1 | `pi` | `pi --print --model anthropic/claude-sonnet-4-20250514` |
| 2 | `claude` | `claude --print --model claude-sonnet-4-20250514` |
| 3 | `opencode` | `opencode` with combined system + user prompt |
| 4 | `copilot` | `github-copilot-cli` direct stdin |
| 5 | `bun` (fallback) | Direct Anthropic API via `fetch()` — zero extra deps |

```bash
# Explicit transport override
sentinel --transport pi "Research topic..."
sentinel --transport claude "Write article about..."

# API key (for bun fallback)
sentinel --api-key sk-ant-... "Task..."
# or
export ANTHROPIC_API_KEY=sk-ant-...
sentinel "Task..."
```

---

## Writing Personas

Persona files live in `{division}/agents/`. The harness parses `## Identity`, `## Mission`, and `## Boundaries` sections and uses them to build agent system prompts at runtime.

```markdown
# Intel Analyst — Lead OSINT Researcher

**Division:** Intelligence
**Voice:** Rachel (Calm supportive)
**Traits:** research, analytical, thorough

## Identity
You are the lead OSINT researcher. You discover, collect, and synthesize
intelligence from open sources.

## Mission
Transform research questions into verified, sourced, structured intelligence.

## Boundaries
- You conduct research but don't publish content — that's commercial/
- You discover sources but defer formal verification to Source Validator
```

See [docs/personas.md](docs/personas.md) for the full guide.

---

## Programmatic API

```typescript
import { detect } from "sentinel-harness/src/scanner";
import { harness } from "sentinel-harness/src/harness";
import { createTransport, detectTransport } from "sentinel-harness/src/transport";

const org = await detect("/path/to/my-org-workspace");
const transport = createTransport(detectTransport());

const task = {
  id: "task-001",
  description: "Research enterprise AI adoption",
  division: "intelligence",
  complexity: "composite" as const,
  status: "pending" as const,
};

const result = await harness(task, org, transport.invoke);
console.log(result.content);
```

---

## Running Tests

```bash
bun install
bun test
```

---

## Philosophy

- **SOLID.** Single-responsibility modules with clear contracts. No circular dependencies.
- **Recursion over configuration.** The decomposition depth is runtime behavior, not a config file.
- **Tool-agnostic.** pi, Claude Code, OpenCode, Copilot, or raw API — the harness doesn't care.
- **Singleton bootstrap. ** One tool creates the org and runs it. No separate scaffolding step.
- **Simple.** 1,118 lines total. Read it in an afternoon. Modify it freely.

---

## Related

- [my-org](https://github.com/wisbech/my-org) — The AI-native company structure pattern this harness operates on
- [pi-mono](https://github.com/badlogic/pi-mono) — The agent toolkit that inspired the transport abstraction
- [Shadowbroker](https://github.com/BigBodyCobain/Shadowbroker) — Real-time OSINT platform that inspired the intelligence division pattern

---

## License

MIT
