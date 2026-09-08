import { createInterface } from 'node:readline';
import { renderContext } from './agents.ts';
import { findProjectRoot, loadState } from './project.ts';
import { addDecision, addHandoff, addTask, updateTask } from './service.ts';

type Request = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };

const tools = [
  { name: 'aihub_context', description: 'Lit le point de reprise local du projet.', inputSchema: { type: 'object', properties: {} } },
  { name: 'aihub_task_add', description: 'Ajoute une tâche à la mémoire du projet.', inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
  { name: 'aihub_task_update', description: 'Change le statut d’une tâche.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['todo', 'doing', 'done'] }, note: { type: 'string' } }, required: ['id', 'status'] } },
  { name: 'aihub_decision_add', description: 'Conserve une décision et sa raison.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, reason: { type: 'string' } }, required: ['title'] } },
  { name: 'aihub_handoff', description: 'Prépare le relais pour la prochaine session.', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, summary: { type: 'string' }, next: { type: 'string' }, blockers: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'string' } } }, required: ['agent', 'summary'] } },
];

function result(id: Request['id'], value: unknown) { return { jsonrpc: '2.0', id, result: value }; }
function error(id: Request['id'], code: number, message: string) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function text(value: unknown) { return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] }; }

async function callTool(name: string, args: Record<string, unknown>) {
  const root = await findProjectRoot();
  if (name === 'aihub_context') return text(renderContext(await loadState(root)));
  if (name === 'aihub_task_add') return text(await addTask(root, String(args.title)));
  if (name === 'aihub_task_update') return text(await updateTask(root, String(args.id), args.status as 'todo' | 'doing' | 'done', args.note ? String(args.note) : undefined));
  if (name === 'aihub_decision_add') return text(await addDecision(root, String(args.title), args.reason ? String(args.reason) : undefined));
  if (name === 'aihub_handoff') return text(await addHandoff(root, { agent: String(args.agent), summary: String(args.summary), next: args.next ? String(args.next) : undefined, blockers: Array.isArray(args.blockers) ? args.blockers.map(String) : [], files: Array.isArray(args.files) ? args.files.map(String) : [] }));
  throw new Error(`Outil MCP inconnu : ${name}`);
}

export async function handleMcpRequest(request: Request) {
  if (request.method === 'initialize') return result(request.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'aihub', version: '0.1.0' } });
  if (request.method === 'notifications/initialized') return undefined;
  if (request.method === 'ping') return result(request.id, {});
  if (request.method === 'tools/list') return result(request.id, { tools });
  if (request.method === 'tools/call') {
    try {
      const params = request.params ?? {}; return result(request.id, await callTool(String(params.name), (params.arguments ?? {}) as Record<string, unknown>));
    } catch (cause) { return result(request.id, { ...text((cause as Error).message), isError: true }); }
  }
  return error(request.id, -32601, `Méthode inconnue : ${request.method}`);
}

export async function startMcpServer(): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try { const response = await handleMcpRequest(JSON.parse(line) as Request); if (response) process.stdout.write(`${JSON.stringify(response)}\n`); }
    catch { process.stdout.write(`${JSON.stringify(error(null, -32700, 'JSON invalide'))}\n`); }
  }
}
