/**
 * Firebase Configuration
 * Initializes Firebase services for authentication, Firestore, and Analytics
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, Analytics, logEvent as firebaseLogEvent } from 'firebase/analytics';

// Check if auth is enabled via environment variable
export const isAuthEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase only if auth is enabled and config is present
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let analytics: Analytics | null = null;

if (isAuthEnabled && firebaseConfig.apiKey) {
  // Prevent duplicate initialization
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Initialize Analytics (only in browser environment)
  if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
    analytics = getAnalytics(app);
  }
}

// Helper function to log analytics events safely
export function logAnalyticsEvent(eventName: string, eventParams?: Record<string, unknown>) {
  if (analytics) {
    firebaseLogEvent(analytics, eventName, eventParams);
  }
}

export { app, auth, db, storage, analytics };
