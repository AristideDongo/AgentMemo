# Audit développeurs — 11 septembre 2026

## Mise à jour après renforcement du CLI

Le défaut de concurrence ci-dessous a été corrigé par un verrou de projet partagé par les processus locaux. Le test de régression conserve vingt tâches et vingt IDs distincts : dix ajouts concurrents dans un processus, puis dix processus CLI. Initialisation, purge et synchronisation prennent aussi ce verrou. Un arrêt brutal nécessite une récupération manuelle documentée dans le README.

Le CLI utilise maintenant un parseur strict et propose `--project`, `--json`, `task reopen`, `task list --status`, `handoff list` et `sync`. La régénération peut être relancée après un échec ; les mutations signalent explicitement quand l'état a déjà été enregistré. Dix tests passent localement sous Node 24.21.0. La validation profonde du stockage, les marqueurs dans AGENTS.md et la compatibilité client MCP restent à traiter.

Le diagnostic suivant conserve les observations initiales. Les lignes P0, récupération par sync et parseur CLI sont désormais traitées dans les limites décrites ci-dessus.

## Diagnostic initial

Le dépôt contient un MVP CLI TypeScript, un stockage JSON et un serveur MCP stdio. Aucun backend, compte, secret ou frontend n'est nécessaire au périmètre annoncé. Après installation des dépendances, les quatre tests initiaux, la vérification TypeScript et la compilation passent sous Node 24.21.0.

L'usage local séquentiel est opérationnel. Le point bloquant pour un usage avec plusieurs sessions est la concurrence d'écriture. La compatibilité avec un client MCP réel reste à vérifier.

## Corrections apportées

- MCP : validation des arguments requis, types, listes et statuts avant tout accès au projet ; rejet des enveloppes JSON-RPC invalides ; absence de réponse aux notifications.
- CLI : `task add --doing "titre"` conserve maintenant le titre ; une option sans valeur ne consomme plus l'option suivante comme valeur.
- Purge : retire aussi le bloc généré d'AGENTS.md, en préservant le texte humain autour d'un bloc correctement délimité.
- Distribution : compilation automatique via `prepack`, ajout du verrou des dépendances.
- Qualité : quatre tests de régression supplémentaires et workflow CI pour Node 22.6.0 et 24. Le workflow est ajouté, son exécution distante n'a pas été observée.

## Travail restant, par priorité

| Priorité | Problème et localisation | Travail proposé et critère d'acceptation |
| --- | --- | --- |
| P0 | `src/service.ts:mutate` effectue lecture/modification/écriture sans verrou. `src/project.ts:saveState` réutilise un fichier temporaire par PID. | Sérialiser les transactions entre processus, incluant init, purge et régénération du contexte, ou utiliser un stockage transactionnel. Dix écritures concurrentes doivent produire dix tâches avec dix IDs uniques, sans erreur ni contexte périmé. Tester aussi avec plusieurs processus. |
| P1 | JSON et AGENTS.md sont écrits séparément : un échec sur AGENTS.md arrive après la persistance de l'état. | Définir la récupération et fournir une commande de régénération ; tester un fichier AGENTS.md non accessible. Le message d'erreur doit préciser que la donnée a déjà été enregistrée pour éviter les doublons à la relance. |
| P1 | `src/agents.ts` suppose une paire de marqueurs correcte et accepte ces mêmes marqueurs dans les données utilisateur. | Refuser ou échapper les marqueurs réservés ; détecter les blocs incomplets ou multiples avant modification. Tester la préservation des instructions humaines dans ces cas, y compris lors de purge. |
| P1 | `src/project.ts:loadState` ne vérifie que la version et les trois tableaux. | Valider les champs et les éléments, les statuts et les IDs ; rejeter un état corrompu sans le réécrire. Valider également les entrées des services si ceux-ci sont appelés directement. |
| P1 | `src/mcp.ts` est une implémentation manuelle et annonce une version de protocole fixe. | Tester initialisation, négociation de version, découverte, appels et erreurs avec un vrai client MCP. Envisager le SDK officiel pour réduire la maintenance du protocole. |
| P2 | Le parseur CLI reste permissif sur les options inconnues et certains cas ambigus. | Centraliser les options autorisées par commande, prendre en charge `--`, tester les valeurs commençant par un tiret et les options répétées. |
| P2 | L'installation/MCP n'ont pas de recette complète depuis un autre répertoire. | Documenter une configuration client testée avec chemin absolu et racine de projet explicite ; envisager `--project`. Vérifier installation du tarball dans un dossier vierge. |
| P2 | La mémoire croît sans limite et le contexte ne reprend pas les notes des tâches. | Définir archivage, limites de contexte et informations utiles au relais avant d'ajouter une interface ou une synchronisation distante. |

## Reproduction du défaut de concurrence

Dans un répertoire temporaire initialisé, appeler `Promise.allSettled` sur dix `addTask(root, titre)` simultanés. Lors de l'audit : **1 appel réussi, 1 tâche persistée sur 10**. Le test utilise un seul processus ; les appels partagent donc aussi le nom du fichier temporaire. Entre processus, des noms distincts ne suffisent pas à empêcher la perte de mises à jour, car chacun peut lire le même état initial.

## Validation locale

```bash
npm ci
npm run check
npm test
npm run build
node dist/cli.js help
npm pack --dry-run
```

Les tests de régression utilisent des projets temporaires, sans initialiser de mémoire dans ce dépôt. La validation locale a été effectuée sous Node 24.21.0 ; la version minimale déclarée doit aussi passer la matrice CI. Pas d'essai de connexion à une application cliente MCP ni de publication npm pendant cet audit.
