#!/usr/bin/env node
import { interactive } from './interactive.ts';
import { parseArgs } from 'node:util';
import { realpath } from 'node:fs/promises';
import { exit } from 'node:process';
import { renderContext } from './agents.ts';
import { startMcpServer } from './mcp.ts';
import { findProjectRoot, initialize, loadState } from './project.ts';
import { addDecision, addHandoff, addTask, purge, setObjective, syncContext, updateTask } from './service.ts';

const usage = `agentmemo — mémoire locale entre agents IA

Usage : agentmemo [--project chemin] <commande> [--json]
  interactive
  init [--objective "objectif"]
  status | context | sync
  objective "objectif"
  task add "titre" [--doing]
  task list [--status todo|doing|done]
  task start|done|reopen T1 [--note "note"]
  decision add "décision" [--reason "raison"]
  decision list
  handoff --agent nom --summary "résumé" [--next "suite"]
          [--blocker "blocage"]... [--file chemin]...
  handoff list
  mcp
  purge --yes

Options : --help (-h), --project chemin, --json
Utilise -- pour un texte commençant par un tiret.`;

async function main() {
  const { values, positionals, tokens } = parseArgs({
    allowPositionals: true, tokens: true,
    options: {
      help: { type: 'boolean', short: 'h' }, project: { type: 'string' }, json: { type: 'boolean' },
      objective: { type: 'string' }, doing: { type: 'boolean' }, status: { type: 'string' },
      note: { type: 'string' }, reason: { type: 'string' }, agent: { type: 'string' },
      summary: { type: 'string' }, next: { type: 'string' },
      blocker: { type: 'string', multiple: true }, file: { type: 'string', multiple: true },
      yes: { type: 'boolean' },
    },
  });
  const [command = process.stdin.isTTY && process.stdout.isTTY ? 'interactive' : 'help', ...rest] = positionals;
  if (values.help || command === 'help') { console.log(usage); return; }
  const grouped = ['task', 'decision'].includes(command) || (command === 'handoff' && rest[0] === 'list');
  const action = grouped ? rest.shift() : undefined;
  const key = [command, action].filter(Boolean).join(' ');
  const allowed: Record<string, string[]> = {
    interactive: [], init: ['objective'], status: [], context: [], sync: [], objective: [],
    'task add': ['doing'], 'task list': ['status'], 'task start': ['note'],
    'task done': ['note'], 'task reopen': ['note'],
    'decision add': ['reason'], 'decision list': [],
    handoff: ['agent', 'summary', 'next', 'blocker', 'file'], 'handoff list': [],
    mcp: [], purge: ['yes'],
  };
  if (!(key in allowed)) throw new Error(`Commande inconnue : ${key}. Lance agentmemo help.`);
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== 'option') continue;
    if (!['project', 'json', 'help', ...allowed[key]!].includes(token.name)) throw new Error(`Option --${token.name} non autorisée pour ${key}.`);
    if (seen.has(token.name) && !['blocker', 'file'].includes(token.name)) throw new Error(`Option répétée : --${token.name}.`);
    seen.add(token.name);
    if (typeof token.value === 'string' && (!token.value.trim() || (!token.inlineValue && token.value.startsWith('--')))) throw new Error(`Valeur manquante pour --${token.name}. Utilise --${token.name}=valeur pour une valeur commençant par --.`);
  }
  const takesText = ['objective', 'task add', 'decision add'].includes(key);
  const takesId = ['task start', 'task done', 'task reopen'].includes(key);
  if ((!takesText && !takesId && rest.length) || (takesId && rest.length !== 1)) throw new Error(`Arguments invalides pour ${key}. Lance agentmemo help.`);
  const required = (value: string | undefined, name: string) => {
    if (!value?.trim()) throw new Error(`Valeur manquante : ${name}.`);
    return value;
  };
  if (takesText) required(rest.join(' '), 'texte');
  if (values.status && !['todo', 'doing', 'done'].includes(values.status)) throw new Error('Statut invalide : todo, doing ou done attendu.');
  if (command === 'mcp' && values.json) throw new Error('mcp utilise déjà JSON-RPC ; retire --json.');
  const root = values.project ? await realpath(values.project) : command === 'init' ? await realpath(process.cwd()) : await findProjectRoot();
  if (command === 'interactive') {
    if (!process.stdin.isTTY || !process.stdout.isTTY || values.json) throw new Error('Le mode interactif nécessite un terminal, sans --json.');
    return interactive(root);
  }
  if (command === 'init' && process.stdin.isTTY && process.stdout.isTTY && !values.json) return interactive(root, true, values.objective);
  const output = (data: unknown, message: string) => console.log(values.json ? JSON.stringify(data, null, 2) : message);
  if (command === 'init') { const state = await initialize(root, values.objective); output(state, `✓ agentmemo initialisé dans ${root}`); return; }
  if (command === 'mcp') return startMcpServer(root);
  if (command === 'purge') {
    if (!values.yes) throw new Error('La purge supprime la mémoire locale. Confirme avec agentmemo purge --yes.');
    await purge(root); output({ purged: true, root }, '✓ Mémoire locale supprimée.'); return;
  }
  if (command === 'sync') { const state = await syncContext(root); output(state, '✓ AGENTS.md régénéré.'); return; }
  if (command === 'objective') { const state = await setObjective(root, rest.join(' ')); output(state, '✓ Objectif mis à jour.'); return; }
  if (command === 'context' || command === 'status') {
    const state = await loadState(root);
    output(state, command === 'context' ? renderContext(state) : `${state.project}\nObjectif : ${state.objective ?? 'Non défini'}\n${state.tasks.filter(t => t.status !== 'done').length} tâche(s) active(s) · ${state.decisions.length} décision(s) · ${state.handoffs.length} relais`); return;
  }
  if (key === 'task add') { const task = await addTask(root, rest.join(' '), values.doing ? 'doing' : 'todo'); output(task, `✓ ${task.id} ajoutée — ${task.title}`); return; }
  if (takesId) { const task = await updateTask(root, rest[0]!, action === 'done' ? 'done' : action === 'reopen' ? 'todo' : 'doing', values.note); output(task, `✓ ${task.id} → ${task.status}`); return; }
  if (key === 'task list') { const tasks = (await loadState(root)).tasks.filter(t => !values.status || t.status === values.status); output(tasks, tasks.map(t => `${t.id}\t${t.status}\t${t.title}`).join('\n') || 'Aucune tâche.'); return; }
  if (key === 'decision add') { const item = await addDecision(root, rest.join(' '), values.reason); output(item, `✓ ${item.id} conservée — ${item.title}`); return; }
  if (key === 'decision list') { const items = (await loadState(root)).decisions; output(items, items.map(d => `${d.id}\t${d.title}${d.reason ? ` — ${d.reason}` : ''}`).join('\n') || 'Aucune décision.'); return; }
  if (key === 'handoff list') { const items = (await loadState(root)).handoffs; output(items, items.map(h => `${h.id}\t${h.agent}\t${h.summary}`).join('\n') || 'Aucun relais.'); return; }
  const handoff = await addHandoff(root, { agent: required(values.agent, '--agent'), summary: required(values.summary, '--summary'), next: values.next, blockers: values.blocker ?? [], files: values.file ?? [] });
  output(handoff, `✓ ${handoff.id} — relais de ${handoff.agent} enregistré.`);
}

main().catch((error: Error & { code?: string }) => { console.error(`Erreur : ${['ERR_PARSE_ARGS_INVALID_OPTION_VALUE'].includes(error.code ?? '') ? 'Valeur manquante ou ambiguë. ' : ''}${error.message}`); exit(1); });
