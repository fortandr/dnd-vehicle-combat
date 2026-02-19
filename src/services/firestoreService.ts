/**
 * Firestore Storage Service
 * Implements StorageService interface using Firebase Firestore
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { StorageService } from './storageService';
import type { SavedEncounter, PartyPreset, CombatArchive } from './localStorageService';

// ==========================================
// Helper Functions
// ==========================================

function getUserId(): string {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to use Firestore storage');
  }
  return user.uid;
}

function getFirestore() {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }
  return db;
}

// Recursively strip undefined values from an object (Firestore rejects undefined fields)
// Only recurses into plain objects — preserves Timestamp, FieldValue sentinels, Dates, etc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned;
  }
  return obj;
}

// Convert Firestore Timestamp to ISO string
function timestampToString(timestamp: Timestamp | string | undefined): string {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === 'string') return timestamp;
  return timestamp.toDate().toISOString();
}

// ==========================================
// Firestore Service Implementation
// ==========================================

export const firestoreService: StorageService = {
  // ==========================================
  // Encounters
  // ==========================================

  async saveEncounter(id: string, name: string, data: unknown): Promise<void> {
    const userId = getUserId();
    const firestore = getFirestore();

    const encounterRef = doc(firestore, 'users', userId, 'encounters', id);
    await setDoc(encounterRef, stripUndefined({
      name,
      data,
      savedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  },

  async loadEncounter(id: string): Promise<SavedEncounter | null> {
    const userId = getUserId();
    const firestore = getFirestore();

    const encounterRef = doc(firestore, 'users', userId, 'encounters', id);
    const snapshot = await getDoc(encounterRef);

    if (!snapshot.exists()) {
      return null;
    }

    const docData = snapshot.data();
    return {
      id: snapshot.id,
      name: docData.name,
      savedAt: timestampToString(docData.savedAt),
      data: docData.data,
    };
  },

  async listEncounters(): Promise<SavedEncounter[]> {
    const userId = getUserId();
    const firestore = getFirestore();

    const encountersRef = collection(firestore, 'users', userId, 'encounters');
    const q = query(encountersRef, orderBy('savedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        savedAt: timestampToString(data.savedAt),
        data: data.data,
      };
    });
  },

  async deleteEncounter(id: string): Promise<void> {
    const userId = getUserId();
    const firestore = getFirestore();

    const encounterRef = doc(firestore, 'users', userId, 'encounters', id);
    await deleteDoc(encounterRef);
  },

  // ==========================================
  // Current Encounter (Auto-save)
  // For cloud storage, we use a special document
  // ==========================================

  async saveCurrentEncounter(data: unknown): Promise<void> {
    const userId = getUserId();
    const firestore = getFirestore();

    const currentRef = doc(firestore, 'users', userId, 'current', 'encounter');
    await setDoc(currentRef, stripUndefined({
      data,
      updatedAt: serverTimestamp(),
    }));
  },

  async loadCurrentEncounter(): Promise<unknown | null> {
    try {
      const userId = getUserId();
      const firestore = getFirestore();

      const currentRef = doc(firestore, 'users', userId, 'current', 'encounter');
      const snapshot = await getDoc(currentRef);

      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.data().data;
    } catch {
      // User might not be authenticated yet
      return null;
    }
  },

  async clearCurrentEncounter(): Promise<void> {
    try {
      const userId = getUserId();
      const firestore = getFirestore();

      const currentRef = doc(firestore, 'users', userId, 'current', 'encounter');
      await deleteDoc(currentRef);
    } catch {
      // Ignore errors if user not authenticated
    }
  },

  // ==========================================
  // Party Presets
  // ==========================================

  async savePartyPreset(id: string, name: string, data: unknown): Promise<void> {
    const userId = getUserId();
    const firestore = getFirestore();

    const presetRef = doc(firestore, 'users', userId, 'partyPresets', id);
    await setDoc(presetRef, stripUndefined({
      name,
      data,
      savedAt: serverTimestamp(),
    }));
  },

  async listPartyPresets(): Promise<PartyPreset[]> {
    const userId = getUserId();
    const firestore = getFirestore();

    const presetsRef = collection(firestore, 'users', userId, 'partyPresets');
    const q = query(presetsRef, orderBy('savedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const docData = doc.data();
      return {
        id: doc.id,
        name: docData.name,
        savedAt: timestampToString(docData.savedAt),
        data: docData.data,
      };
    });
  },

  async deletePartyPreset(id: string): Promise<void> {
    const userId = getUserId();
    const firestore = getFirestore();

    const presetRef = doc(firestore, 'users', userId, 'partyPresets', id);
    await deleteDoc(presetRef);
  },

  // ==========================================
  // Combat Archives
  // ==========================================

  async saveCombatArchive(archive: unknown): Promise<void> {
    const userId = getUserId();
    const firestore = getFirestore();
    const archiveData = archive as CombatArchive;

    const archiveRef = doc(firestore, 'users', userId, 'combatArchives', archiveData.id);
    await setDoc(archiveRef, stripUndefined({
      ...archiveData,
      completedAt: serverTimestamp(),
    }));
  },

  async listCombatArchives(): Promise<CombatArchive[]> {
    const userId = getUserId();
    const firestore = getFirestore();

    const archivesRef = collection(firestore, 'users', userId, 'combatArchives');
    const q = query(archivesRef, orderBy('completedAt', 'desc'), limit(20));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        completedAt: timestampToString(data.completedAt),
      } as CombatArchive;
    });
  },

  async getCombatArchive(id: string): Promise<CombatArchive | null> {
    const userId = getUserId();
    const firestore = getFirestore();

    const archiveRef = doc(firestore, 'users', userId, 'combatArchives', id);
    const snapshot = await getDoc(archiveRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      ...data,
      id: snapshot.id,
      completedAt: timestampToString(data.completedAt),
    } as CombatArchive;
  },

  async deleteCombatArchive(id: string): Promise<void> {
    const userId = getUserId();
    const firestore = getFirestore();

    const archiveRef = doc(firestore, 'users', userId, 'combatArchives', id);
    await deleteDoc(archiveRef);
  },
};
