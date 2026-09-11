import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { initialize, loadState } from './project.ts';
import { renderContext } from './agents.ts';
import { addTask, addDecision, addHandoff, updateTask } from './service.ts';

export async function interactive(root: string, initOnly = false, objective?: string): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  const ask = async (label: string) => (await rl.question(label)).trim();
  const required = async (label: string) => {
    let value = '';
    while (!value) value = await ask(label);
    return value;
  };
  try {
    console.log(`\nProjet : ${root}`);
    let state;
    try { state = await loadState(root); }
    catch (error) { if (!(error as Error).message.startsWith('Projet non initialisé')) throw error; }
    if (initOnly || !state) {
      const answer = objective ?? await ask(`Objectif du projet${state?.objective ? ` [${state.objective}]` : ' (facultatif)'} : `);
      await initialize(root, answer || undefined);
      console.log(`✓ Mémoire locale : ${root}/.aihub/state.json\n✓ Contexte : ${root}/AGENTS.md\n✓ Fichiers exclus de Git.`);
      if (initOnly) return;
    }
    while (true) {
      console.log('\n1. Voir le contexte\n2. Ajouter une tâche\n3. Terminer une tâche\n4. Ajouter une décision\n5. Préparer un relais\n0. Quitter');
      const choice = await ask('Choix : ');
      try {
        if (choice === '0') return;
        if (choice === '1') console.log(renderContext(await loadState(root)));
        else if (choice === '2') { const task = await addTask(root, await required('Titre : ')); console.log(`✓ ${task.id} ajoutée.`); }
        else if (choice === '3') {
          const tasks = (await loadState(root)).tasks.filter(t => t.status !== 'done');
          if (!tasks.length) { console.log('Aucune tâche active.'); continue; }
          console.log(tasks.map(t => `${t.id} — ${t.title}`).join('\n'));
          await updateTask(root, await required('Identifiant : '), 'done'); console.log('✓ Tâche terminée.');
        }
        else if (choice === '4') { await addDecision(root, await required('Décision : '), await ask('Raison (facultative) : ')); console.log('✓ Décision enregistrée.'); }
        else if (choice === '5') {
          await addHandoff(root, { agent: await required('Agent : '), summary: await required('Résumé : '), next: await ask('Prochaine étape : '), blockers: [], files: [] });
          console.log('✓ Relais enregistré.');
        }
        else console.log('Choisis un numéro de 0 à 5.');
      } catch (error) { console.error(`Erreur : ${(error as Error).message}`); }
    }
  } finally { rl.close(); }
}
