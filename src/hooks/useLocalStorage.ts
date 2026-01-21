/**
 * useLocalStorage Hook
 * Persist data to localStorage with React state sync
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when value changes
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Remove from localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

// ==========================================
// Encounter Storage Helpers
// ==========================================

const ENCOUNTERS_KEY = 'avernus-saved-encounters';
const CURRENT_ENCOUNTER_KEY = 'avernus-current-encounter';

export interface SavedEncounter {
  id: string;
  name: string;
  savedAt: string;
  data: unknown; // CombatState
}

export function getSavedEncounters(): SavedEncounter[] {
  try {
    const item = window.localStorage.getItem(ENCOUNTERS_KEY);
    return item ? JSON.parse(item) : [];
  } catch {
    return [];
  }
}

export function saveEncounter(id: string, name: string, data: unknown): void {
  const encounters = getSavedEncounters();
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
}

export function loadEncounter(id: string): SavedEncounter | null {
  const encounters = getSavedEncounters();
  return encounters.find((e) => e.id === id) || null;
}

export function deleteEncounter(id: string): void {
  const encounters = getSavedEncounters().filter((e) => e.id !== id);
  window.localStorage.setItem(ENCOUNTERS_KEY, JSON.stringify(encounters));
}

export function saveCurrentEncounter(data: unknown): void {
  window.localStorage.setItem(CURRENT_ENCOUNTER_KEY, JSON.stringify(data));
}

export function loadCurrentEncounter(): unknown | null {
  try {
    const item = window.localStorage.getItem(CURRENT_ENCOUNTER_KEY);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function clearCurrentEncounter(): void {
  try {
    window.localStorage.removeItem(CURRENT_ENCOUNTER_KEY);
  } catch {
    // Ignore errors
  }
}

// ==========================================
// Party Preset Storage Helpers
// ==========================================

const PARTY_PRESETS_KEY = 'avernus-party-presets';

export interface PartyPresetData {
  vehicles: unknown[];
  creatures: unknown[];
  crewAssignments: unknown[];
}

export interface PartyPreset {
  id: string;
  name: string;
  savedAt: string;
  data: PartyPresetData;
}

export function getPartyPresets(): PartyPreset[] {
  try {
    const item = window.localStorage.getItem(PARTY_PRESETS_KEY);
    return item ? JSON.parse(item) : [];
  } catch {
    return [];
  }
}

export function savePartyPreset(id: string, name: string, data: PartyPresetData): void {
  const presets = getPartyPresets();
  const existingIndex = presets.findIndex((p) => p.id === id);

  const preset: PartyPreset = {
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
}

export function deletePartyPreset(id: string): void {
  const presets = getPartyPresets().filter((p) => p.id !== id);
  window.localStorage.setItem(PARTY_PRESETS_KEY, JSON.stringify(presets));
}

// ==========================================
// Combat Archive Storage Helpers
// ==========================================

const COMBAT_ARCHIVES_KEY = 'avernus-combat-archives';

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
  actionLog: unknown[]; // LogEntry[]
}

export function getCombatArchives(): CombatArchive[] {
  try {
    const item = window.localStorage.getItem(COMBAT_ARCHIVES_KEY);
    return item ? JSON.parse(item) : [];
  } catch {
    return [];
  }
}

export function saveCombatArchive(archive: CombatArchive): void {
  const archives = getCombatArchives();
  archives.unshift(archive); // Add to beginning (newest first)
  // Keep only last 20 archives to prevent storage bloat
  const trimmedArchives = archives.slice(0, 20);
  window.localStorage.setItem(COMBAT_ARCHIVES_KEY, JSON.stringify(trimmedArchives));
}

export function getCombatArchive(id: string): CombatArchive | null {
  const archives = getCombatArchives();
  return archives.find((a) => a.id === id) || null;
}

export function deleteCombatArchive(id: string): void {
  const archives = getCombatArchives().filter((a) => a.id !== id);
  window.localStorage.setItem(COMBAT_ARCHIVES_KEY, JSON.stringify(archives));
}

// ==========================================
// Auto-Save Hook
// ==========================================

/**
 * Hook that automatically saves data to localStorage with debouncing.
 * Saves occur after a delay to avoid excessive writes during rapid changes.
 */
export function useAutoSave<T>(
  key: string,
  data: T,
  options: {
    debounceMs?: number;
    enabled?: boolean;
    onSave?: () => void;
  } = {}
): { lastSaved: Date | null; forceSave: () => void } {
  const { debounceMs = 1000, enabled = true, onSave } = options;
  const lastSavedRef = useRef<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);

  // Keep data ref updated
  dataRef.current = data;

  const save = useCallback(() => {
    try {
      const serialized = JSON.stringify(dataRef.current);
      window.localStorage.setItem(key, serialized);
      lastSavedRef.current = new Date();
      // Log key state fields for debugging
      const data = dataRef.current as { phase?: string; round?: number; hasBeenSaved?: boolean; battlefield?: { backgroundImage?: unknown } };
      console.log(`Auto-saved to "${key}" (${Math.round(serialized.length / 1024)}KB)`, {
        phase: data.phase,
        round: data.round,
        hasBeenSaved: data.hasBeenSaved,
        hasBackgroundImage: !!data.battlefield?.backgroundImage,
      });
      onSave?.();
    } catch (error) {
      // Check for quota exceeded error
      if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
        console.error(`Auto-save failed: localStorage quota exceeded. Try using a smaller background image.`);
      } else {
        console.warn(`Auto-save failed for key "${key}":`, error);
      }
    }
  }, [key, onSave]);

  // Force immediate save
  const forceSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    save();
  }, [save]);

  // Debounced auto-save on data change
  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(save, debounceMs);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, debounceMs, save]);

  // Save immediately on page close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabled) {
        // Synchronous save on page unload
        try {
          const serialized = JSON.stringify(dataRef.current);
          window.localStorage.setItem(key, serialized);
          console.log(`Saved on unload to "${key}" (${Math.round(serialized.length / 1024)}KB)`);
        } catch (error) {
          console.error('Failed to save on page unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [key, enabled]);

  // Clear timeout on unmount only (not on every re-render)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        // Save synchronously on unmount
        if (enabled) {
          try {
            const serialized = JSON.stringify(dataRef.current);
            window.localStorage.setItem(key, serialized);
          } catch {
            // Ignore errors during unmount
          }
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on unmount

  return { lastSaved: lastSavedRef.current, forceSave };
}
