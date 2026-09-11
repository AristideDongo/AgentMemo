# AgentMemo

[![GitHub stars](https://img.shields.io/github/stars/AristideDongo/AgentMemo?style=flat&logo=github)](https://github.com/AristideDongo/AgentMemo)

**Passe d’une IA à une autre sans perdre le fil du projet.**

`agentmemo` est un CLI interactif qui conserve une mémoire locale dans ton projet : objectif, tâches, décisions et passages de relais. Le prochain agent retrouve le contexte dans `AGENTS.md`, par une commande ou via le serveur MCP local.

Aucun compte, clé API ou backend n’est nécessaire. Cette version est un MVP local, sans interface web ni synchronisation entre machines. Le CLI ne lance pas d’agent IA : il conserve les informations que tu lui fournis ou que tes agents enregistrent.

## Sommaire

- [Installation](#installation)
- [Démarrage dans ton projet](#démarrage-dans-ton-projet)
- [Menu interactif](#menu-interactif)
- [Référence des commandes](#référence-des-commandes)
- [Exemple de passage de relais](#exemple-de-passage-de-relais)
- [Fichiers locaux et Git](#fichiers-locaux-et-git)
- [Serveur MCP](#serveur-mcp)
- [Dépannage](#dépannage)
- [Développement et validation](#développement-et-validation)
- [Limites actuelles](#limites-actuelles)

## Installation

Prérequis : Node.js **22.6 ou supérieur**, npm et Git pour cloner le dépôt. Les exemples de terminal utilisent Bash.

```bash
node --version
npm --version

git clone https://github.com/AristideDongo/AgentMemo.git
cd AgentMemo
npm ci
npm run build
npm link
agentmemo --help
```

`npm link` rend la commande `agentmemo` disponible dans ton environnement Node. Elle pointe vers la version compilée de ce dépôt. Après une modification des sources, relance `npm run build`.

Si tu as déjà ouvert le dépôt, commence à `npm ci`.

Pour utiliser les sources directement depuis ce dépôt, sans installation de la commande :

```bash
npm run dev -- help
```

## Démarrage dans ton projet

Place-toi dans le projet dont tu veux conserver le contexte :

```bash
cd /chemin/vers/ton-projet
agentmemo init
agentmemo
```

1. `init` affiche le dossier ciblé et demande l’objectif, facultatif.
2. Il crée `.aihub/state.json` et le contexte `AGENTS.md` dans ce dossier.
3. Il ajoute les exclusions nécessaires au `.gitignore`.
4. `agentmemo` ouvre le menu interactif.

Pour accompagner le dépôt agentmemo lui-même pendant le développement :

```bash
npm run dev -- init
npm run dev
```

Il n’est pas nécessaire de créer un dossier temporaire ou de définir une variable d’environnement.

### Cibler un projet depuis un autre dossier

```bash
agentmemo --project /chemin/vers/ton-projet init
agentmemo --project /chemin/vers/ton-projet interactive
agentmemo --project /chemin/vers/ton-projet status
```

Le dossier passé à `--project` doit exister ; il est utilisé exactement comme racine.

Sans `--project`, `init` cible le **dossier courant**. Les autres commandes remontent depuis le dossier courant jusqu’au premier dossier contenant `.aihub` ou `.git`. Sans marqueur, elles utilisent le dossier courant. Dans un monorepo, utilise `--project` pour éviter toute ambiguïté.

### Ouvrir les fichiers

Depuis la racine du projet initialisé :

```bash
cat AGENTS.md
cat .aihub/state.json
```

Si la commande de ton éditeur VS Code est disponible :

```bash
code AGENTS.md
code .aihub/state.json
```

## Menu interactif

Lance `agentmemo` sans argument dans un terminal, ou `agentmemo interactive` :

```text
1. Voir le contexte
2. Ajouter une tâche
3. Terminer une tâche
4. Ajouter une décision
5. Préparer un relais
0. Quitter
```

Le menu initialise la mémoire si elle n’existe pas encore. Une tâche ajoutée depuis le menu commence au statut `todo`. Pour terminer une tâche, choisis son identifiant dans la liste affichée. Le relais demande l’agent, le résumé et la prochaine étape.

Les options avancées, comme les fichiers et blocages d’un relais, sont disponibles avec les commandes ci-dessous.

L’interactivité nécessite un terminal en entrée et en sortie. Sans terminal, `agentmemo` sans argument affiche l’aide. `init --json` ne pose aucune question, ce qui convient aux scripts.

## Référence des commandes

```text
agentmemo [--project chemin] <commande> [options]
```

### Options communes

| Option | Effet |
| --- | --- |
| `--help`, `-h` | Affiche l’aide générale. |
| `--project chemin` | Cible un dossier de projet existant. |
| `--json` | Affiche les données structurées pour les commandes de lecture et de modification. Incompatible avec `interactive` et `mcp`. |

Les erreurs sont écrites sur stderr et provoquent un code de sortie non nul. Les options inconnues, non autorisées pour une commande ou répétées sont rejetées, sauf `--file` et `--blocker`, qui acceptent plusieurs occurrences.

Pour un texte commençant par un tiret, utilise `--`. Pour une valeur d’option ambiguë, utilise `=` :

```bash
agentmemo task add -- "--titre littéral"
agentmemo decision add "Convention" --reason="--option est intentionnel"
```

### Initialiser et définir l’objectif

```bash
agentmemo init
agentmemo init --objective "Fiabiliser les webhooks"
agentmemo init --objective "Fiabiliser les webhooks" --json
agentmemo objective "Préparer la prochaine version"
```

Relancer `init` conserve les tâches, décisions et relais existants. Un nouvel objectif remplace le précédent. Dans le questionnaire, une réponse vide conserve l’objectif existant.

### Lire et régénérer le contexte

```bash
agentmemo status
agentmemo context
agentmemo status --json
agentmemo context --json
agentmemo sync
```

- `status` affiche le projet, l’objectif et les compteurs.
- `context` affiche le contexte Markdown : objectif, dernier relais, tâches actives et cinq dernières décisions.
- `status --json` et `context --json` renvoient tous deux l’état complet, y compris l’historique.
- `sync` reconstruit le bloc généré dans `AGENTS.md` depuis l’état enregistré, sans modifier cet état.

### Gérer les tâches

```bash
agentmemo task add "Écrire les tests"
agentmemo task add "Corriger le parseur" --doing
agentmemo task list
agentmemo task list --status doing --json
agentmemo task start T1
agentmemo task done T1 --note "Tests réussis"
agentmemo task reopen T1 --note "Cas supplémentaire à vérifier"
```

| Commande | Résultat |
| --- | --- |
| `task add "titre"` | Crée une tâche `todo` avec un identifiant comme `T1`. |
| `task add "titre" --doing` | Crée directement une tâche en cours. |
| `task list [--status todo\|doing\|done]` | Liste toutes les tâches, ou filtre par statut. |
| `task start T1 [--note "note"]` | Passe la tâche à `doing`. |
| `task done T1 [--note "note"]` | Passe la tâche à `done`. |
| `task reopen T1 [--note "note"]` | Remet la tâche à `todo`. |

Les identifiants sont insensibles à la casse pour les mises à jour. Les tâches terminées restent dans la mémoire, mais disparaissent de la liste des tâches actives du contexte. Une nouvelle note remplace la note précédente ; les notes sont accessibles dans l’état JSON.

### Conserver les décisions

```bash
agentmemo decision add "Utiliser Redis" --reason "Garantir l’idempotence"
agentmemo decision list
agentmemo decision list --json
```

Chaque décision reçoit un identifiant `D1`, `D2`, etc. La raison est facultative. Le contexte affiche les cinq dernières décisions ; la liste conserve toutes les décisions.

### Préparer et consulter les relais

```bash
agentmemo handoff \
  --agent dev \
  --summary "Validation de signature terminée" \
  --next "Tester les rejeux" \
  --blocker "Fixture manquante" \
  --blocker "Accès à la sandbox à obtenir" \
  --file src/webhooks.ts \
  --file test/webhooks.test.ts

agentmemo handoff list
agentmemo handoff list --json
```

`--agent` et `--summary` sont obligatoires. `--next`, `--blocker` et `--file` sont facultatifs. Les chemins de fichiers sont des références textuelles : leur contenu n’est pas importé. Les relais reçoivent des identifiants `S1`, `S2`, etc. Seul le dernier apparaît dans le contexte ; la liste JSON expose tout l’historique et ses détails.

### Supprimer la mémoire

```bash
agentmemo purge --yes
```

Cette commande supprime `.aihub/` et retire le bloc agentmemo correctement délimité dans `AGENTS.md`. Le texte humain autour du bloc est conservé. Le fichier `AGENTS.md` peut rester vide, et les règles `.gitignore` restent en place. La purge ne dispose pas d’une fonction d’annulation : sauvegarde la mémoire si tu veux la récupérer.

## Exemple de passage de relais

Depuis un projet nouvellement initialisé, le premier intervenant enregistre son travail :

```bash
agentmemo init --objective "Fiabiliser les webhooks de paiement"
agentmemo task add "Ajouter la validation de signature" --doing
agentmemo decision add "Vérifier la signature avant le traitement"
agentmemo task done T1 --note "Tests de signature verts"
agentmemo task add "Tester le rejeu après expiration"
agentmemo handoff --agent dev --summary "Validation terminée" \
  --next "Reprendre T2 : tests de rejeu" --file src/webhooks.ts
```

Le prochain intervenant reprend dans le même projet :

```bash
agentmemo context
agentmemo task start T2
```

Les identifiants de cet exemple supposent une mémoire vide au départ. Sur un projet existant, utilise ceux renvoyés par `task add` ou `task list`.

## Fichiers locaux et Git

```text
ton-projet/
├── .aihub/
│   └── state.json     # Mémoire complète
├── .aihub.lock/       # Présent seulement pendant une écriture normale
├── AGENTS.md          # Contexte destiné aux agents
└── .gitignore         # Exclusions ajoutées par init
```

`init` ajoute ces règles sans supprimer les règles existantes :

```gitignore
/.aihub/
/.aihub.lock/
/AGENTS.md
```

La mémoire et le contexte restent locaux par défaut. `.gitignore` peut être commité. Les exclusions n’empêchent pas un ajout forcé avec Git et ne retirent pas les fichiers déjà suivis : dans ce dernier cas, `init` refuse de modifier les fichiers de mémoire ou `AGENTS.md`.

Vérifie les exclusions depuis la racine du projet :

```bash
git check-ignore AGENTS.md .aihub/state.json
git status --short
```

Le bloc généré est délimité par `<!-- aihub:start -->` et `<!-- aihub:end -->`. Les modifications structurées le régénèrent ; les instructions humaines placées autour d’un bloc correctement délimité sont préservées. Évite de modifier son contenu à la main, car il sera remplacé à la prochaine modification ou synchronisation.

L’état contient une version de format, le nom du projet, l’objectif, les tâches, décisions, relais et dates de mise à jour. Il est enregistré en JSON avec des permissions `0600` lors de sa création sur les systèmes qui les prennent en charge.

agentmemo ne transmet aucune donnée à un service distant. Un agent qui lit le contexte peut néanmoins le transmettre à son propre fournisseur. Une sauvegarde du projet doit inclure explicitement les fichiers ignorés si tu souhaites conserver cette mémoire.

## Serveur MCP

Le serveur permet à un client compatible MCP d’accéder à la mémoire. Initialise d’abord le projet, puis configure le client pour lancer :

```bash
agentmemo --project /chemin/absolu/ton-projet mcp
```

Pour éviter de dépendre de `npm link` dans l’environnement du client, utilise le programme Node compilé :

```bash
node /chemin/absolu/AgentMemo/dist/cli.js \
  --project /chemin/absolu/ton-projet mcp
```

Paramètres à reporter dans la configuration de ton client :

```json
{
  "command": "/chemin/absolu/vers/node",
  "args": [
    "/chemin/absolu/AgentMemo/dist/cli.js",
    "--project",
    "/chemin/absolu/ton-projet",
    "mcp"
  ]
}
```

Ce fragment décrit le processus à lancer ; la structure qui l’entoure dépend du client. Remplace tous les chemins. Sous Bash, `command -v node` indique celui de Node. La connexion à un client MCP réel reste à valider pour cette version.

| Outil | Arguments requis | Arguments facultatifs |
| --- | --- | --- |
| `agentmemo_context` | Aucun | Aucun |
| `agentmemo_task_add` | `title` | Aucun |
| `agentmemo_task_update` | `id`, `status` (`todo`, `doing`, `done`) | `note` |
| `agentmemo_decision_add` | `title` | `reason` |
| `agentmemo_handoff` | `agent`, `summary` | `next`, `blockers` et `files` (listes de chaînes) |

Le transport utilise JSON-RPC sur stdio, avec un message JSON par ligne. Le serveur annonce actuellement la version de protocole `2025-06-18`. Les réponses occupent stdout ; ne combine pas `mcp` avec `--json`. Le processus attend les messages du client : il n’affiche pas de menu.

## Dépannage

| Symptôme | Solution |
| --- | --- |
| `agentmemo: command not found` | Depuis le dépôt du CLI, lance `npm run build` puis `npm link`, ou utilise `node /chemin/vers/dist/cli.js`. |
| `Projet non initialisé` | Place-toi dans le projet puis lance `agentmemo init`, ou précise `--project`. |
| `Valeur manquante pour --project` | Donne un chemin réel. Une variable shell vide n’est pas un chemin ; dans ton projet, tu peux simplement omettre l’option. |
| `Tâche T1 introuvable` | Consulte `agentmemo task list` et utilise l’identifiant existant. |
| Le menu ne s’affiche pas | Lance `agentmemo` dans un terminal, sans redirection ni `--json`. |
| Les dernières modifications du CLI ne sont pas visibles | Relance `npm run build` ou utilise `npm run dev`. |
| Le contexte n’est pas à jour | Lance `agentmemo sync` dans le bon projet. |
| Types Node non reconnus dans l’éditeur | Lance `npm ci`, puis `npm run check`. Sélectionne la version TypeScript du projet et redémarre le serveur TypeScript de l’éditeur. |

### Projet verrouillé

Les écritures sont sérialisées avec `.aihub.lock/`, y compris l’initialisation, la synchronisation et la purge. Une commande attend au maximum environ dix secondes avant de signaler un verrou occupé.

Après un arrêt brutal, le dossier peut rester présent. **Vérifie qu’aucun processus agentmemo n’utilise le projet** avant de retirer le dossier vide depuis sa racine :

```bash
rmdir .aihub.lock
agentmemo sync
```

Ne retire pas le verrou d’un processus actif. Ce mécanisme vise les processus sur une même machine et un système de fichiers local.

### Fichiers déjà suivis par Git

`.gitignore` ne masque pas un fichier déjà versionné. Si `init` signale ce cas, examine les fichiers concernés :

```bash
git ls-files -- AGENTS.md .aihub .aihub.lock
```

Décide ensuite avec ton équipe de les retirer du suivi si ces fichiers doivent devenir locaux. Le CLI ne modifie pas automatiquement l’index Git et ne supprime pas l’historique existant.

### État enregistré, contexte non régénéré

Une modification peut réussir dans `state.json` puis échouer sur `AGENTS.md`, par exemple faute de permission. Si le message indique que l’état a déjà été enregistré, corrige l’accès au fichier puis lance `agentmemo sync`, plutôt que de répéter l’ajout et créer un doublon.

## Développement et validation

Depuis le dépôt du CLI :

```bash
npm ci
npm run check
npm test
npm run build
node dist/cli.js help
npm pack --dry-run
```

| Script | Rôle |
| --- | --- |
| `npm run dev -- <arguments>` | Exécute les sources TypeScript avec Node. Sans arguments et dans un terminal, ouvre le menu. |
| `npm run check` | Vérifie les types sans générer de fichiers. |
| `npm test` | Exécute les tests Node, dont les régressions CLI, Git et concurrence. |
| `npm run build` | Produit JavaScript, déclarations et source maps dans `dist/`. |
| `npm pack --dry-run` | Vérifie le contenu du paquet ; le script `prepack` compile automatiquement. |

La CI définie dans `.github/workflows/ci.yml` vérifie le projet sous Node 22.6.0 et 24. Les tests utilisent des projets temporaires pour isoler les scénarios de validation ; ce n’est pas le parcours d’utilisation normal.

### Organisation du code

| Fichier | Responsabilité |
| --- | --- |
| `src/cli.ts` | Parseur d’arguments et commandes. |
| `src/interactive.ts` | Questions et menu du terminal. |
| `src/project.ts` | Racine du projet, initialisation, lecture et sauvegarde JSON, exclusions Git. |
| `src/service.ts` | Opérations sur les tâches, décisions et relais. |
| `src/agents.ts` | Rendu et mise à jour du contexte `AGENTS.md`. |
| `src/lock.ts` | Exclusion mutuelle des écritures locales. |
| `src/mcp.ts` | Transport et outils MCP. |
| `src/types.ts` | Types de la mémoire. |
| `test/` | Tests fonctionnels et de régression. |

## Limites actuelles

- Aucune synchronisation distante, fusion de mémoires ou coordination entre machines.
- Un arrêt brutal peut nécessiter une récupération manuelle du verrou.
- L’état JSON et `AGENTS.md` ne sont pas enregistrés dans une transaction unique ; `sync` sert à reconstruire le contexte.
- La validation profonde d’un état modifié manuellement reste à renforcer.
- Les marqueurs de contexte incomplets, multiples ou inclus dans les textes utilisateur ne sont pas encore gérés de manière robuste. Ne saisis pas les marqueurs réservés dans les données.
- Pas de suppression individuelle de tâche, décision ou relais, ni d’archivage automatique.
- La mémoire peut croître sans limite ; les notes des tâches ne sont pas incluses dans le contexte Markdown.
- L’implémentation MCP est manuelle et sa compatibilité avec les clients reste à vérifier.

L’[audit technique](docs/AUDIT.md) décrit les observations et priorités de développement du dépôt.

## Licence

[MIT](LICENSE).

### Renommage depuis aihub

Le projet s’appelle **AgentMemo** ; le package npm et la commande utilisent `agentmemo` en minuscules. Après mise à jour, lance `npm run build` puis `npm link` pour installer la nouvelle commande. Les outils MCP portent désormais le préfixe `agentmemo_` ; actualise les configurations des clients concernés.

Le dossier `.aihub/`, le verrou `.aihub.lock/` et les marqueurs `aihub:start` / `aihub:end` sont conservés pour retrouver les mémoires existantes sans migration.
