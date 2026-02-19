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
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
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

// Sanitize user data for Firestore by round-tripping through JSON.
// This strips undefined, class instances, circular refs, and any non-serializable values.
function cleanForFirestore(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data));
}

// Upload a data URL image to Firebase Storage and return the download URL
async function uploadBattlemapImage(userId: string, imageKey: string, dataUrl: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage is not initialized');
  const imageRef = ref(storage, `users/${userId}/battlemap-images/${imageKey}`);
  await uploadString(imageRef, dataUrl, 'data_url');
  return getDownloadURL(imageRef);
}

// Delete a battlemap image from Firebase Storage (best-effort)
async function deleteBattlemapImage(userId: string, imageKey: string): Promise<void> {
  if (!storage) return;
  try {
    const imageRef = ref(storage, `users/${userId}/battlemap-images/${imageKey}`);
    await deleteObject(imageRef);
  } catch {
    // Ignore — file may not exist
  }
}

// Extract background image data URL from combat state, upload to Storage,
// and replace with download URL. Returns cleaned data ready for Firestore.
async function extractAndUploadImage(userId: string, imageKey: string, data: unknown): Promise<unknown> {
  const cleaned = cleanForFirestore(data) as Record<string, unknown>;
  const battlefield = cleaned.battlefield as Record<string, unknown> | undefined;
  const bgImage = battlefield?.backgroundImage as Record<string, unknown> | undefined;

  if (bgImage?.url && typeof bgImage.url === 'string' && bgImage.url.startsWith('data:')) {
    const downloadUrl = await uploadBattlemapImage(userId, imageKey, bgImage.url);
    bgImage.url = downloadUrl;
  }

  return cleaned;
}

// Convert Firestore Timestamp to ISO string
// Also handles corrupted timestamps stored as plain {seconds, nanoseconds} objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function timestampToString(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === 'string') return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
  // Handle corrupted timestamps (plain objects with seconds field)
  if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000).toISOString();
  return new Date().toISOString();
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

    const cleanedData = await extractAndUploadImage(userId, `encounter-${id}`, data);
    const encounterRef = doc(firestore, 'users', userId, 'encounters', id);
    await setDoc(encounterRef, {
      name,
      data: cleanedData,
      savedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
    await deleteBattlemapImage(userId, `encounter-${id}`);
  },

  // ==========================================
  // Current Encounter (Auto-save)
  // For cloud storage, we use a special document
  // ==========================================

  async saveCurrentEncounter(data: unknown): Promise<void> {
    const userId = getUserId();
    const firestore = getFirestore();

    const cleanedData = await extractAndUploadImage(userId, 'current', data);
    const currentRef = doc(firestore, 'users', userId, 'current', 'encounter');
    await setDoc(currentRef, {
      data: cleanedData,
      updatedAt: serverTimestamp(),
    });
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
    await setDoc(presetRef, {
      name,
      data: cleanForFirestore(data),
      savedAt: serverTimestamp(),
    });
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
    const { id: _id, ...cleanArchive } = archiveData;
    await setDoc(archiveRef, {
      ...cleanForFirestore(cleanArchive) as Record<string, unknown>,
      completedAt: serverTimestamp(),
    });
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
