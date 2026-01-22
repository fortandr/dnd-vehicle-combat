/**
 * Storage Service Abstraction
 * Unified interface for local and cloud storage
 */

import { isAuthEnabled } from '../firebase';
import { localStorageService } from './localStorageService';
import { firestoreService } from './firestoreService';

// Re-export types
export type { SavedEncounter, PartyPreset, CombatArchive } from './localStorageService';

/**
 * Storage service interface - implemented by both local and Firestore services
 */
export interface StorageService {
  // Encounters
  saveEncounter(id: string, name: string, data: unknown): Promise<void>;
  loadEncounter(id: string): Promise<{ id: string; name: string; savedAt: string; data: unknown } | null>;
  listEncounters(): Promise<{ id: string; name: string; savedAt: string; data: unknown }[]>;
  deleteEncounter(id: string): Promise<void>;

  // Current encounter (auto-save)
  saveCurrentEncounter(data: unknown): Promise<void>;
  loadCurrentEncounter(): Promise<unknown | null>;
  clearCurrentEncounter(): Promise<void>;

  // Party presets
  savePartyPreset(id: string, name: string, data: unknown): Promise<void>;
  listPartyPresets(): Promise<{ id: string; name: string; savedAt: string; data: unknown }[]>;
  deletePartyPreset(id: string): Promise<void>;

  // Combat archives
  saveCombatArchive(archive: unknown): Promise<void>;
  listCombatArchives(): Promise<unknown[]>;
  getCombatArchive(id: string): Promise<unknown | null>;
  deleteCombatArchive(id: string): Promise<void>;
}

/**
 * Get the appropriate storage service based on environment
 */
export function getStorageService(): StorageService {
  if (isAuthEnabled) {
    return firestoreService;
  }
  return localStorageService;
}

// Default export - the active storage service
export const storageService = getStorageService();
