import { detect } from "./scanner";
import { create, inferBlueprint } from "./bootstrap";
import { harness } from "./harness";
import { createTransport } from "./transport";
import {
  loadConfig, saveConfig, defaultsFor, allTransports,
  detectAvailable, type SentinelConfig,
} from "./config";
import { bus } from "./bus";
import type { Org, Task, TransportType } from "./types";

const ARGS = process.argv.slice(2);
const ROOT = process.cwd();

async function main() {
  const cmd = ARGS[0];
  const cmdArgs = ARGS.slice(1);

  switch (cmd) {
    case "launch":
      await handleLaunch(cmdArgs);
      return;
    case "--bootstrap":
    case "-b":
      await handleBootstrap(cmdArgs.join(" "));
      return;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
  }

  // Default mode: load config and run
  await handleDefault(cmdArgs);
}

// ── LAUNCH COMMAND ─────────────────────────────────────────────

async function handleLaunch(args: string[]) {
  const { transport: explicitTransport, options } = parseLaunchArgs(args);

  let config: SentinelConfig | null = null;

  if (explicitTransport) {
    // sentinel launch claude — explicit choice
    const defaults = defaultsFor(explicitTransport);
    config = {
      transport: explicitTransport,
      model: options.model || defaults.model,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      updated: new Date().toISOString(),
    };
  } else {
    // sentinel launch — interactive picker
    const existing = await loadConfig();
    console.log(existing
      ? `Saved config: ${existing.transport} (${existing.model})\n`
      : "No saved configuration.\n");

    const transport = await pickTransport();
    if (!transport) {
      console.log("No transport selected. Exiting.");
      process.exit(0);
    }

    const defaults = defaultsFor(transport);
    console.log("");

    const model = await askWithDefault(`Model`, defaults.model);
    let apiKey: string | undefined;
    let baseUrl: string | undefined;

    if (transport === "bun") {
      const key = await askOptional("API key (leave empty to use ANTHROPIC_API_KEY env)");
      if (key) apiKey = key;
    }

    if (transport === "ollama") {
      const url = await askOptional(`Ollama URL (default: http://localhost:11434)`);
      baseUrl = url || undefined;
    }

    config = {
      transport,
      model,
      apiKey,
      baseUrl,
      updated: new Date().toISOString(),
    };
  }

  await saveConfig(config);

  console.log(`\nConfiguration saved:`);
  console.log(`  Transport: ${config.transport}`);
  console.log(`  Model:     ${config.model}`);
  if (config.apiKey) console.log(`  API Key:   [set]`);
  if (config.baseUrl) console.log(`  Base URL:  ${config.baseUrl}`);
  console.log();

  // Detect org and start
  const org = await detectOrBootstrap(config);
  const invoke = createInvoke(config);
  await enter(org, invoke, config);
}

function parseLaunchArgs(args: string[]): {
  transport: TransportType | null;
  options: { model?: string; apiKey?: string; baseUrl?: string };
} {
  const known = allTransports().map(t => t.key);
  let transport: TransportType | null = null;
  const options: { model?: string; apiKey?: string; baseUrl?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (known.includes(arg as TransportType)) {
      transport = arg as TransportType;
    } else if (arg === "--model" || arg === "-m") {
      options.model = args[++i];
    } else if (arg === "--api-key" || arg === "-k") {
      options.apiKey = args[++i];
    } else if (arg === "--base-url" || arg === "--url") {
      options.baseUrl = args[++i];
    }
  }

  return { transport, options };
}

async function pickTransport(): Promise<TransportType | null> {
  const all = allTransports();
  const available = await detectAvailable();

  console.log("Available transports:");
  for (let i = 0; i < all.length; i++) {
    const t = all[i];
    const present = available.includes(t.key);
    const marker = present ? " " : "✗";
    console.log(`  ${i + 1}. ${marker} ${t.label} — ${t.description}`);
  }
  console.log(`  0. Quit`);

  const choice = await ask(`Select transport [1-${all.length}]`);
  const idx = parseInt(choice);
  if (isNaN(idx) || idx === 0) return null;
  if (idx < 1 || idx > all.length) {
    console.log("Invalid selection.");
    return null;
  }
  return all[idx - 1].key;
}

// ── BOOTSTRAP COMMAND ──────────────────────────────────────────

async function handleBootstrap(args: string) {
  const config = await loadConfig();
  if (!config) {
    console.log("No configuration found. Run 'sentinel launch' first to configure a transport.");
    process.exit(1);
  }

  console.log(`Analyzing: "${args}"...`);
  const invoke = createInvoke(config);

  const blueprint = await inferBlueprint(args, invoke);
  console.log(`\nBlueprint for "${blueprint.name}":`);
  console.log(`  ${blueprint.description}\n`);
  for (const div of blueprint.divisions) {
    console.log(`  ${div.name}/ (${div.purpose})`);
    for (const agent of div.agents) {
      console.log(`    - ${agent.name}: ${agent.role}`);
    }
  }

  console.log(`\nBootstrapping ${blueprint.name} in ${ROOT}...`);
  await create(ROOT, blueprint);
  console.log("Done. Run 'sentinel' to start.\n");
}

// ── DEFAULT COMMAND ────────────────────────────────────────────

async function handleDefault(args: string[]) {
  let config = await loadConfig();

  if (!config) {
    console.log("No configuration found.\n");
    console.log("Run:  sentinel launch claude|pi|opencode|codex|openai|hermes|ollama|bun");
    console.log("  or: sentinel launch  (interactive picker)\n");
    process.exit(1);
  }

  const org = await detect(ROOT);
  if (!org) {
    console.log("No my-org structure detected.");
    console.log("Run: sentinel --bootstrap \"Describe what you're building\"");
    process.exit(1);
  }

  const invoke = createInvoke(config);
  const taskDesc = args.join(" ").trim();

  if (taskDesc) {
    await runTask(taskDesc, org, invoke, config);
  } else {
    await enter(org, invoke, config);
  }
}

// ── SHARED ─────────────────────────────────────────────────────

async function detectOrBootstrap(config: SentinelConfig): Promise<Org> {
  const org = await detect(ROOT);
  if (org) return org;

  console.log("No my-org structure found. Creating one...");
  const invoke = createInvoke(config);

  const description = await ask("Describe what you're building");
  const blueprint = await inferBlueprint(description, invoke);

  console.log(`\nBlueprint: ${blueprint.name} — ${blueprint.description}\n`);
  await create(ROOT, blueprint);

  const result = await detect(ROOT);
  if (!result) throw new Error("Bootstrap failed — could not detect created structure");
  return result;
}

function createInvoke(config: SentinelConfig) {
  const transport = createTransport(
    config.transport, config.apiKey, config.baseUrl, config.model
  );
  return transport.invoke.bind(transport);
}

async function enter(org: Org, invoke: (prompt: string) => Promise<string>, config: SentinelConfig) {
  bus.log("system", `Sentinel Harness loaded — ${org.divisions.length} divisions, ${org.personas.length} personas (transport: ${config.transport}, model: ${config.model})`);

  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  bus.subscribe("log", (msg) => {
    console.log(`  [${msg.from.replace("harness:", "")}] ${msg.content}`);
  });

  const prompt = () => new Promise<string>(resolve => rl.question("\n> ", resolve));

  console.log(`\nSentinel Harness — ${org.divisions.length} divisions, ${org.personas.length} personas active`);
  console.log(`Transport: ${config.transport} | Model: ${config.model}`);
  console.log("Type your task or 'help' for commands.\n");

  while (true) {
    const input = (await prompt()).trim();
    if (!input) continue;
    if (input === "quit" || input === "exit" || input === "q") break;
    if (input === "help" || input === "?") {
      console.log("\nCommands:");
      console.log("  <task>              Execute a task through the harness");
      console.log("  personas             List all loaded personas");
      console.log("  divisions            List all divisions");
      console.log("  config               Show current session configuration");
      console.log("  help                 Show this help");
      console.log("  quit                 Exit");
      continue;
    }
    if (input === "personas") {
      for (const p of org.personas) console.log(`  ${p.name} [${p.division}]`);
      continue;
    }
    if (input === "divisions") {
      for (const d of org.divisions) {
        const count = org.personas.filter(p => p.division === d).length;
        console.log(`  ${d}/ (${count} agents)`);
      }
      continue;
    }
    if (input === "config") {
      console.log(`\n  Transport: ${config.transport}`);
      console.log(`  Model:     ${config.model}`);
      if (config.apiKey) console.log("  API Key:   [set]");
      if (config.baseUrl) console.log(`  Base URL:  ${config.baseUrl}`);
      console.log(`  Config:    ~/.sentinel/config.json`);
      continue;
    }

    await runTask(input, org, invoke, config);
  }

  rl.close();
  process.exit(0);
}

async function runTask(description: string, org: Org, invoke: (prompt: string) => Promise<string>, config: SentinelConfig) {
  console.log(`\n  ▶ ${description}\n`);

  const division = routeToDivision(description, org);
  const task: Task = {
    id: generateId(),
    description,
    division,
    complexity: "composite",
    status: "pending",
  };

  try {
    const result = await harness(task, org, invoke);
    console.log(`\n━━━ Result ━━━`);
    console.log(formatResult(result.content));
  } catch (err) {
    console.error(`\n  Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function ask(q: string): Promise<string> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(`${q}: `, (a: string) => { rl.close(); resolve(a.trim()); }));
}

async function askOptional(q: string): Promise<string> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(`${q}: `, (a: string) => { rl.close(); resolve(a.trim()); }));
}

async function askWithDefault(q: string, def: string): Promise<string> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(`${q} [${def}]: `, (a: string) => { rl.close(); resolve(a.trim() || def); }));
}

function printHelp() {
  console.log(`
SENTINEL HARNESS — my-org bootstrap + recursive agent orchestration

USAGE:
  sentinel launch [transport] [--model <model>] [--api-key <key>]
    Configure and launch the harness with a specific transport.
    Omit transport for interactive picker.

    sentinel launch claude
    sentinel launch pi --model openai/gpt-4o
    sentinel launch ollama --model mistral
    sentinel launch bun --api-key sk-ant-...
    sentinel launch                    ← interactive picker

  sentinel [--bootstrap "description"] ["task"]
    Run the harness in a my-org workspace. Bootstraps if needed.

    sentinel --bootstrap "AI-powered legal research firm"
    sentinel "Research AI adoption in financial services"

AVAILABLE TRANSPORTS:
  claude    Claude Code (Anthropic CLI)
  pi        Pi coding agent
  opencode  OpenCode CLI
  codex     OpenAI Codex (codex CLI)
  openai    OpenAI CLI (openai CLI)
  copilot   GitHub Copilot CLI
  hermes    Hermes AI agent
  ollama    Ollama local models (http://localhost:11434)
  bun       Direct API (Anthropic/OpenAI via fetch)
`);
}

function routeToDivision(description: string, org: Org): Task["division"] {
  const desc = description.toLowerCase();
  for (const [pattern, { division }] of org.routingTable) {
    if (desc.includes(pattern)) return division;
  }
  return "intelligence";
}

function formatResult(text: string): string {
  return text.split("\n").map(l => `  ${l}`).join("\n");
}

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

main().catch(err => {
  console.error("Harness error:", err.message);
  process.exit(1);
});
