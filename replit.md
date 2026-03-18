# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── acordes/            # Dicionário de Acordes Sofisticados (React + Vite)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Artifacts

### `artifacts/acordes` — Dicionário de Acordes Sofisticados

A premium chord dictionary web app for keyboard players.

**Stack:** React + Vite + Tailwind CSS + Framer Motion + wouter  
**Route:** `/` (root)  
**Port:** 24375 (dev)

**Features:**
- Home page with hero and benefits section
- Dictionary page with search + category filters (218 chords, 18 categories)
- Chord detail page: PDF variation photos (tabs Variação 1–5) for 120 mapped chords; SVG piano fallback for the rest
- Study mode with flashcards (category-filtered)
- Favorites (localStorage persistence)
- Chord Sofisticador (suggest sophisticated substitutions)
- Dark elegant musical theme (charcoal/navy + gold accents)

**PDF image mapping** (`src/data/chord-images.ts`):
- 660 images in `public/variacoes/` (pag018_var1.png … pag149_var5.png)
- 9 categories mapped: 7M (p18-29), add9 (p30-41), 9M (p42-64 even), 6ª (p66-77), 7sus4 (p78-89), m7 (p90-101), madd9 (p102-113), m9 (p114-136 even), m11 (p138-149)
- URL format: `pag${page.toString().padStart(3,'0')}_var${n}.png`

**File structure:**
```
artifacts/acordes/src/
├── data/
│   ├── chords.ts          # 218 chord entries across 18 categories
│   ├── chord-images.ts    # PDF page → chord ID mapping (120 chords)
│   ├── applications.ts    # Harmonic application examples
│   └── substitutions.ts   # Sofisticador substitution rules
├── components/
│   ├── Layout.tsx         # Navbar + footer
│   ├── ChordCard.tsx      # Chord card component
│   ├── CategoryBadge.tsx  # Color-coded category badge
│   └── PianoKeyboard.tsx  # SVG piano (fallback for unmapped chords)
└── pages/
    ├── home.tsx            # Landing page
    ├── dictionary.tsx      # Chord list with search/filter
    ├── chord-detail.tsx    # Chord detail with PDF tabs + fallback SVG
    ├── study.tsx           # Flashcard study mode
    ├── favorites.tsx       # Saved favorites
    ├── chord-substitutor.tsx # Sofisticador de Cifra
    └── not-found.tsx       # 404 page
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files emitted during typecheck
- **Project references** — each package that depends on another must list it in `references`

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/acordes` (`@workspace/acordes`)

Vite React app. Dev command: `pnpm --filter @workspace/acordes run dev`

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Currently not used by acordes (frontend-only with localStorage).

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Not yet used by acordes.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec + Orval codegen config.

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client.

### `scripts` (`@workspace/scripts`)

Utility scripts package.

## Version 2 Suggestions

- Add audio playback (play chord on click using Tone.js)
- Add piano keyboard visualization showing which keys to press
- User accounts (Replit Auth) for cross-device favorites sync
- More chords (all 12 keys for each chord type = 200+ chords)
- Chord progression builder
- Print/export chord sheet
- Video tutorials linked per chord
