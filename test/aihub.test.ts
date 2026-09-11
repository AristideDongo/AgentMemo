import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { renderContext, updateAgentsFile } from '../src/agents.ts';
import { initialize, loadState } from '../src/project.ts';
import { addDecision, addHandoff, addTask, updateTask } from '../src/service.ts';

async function project() { const root = await mkdtemp(join(tmpdir(), 'agentmemo-')); await initialize(root); return root; }

test('initialise un état local vide', async () => {
  const root = await project(); const state = await loadState(root);
  assert.equal(state.version, 1); assert.deepEqual(state.tasks, []); assert.equal(state.project, root.split('/').at(-1));
});

test('conserve les tâches et décisions puis régénère AGENTS.md', async () => {
  const root = await project(); const task = await addTask(root, 'Tester le webhook', 'doing');
  await addDecision(root, 'Utiliser Redis', 'Garantir l’idempotence');
  await updateTask(root, task.id, 'done', 'Tests verts');
  const state = await loadState(root); const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.equal(state.tasks[0]?.note, 'Tests verts'); assert.match(agents, /Utiliser Redis/); assert.doesNotMatch(agents, /Tâches actives[\s\S]*Tester le webhook/);
});

test('prépare un relais lisible par le prochain agent', async () => {
  const root = await project();
  await addHandoff(root, { agent: 'claude', summary: 'Validation ajoutée', next: 'Tester le rejeu', blockers: ['Fixture manquante'], files: ['src/webhook.ts'] });
  const context = renderContext(await loadState(root));
  assert.match(context, /claude/); assert.match(context, /Tester le rejeu/); assert.match(context, /src\/webhook\.ts/);
});

test('préserve les instructions humaines dans AGENTS.md', async () => {
  const root = await project(); await writeFile(join(root, 'AGENTS.md'), '# Instructions\n\nNe jamais modifier ceci.\n');
  const state = await loadState(root); await updateAgentsFile(root, state); await updateAgentsFile(root, state);
  const content = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.match(content, /Ne jamais modifier ceci/); assert.equal(content.match(/aihub:start/g)?.length, 1);
});
