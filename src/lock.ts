import { mkdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

// Outside .aihub so purge cannot remove a held lock.
export async function withProjectLock<T>(root: string, operation: () => Promise<T>): Promise<T> {
  const path = join(root, '.aihub.lock');
  const deadline = Date.now() + 10_000;
  while (true) {
    try { await mkdir(path, { mode: 0o700 }); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error(`Projet verrouillé : ${path}. Si aucun agentmemo ne tourne, supprime ce dossier vide puis réessaie.`);
      await setTimeout(25);
    }
  }
  try { return await operation(); }
  finally { await rmdir(path); }
}
