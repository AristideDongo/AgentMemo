# aihub

<!-- Quand le dépôt public est connu, activer le compteur :
[![GitHub stars](https://img.shields.io/github/stars/OWNER/REPOSITORY?style=flat&logo=github)](https://github.com/OWNER/REPOSITORY)
-->

**Passe d’une IA à une autre sans perdre le fil du projet.**

`aihub` est une mémoire locale en TypeScript pour les agents IA de code. Un agent enregistre ce qu’il a fait, ses décisions, ses blocages et la prochaine étape ; l’agent suivant récupère ce relais dans `AGENTS.md` ou via MCP, sans compte et sans backend distant.

## État du projet

Cette version est un MVP local :

- stockage JSON par projet dans `.aihub/state.json` ;
- tâches, décisions et objectif courant ;
- passages de relais entre sessions ;
- bloc `aihub` régénéré dans `AGENTS.md` sans écraser les instructions humaines ;
- serveur MCP local sur stdio ;
- aucune synchronisation distante, Supabase ou interface web.

## Prérequis et installation

Node.js 22.6 ou plus récent est requis. Pour développer localement :

```bash
npm install
npm run build
npm link
```

Pendant le développement, Node peut exécuter directement les sources TypeScript :

```bash
npm run dev -- help
```

## Premier passage de relais

```bash
aihub init --objective "Fiabiliser les webhooks de paiement"
aihub task add "Ajouter la validation de signature" --doing
aihub decision add "Utiliser Redis pour l’idempotence" --reason "Les rejeux doivent être atomiques"
aihub task done T1 --note "Tests de signature verts"
aihub handoff \
  --agent claude \
  --summary "Validation de signature terminée" \
  --next "Tester le rejeu après expiration" \
  --blocker "La fixture de rejeu reste à écrire" \
  --file src/webhooks.ts
```

Le prochain agent peut lire `AGENTS.md` ou lancer :

```bash
aihub context
aihub status
```

## Commandes

```text
aihub init [--objective "objectif"]
aihub status | context
aihub objective "objectif"
aihub task add "titre" [--doing]
aihub task list
aihub task start|done T1 [--note "note"]
aihub decision add "décision" [--reason "raison"]
aihub decision list
aihub handoff --agent nom --summary "résumé" [--next "suite"]
aihub mcp
aihub purge --yes
```

Chaque modification structurée régénère uniquement la section délimitée par `<!-- aihub:start -->` et `<!-- aihub:end -->` dans `AGENTS.md`.

## MCP local

Configure l’agent pour lancer `aihub mcp` à la racine du projet. Le serveur expose :

- `aihub_context` ;
- `aihub_task_add` ;
- `aihub_task_update` ;
- `aihub_decision_add` ;
- `aihub_handoff`.

Les messages utilisent JSON-RPC sur stdio. Les logs et erreurs du protocole ne sont jamais écrits sur stdout en dehors des réponses JSON.

## Données et confidentialité

`aihub` n’envoie aucune donnée à un service distant. Le fichier `.aihub/state.json` est créé avec des permissions restrictives et ignoré par Git dans ce dépôt. Ajoute `.aihub/` au `.gitignore` de chaque projet si tu ne souhaites pas partager la mémoire brute.

`AGENTS.md` est destiné aux agents : vérifie son contenu avant de le versionner. Les agents eux-mêmes peuvent transmettre ce contexte à leur fournisseur selon leurs propres conditions.

## Tests

```bash
npm test
npm run check
```

## Licence

MIT

## Suivi développeurs

Consulte [l'audit technique et les priorités](docs/AUDIT.md). Les écritures locales sont sérialisées entre processus.


## CLI pour les développeurs

```bash
aihub --project /chemin/du/projet init --objective "Préparer la prochaine version"
aihub --project /chemin/du/projet task add "Tester le relais" --doing --json
aihub task list --status doing --json
aihub task reopen T1 --note "À reprendre"
aihub handoff list --json
aihub sync
aihub task add -- "--titre commençant par un tiret"
```

`--project` cible exactement un dossier existant, depuis n'importe quel répertoire, y compris pour `mcp`. Sans cette option, la racine est détectée comme auparavant. `--json` renvoie les données structurées sur stdout ; les erreurs vont sur stderr avec un code de sortie non nul. Les options inconnues, incompatibles avec la commande ou répétées (hors `--file` et `--blocker`) sont rejetées.

`sync` reconstruit le contexte depuis la mémoire enregistrée, sans modifier son contenu. Les mutations, l'initialisation, la synchronisation et la purge utilisent le dossier de verrou `.aihub.lock`, à ignorer dans Git. Après dix secondes d'attente, une commande échoue avec un diagnostic. Si un processus a été interrompu brutalement, vérifie qu'aucun processus aihub n'utilise ce projet avant de retirer ce dossier vide. Le verrou vise les processus locaux sur un système de fichiers local ; il ne constitue pas une synchronisation entre machines.
