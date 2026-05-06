import { detect } from "./scanner";
import { create, inferBlueprint } from "./bootstrap";
import { harness } from "./harness";
import { detectTransport, createTransport } from "./transport";
import { bus } from "./bus";
import type { Org, Task } from "./types";

const ARGS = process.argv.slice(2);
const ROOT = process.cwd();

let apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";

async function main() {
  const args = parseArgs();
  const transportType = detectTransport();

  if (args.forceBootstrap) {
    await bootstrapCommand(args.forceBootstrap);
    return;
  }

  const org = await detect(ROOT);

  if (!org) {
    console.log("No my-org structure detected.");
    console.log("Run: sentinel --bootstrap \"Describe your organization here\"");
    console.log("Or: sentinel \"Your task\" (will trigger interactive bootstrap)");
    process.exit(1);
  }

  const transport = createTransport(transportType, apiKey);
  const invoke = transport.invoke.bind(transport);

  bus.log("system", `Sentinel Harness loaded — ${org.personas.length} personas across ${org.divisions.length} divisions (transport: ${transportType})`);

  if (args.task) {
    await runTask(args.task, org, invoke);
  } else {
    await interactiveLoop(org, invoke);
  }
}

function parseArgs(): { task?: string; forceBootstrap?: string; rebuild?: boolean } {
  const result: ReturnType<typeof parseArgs> = {};

  for (let i = 0; i < ARGS.length; i++) {
    const arg = ARGS[i];
    if (arg === "--bootstrap" || arg === "-b") {
      result.forceBootstrap = ARGS[i + 1] || "A company using AI agents for knowledge work";
      i++;
    } else if (arg === "--rebuild" || arg === "--reset") {
      result.rebuild = true;
    } else if (arg === "--api-key" || arg === "-k") {
      apiKey = ARGS[i + 1] || apiKey;
      i++;
    } else if (!arg.startsWith("--")) {
      result.task = result.task ? `${result.task} ${arg}` : arg;
    }
  }

  return result;
}

async function bootstrapCommand(description: string) {
  const transport = createTransport(detectTransport(), apiKey);
  console.log(`Analyzing: "${description}"...`);

  const blueprint = await inferBlueprint(description, transport.invoke.bind(transport));
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

async function runTask(description: string, org: Org, invoke: (prompt: string) => Promise<string>) {
  console.log(`\n  ▶ ${description}\n`);

  const division = routeToDivision(description, org);
  const task: Task = {
    id: generateId(),
    description,
    division,
    complexity: "composite",
    status: "pending",
  };

  bus.subscribe("log", (msg) => {
    console.log(`  [${msg.from.replace("harness:", "")}] ${msg.content}`);
  });

  try {
    const result = await harness(task, org, invoke);
    console.log(`\n━━━ Result ━━━`);
    console.log(formatResult(result.content));
  } catch (err) {
    console.error(`\n  Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function interactiveLoop(org: Org, invoke: (prompt: string) => Promise<string>) {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  bus.subscribe("log", (msg) => {
    console.log(`  [${msg.from.replace("harness:", "")}] ${msg.content}`);
  });

  const prompt = () => new Promise<string>(resolve => rl.question("\n> ", resolve));

  console.log(`\nSentinel Harness — ${org.divisions.length} divisions, ${org.personas.length} personas active`);
  console.log("Type your task or 'help' for commands, 'quit' to exit.\n");

  while (true) {
    const input = (await prompt()).trim();
    if (!input) continue;
    if (input === "quit" || input === "exit" || input === "q") break;
    if (input === "help" || input === "?") {
      console.log("\nCommands:");
      console.log("  <task>          Execute a task through the harness");
      console.log("  personas         List all loaded personas");
      console.log("  divisions        List all divisions");
      console.log("  help             Show this help");
      console.log("  quit             Exit");
      continue;
    }
    if (input === "personas") {
      for (const p of org.personas) {
        console.log(`  ${p.name} [${p.division}]`);
      }
      continue;
    }
    if (input === "divisions") {
      for (const d of org.divisions) {
        const count = org.personas.filter(p => p.division === d).length;
        console.log(`  ${d}/ (${count} agents)`);
      }
      continue;
    }

    await runTask(input, org, invoke);
  }

  rl.close();
  process.exit(0);
}

function routeToDivision(description: string, org: Org): Task["division"] {
  const desc = description.toLowerCase();
  for (const [pattern, { division }] of org.routingTable) {
    if (desc.includes(pattern)) return division;
  }
  return "intelligence"; // Default fallback
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
