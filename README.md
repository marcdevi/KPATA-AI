# KPATA AI

**Studio photo IA instantané** pour vendeurs vêtement & Beauté à Abidjan.

L'utilisateur envoie une photo → reçoit en < 30 secondes un visuel prêt à poster (Status/IG), payé à l'unité / par packs via Mobile Money.

## Structure du Monorepo

```
kpata-ai/
├── apps/
│   ├── mobile/          # Application mobile (React Native/Expo)
│   └── admin/           # Dashboard admin (Next.js/Vite)
├── services/
│   ├── api/             # API REST principale
│   ├── worker/          # Worker de traitement des jobs
│   └── media-worker/    # Cloudflare Worker pour le media
├── packages/
│   └── shared/          # Types et enums partagés
└── package.json         # Configuration racine
```

## Prérequis

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## Installation

```bash
pnpm install
```

## Commandes

```bash
# Build tous les packages
pnpm build

# Lint
pnpm lint

# Format
pnpm format

# Type check
pnpm typecheck
```

## Types Partagés

Les types et enums sont définis dans `packages/shared` et importables depuis tous les packages :

```typescript
import { 
  JobStatus, 
  BackgroundStyle, 
  TemplateLayout,
  UserRole,
  PlanId,
  ErrorCode,
  JobCategory,
  MannequinMode
} from '@kpata/shared';
```

## Configuration des Environnements

Copier les fichiers `.env.example` vers `.env` dans chaque service :

- `services/api/.env.example` → `services/api/.env`
- `services/worker/.env.example` → `services/worker/.env`
- `services/media-worker/.dev.vars.example` → `services/media-worker/.dev.vars`

## Logger JSON Structuré

Tous les logs passent par le logger structuré avec les champs obligatoires :

- `level` : debug | info | warn | error
- `timestamp` : ISO 8601
- `correlation_id` : ID de corrélation pour le tracing
- `user_id` : ID utilisateur (si applicable)
- `component` : Composant source
- `action` : Action en cours
- `duration_ms` : Durée (si applicable)
- `error_code` : Code d'erreur (si applicable)
- `meta` : Métadonnées additionnelles

```typescript
import { logger } from './logger';

logger.info('Job started', {
  correlation_id: 'abc-123',
  user_id: 'user-456',
  action: 'job_start',
  meta: { jobId: 'job-789' }
});
```

TOKEN_HMAC_SECRET=RIENADIREMAISJEVAISESSAYERCA2026

MEDIA_BASE_URL=https://kpata-media-worker.kpata-ai.workers.dev# CI/CD actif
