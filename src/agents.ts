import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectState } from './types.ts';

const START = '<!-- aihub:start -->';
const END = '<!-- aihub:end -->';

export function renderContext(state: ProjectState): string {
  const latest = state.handoffs.at(-1);
  const active = state.tasks.filter((task) => task.status !== 'done');
  const decisions = state.decisions.slice(-5);
  const lines = [START, '## aihub — point de reprise', '', `> Mis à jour localement le ${state.updatedAt}.`];
  if (state.objective) lines.push('', '### Objectif', '', state.objective);
  if (latest) {
    lines.push('', '### Dernier relais', '', `**${latest.agent}** — ${latest.summary}`);
    if (latest.next) lines.push('', `**Prochaine action :** ${latest.next}`);
    if (latest.blockers.length) lines.push('', `**Blocages :** ${latest.blockers.join(' · ')}`);
    if (latest.files.length) lines.push('', `**Fichiers :** ${latest.files.map((file) => `\`${file}\``).join(', ')}`);
  }
  lines.push('', '### Tâches actives', '', ...(active.length ? active.map((task) => `- [${task.status === 'doing' ? '~' : ' '}] ${task.id} — ${task.title}`) : ['- Aucune tâche active.']));
  if (decisions.length) lines.push('', '### Décisions récentes', '', ...decisions.map((decision) => `- ${decision.id} — **${decision.title}**${decision.reason ? ` : ${decision.reason}` : ''}`));
  lines.push('', END);
  return `${lines.join('\n')}\n`;
}

export async function updateAgentsFile(root: string, state: ProjectState): Promise<void> {
  const path = join(root, 'AGENTS.md');
  let current = '';
  try { current = await readFile(path, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const generated = renderContext(state);
  const start = current.indexOf(START); const end = current.indexOf(END);
  const next = start >= 0 && end >= start ? `${current.slice(0, start)}${generated}${current.slice(end + END.length).replace(/^\n/, '')}` : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${current ? '\n' : ''}${generated}`;
  await writeFile(path, next, 'utf8');
}

export async function removeAgentsContext(root: string): Promise<void> {
  const path = join(root, 'AGENTS.md');
  let current: string;
  try { current = await readFile(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start >= 0 && end >= start) {
    await writeFile(path, current.slice(0, start) + current.slice(end + END.length).replace(/^\n/, ''), 'utf8');
  }
}
