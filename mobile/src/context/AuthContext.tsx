import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  authApi,
  extractErrorMessage,
  registerUnauthorizedHandler,
} from '../services/api';
import {
  deleteAuthToken,
  getAuthToken,
  isOnboardingCompleted,
  saveAuthToken,
  setOnboardingCompleted,
} from '../services/storage';
import { NotificationPreference, User } from '../types';

interface AuthContextValue {
  user: User | null;
  notificationPreferences: NotificationPreference | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserLocal: (user: User) => void;
  updateNotificationPrefsLocal: (prefs: NotificationPreference) => void;
  completeOnboarding: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await deleteAuthToken();
    setUser(null);
    setNotificationPreferences(null);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      void signOut();
    });
  }, [signOut]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      const [onboarded, token] = await Promise.all([isOnboardingCompleted(), getAuthToken()]);
      setHasCompletedOnboarding(onboarded);

      if (token) {
        const me = await authApi.getMe();
        setUser(me.user);
        setNotificationPreferences(me.notificationPreferences);
      } else {
        setUser(null);
      }
    } catch {
      await deleteAuthToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const data = await authApi.login({ email, password });
      await saveAuthToken(data.token);
      setUser(data.user);
      setNotificationPreferences(data.notificationPreferences);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signUp = async (name: string, email: string, password: string, phone?: string) => {
    setAuthError(null);
    try {
      const data = await authApi.register({ name, email, password, phone });
      await saveAuthToken(data.token);
      setUser(data.user);
      setNotificationPreferences(data.notificationPreferences);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const refreshUser = async () => {
    const me = await authApi.getMe();
    setUser(me.user);
    setNotificationPreferences(me.notificationPreferences);
  };

  const completeOnboarding = async () => {
    await setOnboardingCompleted(true);
    setHasCompletedOnboarding(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        notificationPreferences,
        isLoading,
        hasCompletedOnboarding,
        signIn,
        signUp,
        signOut,
        refreshUser,
        updateUserLocal: setUser,
        updateNotificationPrefsLocal: setNotificationPreferences,
        completeOnboarding,
        authError,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
