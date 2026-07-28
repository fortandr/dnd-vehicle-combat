# Claude Code Instructions

## Project Overview

**VVTT (Vehicular Virtual Table Top)** - A web app for running the tactical combat/chase phase of vehicular encounters in D&D 5e. Covers **Avernus infernal war machines** (Baldur's Gate: Descent into Avernus) and **Ghosts of Saltmarsh ships**, plus **user-built custom vehicles**.

Scope: VVTT is a **combat/chase tool only** — not a voyage/travel tracker. (Chase complications belong; Saltmarsh naval *hazards* are travel-phase and intentionally out of scope.)

Key architecture for the multi-ruleset support:
- **Template registry** (`src/data/templateRegistry.ts`) merges built-in Avernus vehicles + Saltmarsh ships (`src/data/navalTemplates.ts`) + the user's personal library.
- **Packs** (`VehicleTemplate.pack`, `isAvernusVehicle` / `isNavalVehicle`) gate pack-specific UI: war machines show armor/gadgets/mishaps; ships show components + Ship Upgrades (`src/data/navalUpgrades.ts`).
- **Component combat** (`VehicleTemplate.components`, `Vehicle.componentHp`, `src/utils/vehicleComponents.ts`): ships track per-part HP (hull mirrors `currentHp`); destroyed parts affect speed/turning/firing.

**Live URL:** https://vvtt.lukantan.com (custom domain — "Vehicular Virtual Table Top")
**Firebase URL:** https://e-vehicle-combat.web.app (still active)
**GitHub:** https://github.com/fortandr/dnd-vehicle-combat

> Custom domain `vvtt.lukantan.com` is a CNAME (managed at GoDaddy) → `e-vehicle-combat.web.app`, with a Firebase-managed SSL cert. It's also registered in **Firebase Auth → Authorized domains** (required for Google Sign-In to work there).

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI Library:** Material UI (MUI)
- **State Management:** React Context + useReducer
- **Authentication:** Firebase Auth (Google Sign-In)
- **Database:** Firestore (cloud) / localStorage (offline fallback)
- **Hosting:** Firebase Hosting

## Key Architecture

### Storage Abstraction
The app uses a storage abstraction layer that switches between localStorage and Firestore:
- `src/services/storageService.ts` - Unified interface
- `src/services/localStorageService.ts` - localStorage implementation
- `src/services/firestoreService.ts` - Firestore implementation
- When `VITE_AUTH_ENABLED=true` and user is authenticated → Firestore
- Otherwise → localStorage

### Authentication
- `src/firebase.ts` - Firebase initialization
- `src/context/AuthContext.tsx` - Auth state management
- `src/components/auth/LoginPage.tsx` - Login UI
- `src/components/auth/UserMenu.tsx` - User avatar dropdown
- Feature flag: `VITE_AUTH_ENABLED` in `.env.local`

### Core State
- `src/context/CombatContext.tsx` - Main combat state (vehicles, creatures, initiative, etc.)
- `src/types/index.ts` - All TypeScript interfaces

### Layout Components
- `src/App.tsx` - Root component with auth wrapper
- `src/components/layout/Header.tsx` - Top bar with combat controls, save/load, menu
- `src/components/layout/Sidebar.tsx` - Left sidebar with creatures, initiative tracker
- `src/components/layout/MainPanel.tsx` - Center area with battlefield map
- `src/components/layout/RightPanel.tsx` - Right sidebar with vehicle stats

### Battlefield
- `src/components/battlefield/BattlefieldMap.tsx` - Main DM battlefield view
- `src/components/battlefield/PlayerViewMap.tsx` - Player-facing view (no controls)
- Uses BroadcastChannel API to sync DM view → Player view

### Key Concepts

**Vehicles:**
- Have `type: 'party' | 'enemy'`
- Have zones (helm, weapons, etc.) where creatures can be assigned
- Track HP, mishaps, speed modifiers

**Creatures:**
- Have `faction: 'party' | 'enemy'`
- PCs have `statblock.type === 'pc'`
- Can be assigned to vehicle zones as crew
- Track HP, conditions, initiative

**Combat Scales:**
- Point Blank (0-30 ft)
- Tactical (30-300 ft)
- Pursuit (300-3000 ft)
- Exploration (3000+ ft)
- Scale auto-adjusts based on distance between party/enemy vehicles

**Party Presets:**
- Save party vehicles + party-faction creatures + crew assignments
- Only saves party faction (not enemies)
- Stored in Firestore under `users/{userId}/partyPresets`

## Common Tasks

### Deploy to Firebase
```bash
npm run build && npx firebase deploy --force
```

### Run locally
```bash
npm run dev
```

### Check TypeScript
```bash
npx tsc --noEmit
```

## Data Structure in Firestore

```
users/{userId}/
  encounters/{encounterId}     - Saved encounters
  partyPresets/{presetId}      - Party configurations
  combatArchives/{archiveId}   - Completed combat summaries
  current/encounter            - Auto-save data
```

## Security
- Firestore rules in `firestore.rules`
- Each user can only access their own data under `users/{userId}/`

## Environment Variables
See `.env.example` for required Firebase config variables.

## Notes for Bug Fixes
- When modifying creature/vehicle data, check both the reducer in `CombatContext.tsx` and any migration logic for loading saved data
- The `faction` field on creatures was added later - migration code handles legacy creatures without it
- Player view syncs via BroadcastChannel - changes to battlefield rendering may need updates in both `BattlefieldMap.tsx` and `PlayerViewMap.tsx`
