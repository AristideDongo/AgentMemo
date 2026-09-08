#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { renderContext, updateAgentsFile } from './agents.ts';
import { startMcpServer } from './mcp.ts';
import { findProjectRoot, initialize, loadState } from './project.ts';
import { addDecision, addHandoff, addTask, purge, setObjective, updateTask } from './service.ts';

const [command = 'help', subcommand, ...args] = process.argv.slice(2);
const optionArgs = [subcommand, ...args].filter((arg): arg is string => typeof arg === 'string');
const value = (flag: string) => { const index = optionArgs.indexOf(flag); return index >= 0 ? optionArgs[index + 1] : undefined; };
const positional = () => args.filter((arg, index) => !arg.startsWith('--') && (index === 0 || !args[index - 1]?.startsWith('--'))).join(' ').trim();
const required = (input: string | undefined, usage: string) => { if (!input) throw new Error(`Valeur manquante. Usage : ${usage}`); return input; };

function help() {
  console.log(`aihub — mémoire locale entre agents IA

Usage:
  aihub init [--objective "objectif"]
  aihub status | context
  aihub objective "objectif"
  aihub task add "titre" [--doing]
  aihub task list
  aihub task start|done T1 [--note "note"]
  aihub decision add "décision" [--reason "raison"]
  aihub decision list
  aihub handoff --agent codex --summary "travail réalisé" [--next "suite"] [--blocker "blocage"] [--file chemin]
  aihub mcp
  aihub purge --yes`);
}

async function main() {
  const root = await findProjectRoot();
  if (command === 'help' || command === '--help' || command === '-h') return help();
  if (command === 'init') {
    let state = await initialize(root); const objective = value('--objective');
    if (objective) state = await setObjective(root, objective);
    await updateAgentsFile(root, state); console.log(`✓ aihub initialisé dans ${root}`); return;
  }
  if (command === 'mcp') return startMcpServer();
  if (command === 'purge') { if (subcommand !== '--yes') throw new Error('La purge supprime la mémoire locale. Confirme avec `aihub purge --yes`.'); await purge(root); console.log('✓ Mémoire locale supprimée.'); return; }
  if (command === 'objective') { const objective = required([subcommand, ...args].join(' ').trim(), 'aihub objective "objectif"'); await setObjective(root, objective); console.log('✓ Objectif mis à jour.'); return; }
  if (command === 'status') {
    const state = await loadState(root); const active = state.tasks.filter((task) => task.status !== 'done'); const latest = state.handoffs.at(-1);
    console.log(`${state.project}\n${state.objective ? `Objectif : ${state.objective}\n` : ''}${active.length} tâche(s) active(s) · ${state.decisions.length} décision(s) · ${state.handoffs.length} relais${latest ? `\nDernier relais (${latest.agent}) : ${latest.summary}` : ''}`); return;
  }
  if (command === 'context') { console.log(renderContext(await loadState(root))); return; }
  if (command === 'task' && subcommand === 'add') { const task = await addTask(root, required(positional(), 'aihub task add "titre"'), args.includes('--doing') ? 'doing' : 'todo'); console.log(`✓ ${task.id} ajoutée — ${task.title}`); return; }
  if (command === 'task' && subcommand === 'list') { const state = await loadState(root); console.log(state.tasks.map((task) => `${task.id}\t${task.status}\t${task.title}`).join('\n') || 'Aucune tâche.'); return; }
  if (command === 'task' && ['start', 'done'].includes(subcommand ?? '')) { const id = required(args[0], `aihub task ${subcommand} T1`); const task = await updateTask(root, id, subcommand === 'done' ? 'done' : 'doing', value('--note')); console.log(`✓ ${task.id} → ${task.status}`); return; }
  if (command === 'decision' && subcommand === 'add') { const decision = await addDecision(root, required(positional(), 'aihub decision add "décision"'), value('--reason')); console.log(`✓ ${decision.id} conservée — ${decision.title}`); return; }
  if (command === 'decision' && subcommand === 'list') { const state = await loadState(root); console.log(state.decisions.map((item) => `${item.id}\t${item.title}${item.reason ? ` — ${item.reason}` : ''}`).join('\n') || 'Aucune décision.'); return; }
  if (command === 'handoff') {
    const handoff = await addHandoff(root, { agent: required(value('--agent'), 'aihub handoff --agent nom --summary "résumé"'), summary: required(value('--summary'), 'aihub handoff --agent nom --summary "résumé"'), next: value('--next'), blockers: values('--blocker'), files: values('--file') });
    console.log(`✓ ${handoff.id} — relais de ${handoff.agent} enregistré.`); return;
  }
  throw new Error(`Commande inconnue : ${[command, subcommand].filter(Boolean).join(' ')}. Lance \`aihub help\`.`);
}

function values(flag: string): string[] { return optionArgs.flatMap((arg, index) => arg === flag && optionArgs[index + 1] ? [optionArgs[index + 1]!] : []); }

main().catch((error: Error) => { console.error(`Erreur : ${error.message}`); process.exitCode = 1; });
