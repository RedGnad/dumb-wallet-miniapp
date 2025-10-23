# Dumb Wallet Mini App (Standalone)

Mini app Farcaster statique pour Warpcast. Pas de build, pas de secrets côté client.

- Entrée: `index.html` à la racine
- Embedding: `vercel.json` définit CSP `frame-ancestors` pour Warpcast/Farcaster
- Ajoute des endpoints backend pour le vrai contrôle (ex: `/api/miniapp/status`, `/api/miniapp/toggle`), puis consomme-les depuis ce front.
