# Avernus Combat Tracker - Public Version Plan

## Overview
Fork the local version into a public web app with Firebase authentication and cloud storage, allowing users to save encounters to their own accounts.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  (Same UI as local version + Auth components)           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                 Firebase Services                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Firebase    │  │  Firestore   │  │   Firebase   │  │
│  │    Auth      │  │  Database    │  │   Hosting    │  │
│  │ (Google/Apple│  │ (Encounters) │  │  (Static)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Architecture Strategy: Single Codebase with Feature Flags

Instead of maintaining two separate branches, use **environment variables** to toggle features:

```
┌─────────────────────────────────────────────────────────┐
│                  Single Codebase                         │
│                                                          │
│   VITE_AUTH_ENABLED=false     VITE_AUTH_ENABLED=true    │
│   ┌─────────────────┐         ┌─────────────────┐       │
│   │  Local Build    │         │  Public Build   │       │
│   │  - localStorage │         │  - Firebase Auth│       │
│   │  - No login     │         │  - Firestore    │       │
│   │  - Runs offline │         │  - Cloud sync   │       │
│   └─────────────────┘         └─────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### Benefits
- **All features stay in sync** - one codebase, two build configs
- **No merge conflicts** - no diverging branches to maintain
- **Easy testing** - toggle between modes locally
- **Gradual migration** - add auth without breaking local mode

### Environment Variables
```bash
# .env.local (local development - no auth)
VITE_AUTH_ENABLED=false

# .env.production.local (public deployment)
VITE_AUTH_ENABLED=true
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
```

### Storage Abstraction Layer
Create a unified storage interface that switches based on environment:

```typescript
// src/services/storageService.ts
import { localStorageService } from './localStorageService';
import { firestoreService } from './firestoreService';

const isAuthEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';

export const storageService = isAuthEnabled
  ? firestoreService
  : localStorageService;

// Both services implement the same interface:
export interface StorageService {
  saveEncounter(id: string, name: string, data: CombatState): Promise<void>;
  loadEncounter(id: string): Promise<CombatState | null>;
  listEncounters(): Promise<SavedEncounter[]>;
  deleteEncounter(id: string): Promise<void>;
}
```

## Firebase Project Setup

### 1. Create Firebase Project
1. Go to https://console.firebase.google.com
2. Create new project: "avernus-combat-tracker"
3. Enable Google Analytics (optional)

### 2. Enable Authentication
1. Authentication → Sign-in method
2. Enable providers:
   - Google (built-in, easy)
   - Apple (requires Apple Developer account)
   - (Optional) Reddit via custom OAuth later

### 3. Create Firestore Database
1. Firestore Database → Create database
2. Start in production mode
3. Choose region (us-central1 recommended)

### 4. Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Encounters subcollection
      match /encounters/{encounterId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Public encounter templates (read-only for authenticated users)
    match /templates/{templateId} {
      allow read: if request.auth != null;
      allow write: if false; // Admin only via console
    }
  }
}
```

## Data Schema

### Firestore Collections

```
/users/{userId}
  - email: string
  - displayName: string
  - photoURL: string
  - createdAt: timestamp
  - lastLogin: timestamp

/users/{userId}/encounters/{encounterId}
  - name: string
  - scale: string
  - phase: string
  - vehicles: array
  - creatures: array
  - crewAssignments: array
  - actionLog: array
  - createdAt: timestamp
  - updatedAt: timestamp
  - isPublic: boolean (future: sharing feature)
```

## Implementation Phases

### Phase 1: Project Setup
- [ ] Create `public` branch
- [ ] Install Firebase SDK (`firebase`, `react-firebase-hooks`)
- [ ] Create Firebase project and get config
- [ ] Add firebase.ts configuration file
- [ ] Set up environment variables (.env.local)

### Phase 2: Authentication
- [ ] Create AuthContext for user state
- [ ] Create LoginPage component
- [ ] Add Google sign-in button
- [ ] Add Apple sign-in button (requires Apple Developer setup)
- [ ] Create ProtectedRoute wrapper
- [ ] Add logout functionality
- [ ] Show user avatar/name in Header

### Phase 3: Data Migration
- [ ] Create Firestore service layer (firestoreService.ts)
- [ ] Migrate `useLocalStorage` hooks to Firestore
- [ ] Update `saveEncounter` to write to Firestore
- [ ] Update `loadEncounter` to read from Firestore
- [ ] Update `getSavedEncounters` to list user's encounters
- [ ] Update `deleteEncounter` to remove from Firestore
- [ ] Keep localStorage as offline fallback/cache

### Phase 4: UI Updates
- [ ] Add login/signup flow
- [ ] Show "Sign in to save" prompt for anonymous users
- [ ] Add user menu in Header (avatar, logout)
- [ ] Update save/load dialogs for cloud storage
- [ ] Add loading states for async operations
- [ ] Add error handling for network issues

### Phase 5: Deployment
- [ ] Configure Firebase Hosting
- [ ] Set up GitHub Actions for auto-deploy
- [ ] Configure custom domain (optional)
- [ ] Test production build

### Phase 6: Polish (Optional)
- [ ] Add Reddit OAuth (custom provider)
- [ ] Add encounter sharing (public links)
- [ ] Add encounter templates library
- [ ] Add offline support with service worker

## File Changes Summary

### New Files
```
src/
├── firebase.ts                 # Firebase initialization
├── context/
│   └── AuthContext.tsx         # Authentication state
├── components/
│   └── auth/
│       ├── LoginPage.tsx       # Login/signup page
│       ├── ProtectedRoute.tsx  # Route guard
│       └── UserMenu.tsx        # Header user dropdown
├── services/
│   └── firestoreService.ts     # Firestore CRUD operations
└── hooks/
    └── useFirestore.ts         # Firestore React hooks
```

### Modified Files
```
src/
├── App.tsx                     # Add AuthProvider, routes
├── components/layout/
│   └── Header.tsx              # Add UserMenu
├── hooks/
│   └── useLocalStorage.ts      # Add Firestore fallback
└── context/
    └── CombatContext.tsx       # Use Firestore for persistence
```

### Environment Files
```
.env.local                      # Firebase config (gitignored)
.env.example                    # Template for config
```

## Cost Estimate (Firebase Free Tier)

| Service | Free Tier Limit | Expected Usage |
|---------|-----------------|----------------|
| Auth | 50k MAU | Well under |
| Firestore | 1GB storage, 50k reads/day | Should be fine |
| Hosting | 10GB/month bandwidth | Should be fine |

The free tier should handle several thousand active users easily.

## Security Considerations

1. **Firestore Rules**: Users can only access their own data
2. **Environment Variables**: Firebase config in .env.local (not committed)
3. **No sensitive data**: Encounters don't contain personal info
4. **Rate limiting**: Firebase handles this automatically

## Migration Path for Existing Users

When users first sign in:
1. Check localStorage for existing encounters
2. Offer to import them to their cloud account
3. Clear localStorage after successful import

## Future Enhancements

1. **Encounter Sharing**: Generate public links to share encounters
2. **Templates Library**: Community-submitted encounter templates
3. **Real-time Collaboration**: Multiple DMs editing same encounter
4. **Mobile App**: React Native version using same Firebase backend
