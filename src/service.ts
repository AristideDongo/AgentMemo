import { withProjectLock } from './lock.ts';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { removeAgentsContext, updateAgentsFile } from './agents.ts';
import { loadState, nextId, saveState, STATE_DIRECTORY } from './project.ts';
import type { Decision, Handoff, ProjectState, Task, TaskStatus } from './types.ts';

export async function mutate(root: string, operation: (state: ProjectState) => void): Promise<ProjectState> {
  return withProjectLock(root, async () => {
  const state = await loadState(root);
  operation(state);
  await saveState(root, state);
  try { await updateAgentsFile(root, state); }
  catch (error) { throw new Error(`État enregistré, mais contexte non régénéré. Lance aihub sync : ${(error as Error).message}`); }
  return state;
  });
}

export async function setObjective(root: string, objective: string): Promise<ProjectState> {
  return mutate(root, (state) => { state.objective = objective; });
}

export async function addTask(root: string, title: string, status: TaskStatus = 'todo'): Promise<Task> {
  let created!: Task;
  await mutate(root, (state) => {
    const now = new Date().toISOString();
    created = { id: nextId('T', state.tasks), title, status, createdAt: now, updatedAt: now };
    state.tasks.push(created);
  });
  return created;
}

export async function updateTask(root: string, id: string, status: TaskStatus, note?: string): Promise<Task> {
  let updated!: Task;
  await mutate(root, (state) => {
    const task = state.tasks.find((item) => item.id.toLowerCase() === id.toLowerCase());
    if (!task) throw new Error(`Tâche ${id} introuvable.`);
    task.status = status; task.updatedAt = new Date().toISOString();
    if (note) task.note = note;
    updated = task;
  });
  return updated;
}

export async function addDecision(root: string, title: string, reason?: string): Promise<Decision> {
  let created!: Decision;
  await mutate(root, (state) => {
    created = { id: nextId('D', state.decisions), title, reason, createdAt: new Date().toISOString() };
    state.decisions.push(created);
  });
  return created;
}

export async function addHandoff(root: string, input: Omit<Handoff, 'id' | 'createdAt'>): Promise<Handoff> {
  let created!: Handoff;
  await mutate(root, (state) => {
    created = { id: nextId('S', state.handoffs), ...input, createdAt: new Date().toISOString() };
    state.handoffs.push(created);
  });
  return created;
}

export async function purge(root: string): Promise<void> {
  await withProjectLock(root, async () => {
  await removeAgentsContext(root);
  await rm(join(root, STATE_DIRECTORY), { recursive: true, force: true });
  });
}

export async function syncContext(root: string): Promise<ProjectState> {
  return withProjectLock(root, async () => {
    const state = await loadState(root);
    await updateAgentsFile(root, state);
    return state;
  });
}
