import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { ProjectState } from './types.ts';

export const STATE_DIRECTORY = '.aihub';
export const STATE_FILE = 'state.json';

export async function findProjectRoot(start = process.cwd()): Promise<string> {
  let current = resolve(start);
  while (true) {
    for (const marker of [STATE_DIRECTORY, '.git']) {
      try { await access(join(current, marker)); return current; } catch { /* remonte */ }
    }
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

export function emptyState(root: string): ProjectState {
  return { version: 1, project: basename(root), tasks: [], decisions: [], handoffs: [], updatedAt: new Date().toISOString() };
}

export async function loadState(root: string): Promise<ProjectState> {
  const path = join(root, STATE_DIRECTORY, STATE_FILE);
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as ProjectState;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.decisions) || !Array.isArray(parsed.handoffs)) throw new Error('format inconnu');
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Projet non initialisé. Lance `aihub init`.');
    throw new Error(`Impossible de lire ${path}: ${(error as Error).message}`);
  }
}

export async function saveState(root: string, state: ProjectState): Promise<void> {
  const directory = join(root, STATE_DIRECTORY);
  const path = join(directory, STATE_FILE);
  const temporary = `${path}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true });
  state.updatedAt = new Date().toISOString();
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

export async function initialize(root: string): Promise<ProjectState> {
  try { return await loadState(root); }
  catch (error) {
    if (!(error as Error).message.startsWith('Projet non initialisé')) throw error;
    const state = emptyState(root); await saveState(root, state); return state;
  }
}

export function nextId(prefix: string, entries: Array<{ id: string }>): string {
  const highest = entries.reduce((max, entry) => Math.max(max, Number(entry.id.slice(prefix.length)) || 0), 0);
  return `${prefix}${highest + 1}`;
}
