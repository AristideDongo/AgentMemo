import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { handleMcpRequest } from '../src/mcp.ts';
import { initialize, loadState } from '../src/project.ts';
import { addTask, purge } from '../src/service.ts';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

test('CLI : accepte --doing avant le titre et rejette une valeur manquante', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'aihub-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initialize(root);
  await exec(process.execPath, ['--experimental-strip-types', cli, 'task', 'add', '--doing', 'Vérifier le relais'], { cwd: root });
  assert.equal((await loadState(root)).tasks[0]?.title, 'Vérifier le relais');
  assert.equal((await loadState(root)).tasks[0]?.status, 'doing');
  await assert.rejects(exec(process.execPath, ['--experimental-strip-types', cli, 'handoff', '--agent', '--summary', 'Résumé'], { cwd: root }), /Valeur manquante/);
  assert.equal((await loadState(root)).handoffs.length, 0);
});

test('purge : supprime le contexte généré et préserve les instructions humaines', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'aihub-purge-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initialize(root);
  await writeFile(join(root, 'AGENTS.md'), '# Instructions humaines\n');
  await addTask(root, 'Contexte à supprimer');
  await purge(root);
  const content = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.match(content, /# Instructions humaines/);
  assert.doesNotMatch(content, /aihub:start|Contexte à supprimer/);
  await assert.rejects(loadState(root), /non initialisé/);
  await purge(root);
});

test('MCP : rejette les enveloppes invalides et ignore les notifications', async () => {
  for (const input of [null, [], 42, {}, { jsonrpc: '1.0', method: 'ping', id: 1 }]) {
    const response = await handleMcpRequest(input);
    assert.equal((response as any).error.code, -32600);
  }
  assert.equal(await handleMcpRequest({ jsonrpc: '2.0', method: 'ping' }), undefined);
  assert.deepEqual(await handleMcpRequest({ jsonrpc: '2.0', method: 'ping', id: 0 }), { jsonrpc: '2.0', id: 0, result: {} });
});

test('MCP : valide les arguments avant de lire ou modifier le projet', async () => {
  for (const [name, args] of [
    ['aihub_task_add', {}], ['aihub_task_add', { title: 42 }],
    ['aihub_task_add', { title: ' ' }],
    ['aihub_task_update', { id: 'T1', status: 'invalid' }],
    ['aihub_handoff', { agent: 'test', summary: 'test', files: [42] }],
    ['aihub_context', []],
  ]) {
    const response = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    assert.equal((response as any).result.isError, true);
    assert.doesNotMatch((response as any).result.content[0].text, /non initialisé/);
  }
});
