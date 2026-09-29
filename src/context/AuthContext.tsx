/**
 * Authentication Context
 * Provides user authentication state throughout the app
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, isAuthEnabled, logAnalyticsEvent } from '../firebase';
import { isInAppBrowser, shouldFallbackToRedirect } from '../utils/browserEnv';

// ==========================================
// Types
// ==========================================

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ==========================================
// Context
// ==========================================

const AuthContext = createContext<AuthContextType | null>(null);

// ==========================================
// Provider
// ==========================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isAuthEnabled); // Only loading if auth is enabled
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    if (!isAuthEnabled || !auth) {
      setLoading(false);
      return;
    }

    // If we came back from a signInWithRedirect round-trip, surface any error.
    // (Success is delivered through onAuthStateChanged below.)
    getRedirectResult(auth)
      .then((result) => {
        if (result) logAnalyticsEvent('login', { method: 'google', flow: 'redirect' });
      })
      .catch((error) => {
        console.error('Redirect sign-in error:', error);
        setError(error instanceof Error ? error.message : 'Failed to sign in');
      });

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Auth state change error:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sign in with Google
  const signInWithGoogle = async () => {
    if (!auth) {
      setError('Authentication is not configured');
      return;
    }

    setLoading(true);
    setError(null);

    const provider = new GoogleAuthProvider();
    const inAppBrowser = isInAppBrowser(navigator.userAgent);

    try {
      if (inAppBrowser) {
        // Popups are unreliable inside embedded browsers; go straight to redirect.
        await signInWithRedirect(auth, provider);
        return; // page navigates away
      }
      await signInWithPopup(auth, provider);
      logAnalyticsEvent('login', { method: 'google', flow: 'popup' });
    } catch (error) {
      if (shouldFallbackToRedirect(error)) {
        console.warn('Popup sign-in unavailable, falling back to redirect:', error);
        try {
          await signInWithRedirect(auth, provider);
          return; // page navigates away
        } catch (redirectError) {
          console.error('Redirect sign-in error:', redirectError);
          setError(redirectError instanceof Error ? redirectError.message : 'Failed to sign in');
        }
      } else {
        console.error('Sign in error:', error);
        setError(error instanceof Error ? error.message : 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    if (!auth) return;

    setLoading(true);
    setError(null);

    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error instanceof Error ? error.message : 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ==========================================
// Hook
// ==========================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// Re-export isAuthEnabled for convenience
export { isAuthEnabled };
