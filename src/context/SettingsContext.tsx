/**
 * Settings Context
 * Manages user preferences like unit system (imperial/metric)
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UnitSystem = 'imperial' | 'metric';

interface SettingsState {
  unitSystem: UnitSystem;
}

interface SettingsContextType extends SettingsState {
  setUnitSystem: (system: UnitSystem) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const SETTINGS_STORAGE_KEY = 'vehicleCombat_settings';

const defaultSettings: SettingsState = {
  unitSystem: 'imperial',
};

function loadSettings(): SettingsState {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return defaultSettings;
}

function saveSettings(settings: SettingsState): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const setUnitSystem = (unitSystem: UnitSystem) => {
    setSettings((prev) => ({ ...prev, unitSystem }));
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        setUnitSystem,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
