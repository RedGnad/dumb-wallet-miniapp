# DCA Worker

Worker autonome pour l'exécution des stratégies DCA via Delegation Toolkit.

## Configuration

Ajouter ces secrets dans GitHub Actions :

- `VITE_RPC_URL`
- `VITE_ZERO_DEV_BUNDLER_RPC` 
- `VITE_ZERO_DEV_PAYMASTER_RPC`
- `VITE_DELEGATE_PRIVATE_KEY`
- `USE_DTK` ("1" pour activer le chemin Delegation Toolkit; sinon EOA)

Optionnels pour le contrôle d'exécution :

- `DRY_RUN` ("1" pour ne pas envoyer de tx, par défaut 1 en local)
- `ALLOW_TEST_TX` ("1" pour envoyer un micro-tx de validation sur testnet)

## Fonctionnement

- Le workflow s'exécute chaque minute
- Le worker lit `plan.json` pour déterminer s'il doit agir
- L'intervalle réel est contrôlé par `intervalSeconds` dans le plan
- Les mises à jour du plan sont commitées automatiquement

## Test local

```bash
npm install
# Copier .env.example -> .env et remplir
npm start
```

Le worker :

- lit `plan.json` (champs `mode`, `intervalSeconds`, `nextRun` ISO, `lastRun`)
- si `mode: off`, il reprogramme simplement `nextRun`
- signe un message de heartbeat avec l'EOA (toujours que possible)
- si `DRY_RUN=0` et `ALLOW_TEST_TX=1`, envoie un micro-tx à soi-même pour valider la pipeline (testnet)
- si `USE_DTK=1` et bundler/paymaster présents, initialise DTK (stub no-op pour l'instant), sinon fallback EOA
- écrit `lastRun`, `nextRun` et éventuellement `lastTxHash` dans `plan.json`
