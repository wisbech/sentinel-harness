export type Division = "strategy" | "intelligence" | "engineering" | "commercial";

export interface Persona {
  name: string;
  division: Division;
  identity: string;
  mission: string;
  boundaries: string;
  traits: string[];
  voice?: string;
  path: string;
}

export interface Org {
  root: string;
  divisions: Division[];
  personas: Persona[];
  claudeMd: string;
  agentsMd: string;
  routingTable: Map<string, { division: Division; skills: string[] }>;
  protocol: string;
}

export interface Task {
  id: string;
  description: string;
  division: Division;
  complexity: "leaf" | "composite";
  parentId?: string;
  children?: Task[];
  assignee?: string;
  status: "pending" | "running" | "done" | "failed";
  result?: AgentResult;
}

export interface AgentResult {
  taskId: string;
  agent: string;
  content: string;
  artifacts: string[];
  needsUserInput?: string;
}

export interface DecompositionResult {
  subTasks: Task[];
  reasoning: string;
}

export interface BusMessage {
  from: string;
  to?: string;
  division?: Division;
  type: "query" | "response" | "artifact" | "signal";
  content: string;
  timestamp: number;
}

export type TransportType = "pi" | "claude" | "opencode" | "copilot" | "bun" | string;

export interface Transport {
  type: TransportType;
  invoke(params: TransportParams): Promise<string>;
}

export interface TransportParams {
  systemPrompt: string;
  task: string;
  tools?: ToolDef[];
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface BootstrapBlueprint {
  name: string;
  description: string;
  divisions: { name: string; purpose: string; agents: { name: string; role: string }[] }[];
  devbox?: { packages: string[] };
}
