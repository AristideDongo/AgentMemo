import { createInterface } from 'node:readline';
import { renderContext } from './agents.ts';
import { findProjectRoot, loadState } from './project.ts';
import { addDecision, addHandoff, addTask, updateTask } from './service.ts';

type Request = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };

const tools = [
  { name: 'agentmemo_context', description: 'Lit le point de reprise local du projet.', inputSchema: { type: 'object', properties: {} } },
  { name: 'agentmemo_task_add', description: 'Ajoute une tâche à la mémoire du projet.', inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
  { name: 'agentmemo_task_update', description: 'Change le statut d’une tâche.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['todo', 'doing', 'done'] }, note: { type: 'string' } }, required: ['id', 'status'] } },
  { name: 'agentmemo_decision_add', description: 'Conserve une décision et sa raison.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, reason: { type: 'string' } }, required: ['title'] } },
  { name: 'agentmemo_handoff', description: 'Prépare le relais pour la prochaine session.', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, summary: { type: 'string' }, next: { type: 'string' }, blockers: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'string' } } }, required: ['agent', 'summary'] } },
];

function result(id: Request['id'], value: unknown) { return { jsonrpc: '2.0', id, result: value }; }
function error(id: Request['id'], code: number, message: string) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function text(value: unknown) { return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] }; }

function validateArguments(name: string, args: unknown): asserts args is Record<string, unknown> {
  const tool = tools.find((tool) => tool.name === name);
  if (!tool) throw new Error(`Outil MCP inconnu : ${name}`);
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments : objet attendu.');
  const input = args as Record<string, unknown>;
  const schema = tool.inputSchema as { properties: Record<string, { type: string; enum?: string[] } | undefined>; required?: string[] };
  for (const key of schema.required ?? []) {
    if (!(key in input)) throw new Error(`Argument requis : ${key}`);
  }
  for (const [key, value] of Object.entries(input)) {
    const field = schema.properties[key];
    if (!field) throw new Error(`Argument inconnu : ${key}`);
    if (field.type === 'string' && (typeof value !== 'string' || !value.trim())) throw new Error(`${key} : chaîne non vide attendue.`);
    if (field.type === 'array' && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) throw new Error(`${key} : liste de chaînes attendue.`);
    if (field.enum && !field.enum.includes(value as string)) throw new Error(`${key} : valeur invalide.`);
  }
}

async function callTool(name: string, args: Record<string, unknown>, projectRoot?: string) {
  validateArguments(name, args);
  const root = projectRoot ?? await findProjectRoot();
  if (name === 'agentmemo_context') return text(renderContext(await loadState(root)));
  if (name === 'agentmemo_task_add') return text(await addTask(root, String(args.title)));
  if (name === 'agentmemo_task_update') return text(await updateTask(root, String(args.id), args.status as 'todo' | 'doing' | 'done', args.note ? String(args.note) : undefined));
  if (name === 'agentmemo_decision_add') return text(await addDecision(root, String(args.title), args.reason ? String(args.reason) : undefined));
  if (name === 'agentmemo_handoff') return text(await addHandoff(root, { agent: String(args.agent), summary: String(args.summary), next: args.next ? String(args.next) : undefined, blockers: Array.isArray(args.blockers) ? args.blockers.map(String) : [], files: Array.isArray(args.files) ? args.files.map(String) : [] }));
  throw new Error(`Outil MCP inconnu : ${name}`);
}

export async function handleMcpRequest(input: unknown, projectRoot?: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return error(null, -32600, 'Requête invalide');
  const request = input as Request;
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string' ||
      (request.id !== undefined && request.id !== null && typeof request.id !== 'string' && typeof request.id !== 'number')) return error(null, -32600, 'Requête invalide');
  if (request.id === undefined) return undefined;
  if (request.params !== undefined && (!request.params || typeof request.params !== 'object' || Array.isArray(request.params))) return error(request.id, -32602, 'Paramètres invalides');
  if (request.method === 'initialize') return result(request.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'agentmemo', version: '0.1.0' } });
  if (request.method === 'notifications/initialized') return undefined;
  if (request.method === 'ping') return result(request.id, {});
  if (request.method === 'tools/list') return result(request.id, { tools });
  if (request.method === 'tools/call') {
    try {
      const params = request.params ?? {}; return result(request.id, await callTool(String(params.name), (params.arguments ?? {}) as Record<string, unknown>, projectRoot));
    } catch (cause) { return result(request.id, { ...text((cause as Error).message), isError: true }); }
  }
  return error(request.id, -32601, `Méthode inconnue : ${request.method}`);
}

export async function startMcpServer(projectRoot?: string): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try { const response = await handleMcpRequest(JSON.parse(line) as Request, projectRoot); if (response) process.stdout.write(`${JSON.stringify(response)}\n`); }
    catch { process.stdout.write(`${JSON.stringify(error(null, -32700, 'JSON invalide'))}\n`); }
  }
}
