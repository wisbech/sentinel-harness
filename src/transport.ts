import { spawn } from "node:child_process";
import type { Transport, TransportParams, TransportType } from "./types";

const DETECTED_TRANSPORT: TransportType | null = (() => {
  try {
    spawn("pi", ["--version"], { stdio: "ignore" });
    return "pi";
  } catch {}
  try {
    spawn("claude", ["--version"], { stdio: "ignore" });
    return "claude";
  } catch {}
  try {
    spawn("opencode", ["--version"], { stdio: "ignore" });
    return "opencode";
  } catch {}
  try {
    spawn("github-copilot-cli", ["--version"], { stdio: "ignore" });
    return "copilot";
  } catch {}
  return null;
})();

export function detectTransport(): TransportType {
  return DETECTED_TRANSPORT ?? "bun";
}

export function createTransport(type: TransportType, apiKey?: string): Transport {
  switch (type) {
    case "pi": return piTransport(apiKey);
    case "claude": return claudeTransport(apiKey);
    case "opencode": return opencodeTransport(apiKey);
    case "copilot": return copilotTransport();
    default: return bunTransport(apiKey);
  }
}

function piTransport(apiKey?: string): Transport {
  return {
    type: "pi",
    invoke: (params) => exec("pi", [
      "--print",
      "--no-skills",
      "--no-extensions",
      "--no-context-files",
      "--model", "anthropic/claude-sonnet-4-20250514",
    ], envWithKey(apiKey), params.task, params.systemPrompt),
  };
}

function claudeTransport(apiKey?: string): Transport {
  return {
    type: "claude",
    invoke: (params) => exec("claude", [
      "--print",
      "--model", "claude-sonnet-4-20250514",
    ], envWithKey(apiKey), `${params.systemPrompt}\n\n${params.task}`),
  };
}

function opencodeTransport(apiKey?: string): Transport {
  return {
    type: "opencode",
    invoke: (params) => exec("opencode", [], envWithKey(apiKey), `${params.systemPrompt}\n\n---\n\n${params.task}`),
  };
}

function copilotTransport(): Transport {
  return {
    type: "copilot",
    invoke: (params) => exec("github-copilot-cli", [], {}, `${params.systemPrompt}\n\n${params.task}\n\nRespond only with the result. No explanation or preamble.`),
  };
}

function bunTransport(apiKey?: string): Transport {
  const key = apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";

  return {
    type: "bun",
    invoke: async (params) => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: params.systemPrompt,
          messages: [{ role: "user", content: params.task }],
        }),
      });

      const json = await response.json();
      if (json.error) throw new Error(`Anthropic API: ${json.error.message}`);
      return json.content?.[0]?.text || JSON.stringify(json);
    },
  };
}

function exec(cmd: string, args: string[], env: Record<string, string>, input: string, systemPrompt?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let fullInput = input;
    if (systemPrompt) {
      fullInput = `${systemPrompt}\n\n---\n\n${input}\n\nRespond directly. No preamble. No "Based on". Just the output.`;
    }

    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code === 0 || stdout.trim().length > 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`${cmd} failed (${code}): ${stderr}`));
      }
    });

    child.on("error", reject);

    child.stdin.write(fullInput);
    child.stdin.end();
  });
}

function envWithKey(apiKey?: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (apiKey) {
    if (apiKey.startsWith("sk-ant")) env.ANTHROPIC_API_KEY = apiKey;
    else if (apiKey.startsWith("sk-")) env.OPENAI_API_KEY = apiKey;
  }
  return env;
}
