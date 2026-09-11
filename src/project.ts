import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { withProjectLock } from './lock.ts';
import { updateAgentsFile } from './agents.ts';
import { randomUUID } from 'node:crypto';
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
  const temporary = `${path}.${randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true });
  state.updatedAt = new Date().toISOString();
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

async function ignoreLocalFiles(root: string): Promise<void> {
  let tracked = '';
  try {
    tracked = (await promisify(execFile)('git', ['ls-files', '--', 'AGENTS.md', '.aihub', '.aihub.lock'], { cwd: root })).stdout;
  } catch (error) {
    // A project does not need Git installed or an initialized repository.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error as { stderr?: string }).stderr?.includes('not a git repository')) throw error;
  }
  if (tracked.trim()) throw new Error('Des fichiers aihub ou AGENTS.md sont déjà suivis par Git. Retire-les du suivi avant init pour garder la mémoire locale. Aucun fichier suivi ne sera modifié.');
  const path = join(root, '.gitignore');
  let current = '';
  try { current = await readFile(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const patterns = ['/.aihub/', '/.aihub.lock/', '/AGENTS.md'];
  const missing = patterns.filter(pattern => !current.split(/\r?\n/).includes(pattern));
  if (missing.length) await writeFile(path, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`, 'utf8');
}

export async function initialize(root: string, objective?: string): Promise<ProjectState> {
  return withProjectLock(root, async () => {
    let state: ProjectState;
    try { state = await loadState(root); }
    catch (error) {
      if (!(error as Error).message.startsWith('Projet non initialisé')) throw error;
      state = emptyState(root);
    }
    await ignoreLocalFiles(root);
    if (objective !== undefined) state.objective = objective;
    await saveState(root, state);
    await updateAgentsFile(root, state);
    return state;
  });
}

export function nextId(prefix: string, entries: Array<{ id: string }>): string {
  const highest = entries.reduce((max, entry) => Math.max(max, Number(entry.id.slice(prefix.length)) || 0), 0);
  return `${prefix}${highest + 1}`;
}
