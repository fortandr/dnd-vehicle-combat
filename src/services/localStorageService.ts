/**
 * Local Storage Service
 * Implements StorageService interface using browser localStorage
 */

import type { StorageService } from './storageService';

// ==========================================
// Types
// ==========================================

export interface SavedEncounter {
  id: string;
  name: string;
  savedAt: string;
  data: unknown;
}

export interface PartyPreset {
  id: string;
  name: string;
  savedAt: string;
  data: {
    vehicles: unknown[];
    creatures: unknown[];
    crewAssignments: unknown[];
  };
}

export interface CombatArchive {
  id: string;
  encounterName: string;
  completedAt: string;
  totalRounds: number;
  summary: {
    partyVehicles: string[];
    enemyVehicles: string[];
    partyCreatures: string[];
    enemyCreatures: string[];
    vehiclesDestroyed: string[];
    creaturesKilled: string[];
  };
  actionLog: unknown[];
}

// ==========================================
// Storage Keys
// ==========================================

const ENCOUNTERS_KEY = 'avernus-saved-encounters';
const CURRENT_ENCOUNTER_KEY = 'avernus-current-encounter';
const PARTY_PRESETS_KEY = 'avernus-party-presets';
const COMBAT_ARCHIVES_KEY = 'avernus-combat-archives';

// ==========================================
// Local Storage Service Implementation
// ==========================================

export const localStorageService: StorageService = {
  // ==========================================
  // Encounters
  // ==========================================

  async saveEncounter(id: string, name: string, data: unknown): Promise<void> {
    const encounters = await this.listEncounters();
    const existingIndex = encounters.findIndex((e) => e.id === id);

    const encounter: SavedEncounter = {
      id,
      name,
      savedAt: new Date().toISOString(),
      data,
    };

    if (existingIndex >= 0) {
      encounters[existingIndex] = encounter;
    } else {
      encounters.push(encounter);
    }

    window.localStorage.setItem(ENCOUNTERS_KEY, JSON.stringify(encounters));
  },

  async loadEncounter(id: string): Promise<SavedEncounter | null> {
    const encounters = await this.listEncounters();
    return encounters.find((e) => e.id === id) || null;
  },

  async listEncounters(): Promise<SavedEncounter[]> {
    try {
      const item = window.localStorage.getItem(ENCOUNTERS_KEY);
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  },

  async deleteEncounter(id: string): Promise<void> {
    const encounters = (await this.listEncounters()).filter((e) => e.id !== id);
    window.localStorage.setItem(ENCOUNTERS_KEY, JSON.stringify(encounters));
  },

  // ==========================================
  // Current Encounter (Auto-save)
  // ==========================================

  async saveCurrentEncounter(data: unknown): Promise<void> {
    window.localStorage.setItem(CURRENT_ENCOUNTER_KEY, JSON.stringify(data));
  },

  async loadCurrentEncounter(): Promise<unknown | null> {
    try {
      const item = window.localStorage.getItem(CURRENT_ENCOUNTER_KEY);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  async clearCurrentEncounter(): Promise<void> {
    window.localStorage.removeItem(CURRENT_ENCOUNTER_KEY);
  },

  // ==========================================
  // Party Presets
  // ==========================================

  async savePartyPreset(id: string, name: string, data: unknown): Promise<void> {
    const presets = await this.listPartyPresets();
    const existingIndex = presets.findIndex((p) => p.id === id);

    const preset = {
      id,
      name,
      savedAt: new Date().toISOString(),
      data,
    };

    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }

    window.localStorage.setItem(PARTY_PRESETS_KEY, JSON.stringify(presets));
  },

  async listPartyPresets(): Promise<PartyPreset[]> {
    try {
      const item = window.localStorage.getItem(PARTY_PRESETS_KEY);
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  },

  async deletePartyPreset(id: string): Promise<void> {
    const presets = (await this.listPartyPresets()).filter((p) => p.id !== id);
    window.localStorage.setItem(PARTY_PRESETS_KEY, JSON.stringify(presets));
  },

  // ==========================================
  // Combat Archives
  // ==========================================

  async saveCombatArchive(archive: unknown): Promise<void> {
    const archives = await this.listCombatArchives();
    archives.unshift(archive);
    // Keep only last 20 archives
    const trimmedArchives = archives.slice(0, 20);
    window.localStorage.setItem(COMBAT_ARCHIVES_KEY, JSON.stringify(trimmedArchives));
  },

  async listCombatArchives(): Promise<CombatArchive[]> {
    try {
      const item = window.localStorage.getItem(COMBAT_ARCHIVES_KEY);
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  },

  async getCombatArchive(id: string): Promise<CombatArchive | null> {
    const archives = await this.listCombatArchives();
    const found = archives.find((a) => (a as CombatArchive).id === id);
    return (found as CombatArchive) || null;
  },

  async deleteCombatArchive(id: string): Promise<void> {
    const archives = (await this.listCombatArchives()).filter((a) => (a as CombatArchive).id !== id);
    window.localStorage.setItem(COMBAT_ARCHIVES_KEY, JSON.stringify(archives));
  },
};
